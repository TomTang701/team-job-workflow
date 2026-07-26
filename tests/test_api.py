from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import database, models
from app.database import configure_database, init_db
from app.main import app


def make_client(tmp_path: Path, *, raise_server_exceptions: bool = True) -> TestClient:
    configure_database(f"sqlite:///{tmp_path / 'test.sqlite3'}")
    init_db()
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def register(client: TestClient, email: str, password: str = "correct-horse-battery-staple") -> dict:
    response = client.post("/api/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_owner_can_create_workspace_and_member_cannot_read_another_workspace(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    stranger = register(client, "stranger@example.test")

    workspace = client.post(
        "/api/workspaces",
        headers=auth_headers(owner["access_token"]),
        json={"name": "Sanitized Internship Search"},
    )
    assert workspace.status_code == 201
    workspace_id = workspace.json()["id"]

    forbidden = client.get(f"/api/workspaces/{workspace_id}", headers=auth_headers(stranger["access_token"]))
    assert forbidden.status_code == 403


def test_rejects_whitespace_only_registration_email(tmp_path):
    client = make_client(tmp_path)

    response = client.post(
        "/api/auth/register",
        json={"email": "   ", "password": "correct-horse-battery-staple"},
    )

    assert response.status_code == 422


def test_registration_accepts_six_character_password_and_rejects_shorter_password(tmp_path):
    client = make_client(tmp_path)

    too_short = client.post("/api/auth/register", json={"email": "short@example.test", "password": "12345"})
    accepted = client.post("/api/auth/register", json={"email": "six@example.test", "password": "123456"})
    login = client.post("/api/auth/login", json={"email": "six@example.test", "password": "123456"})

    assert too_short.status_code == 422
    assert accepted.status_code == 201
    assert login.status_code == 200


def test_registration_maps_database_unique_conflict_to_409(tmp_path, monkeypatch):
    client = make_client(tmp_path, raise_server_exceptions=False)

    def raise_unique_conflict(_: Session) -> None:
        raise IntegrityError("INSERT INTO users", {}, Exception("duplicate email"))

    monkeypatch.setattr(Session, "commit", raise_unique_conflict)

    response = client.post(
        "/api/auth/register",
        json={"email": "race@example.test", "password": "correct-horse-battery-staple"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered."


def test_member_invitation_maps_database_unique_conflict_to_409(tmp_path, monkeypatch):
    client = make_client(tmp_path, raise_server_exceptions=False)
    owner = register(client, "owner@example.test")
    member = register(client, "member@example.test")
    workspace = client.post(
        "/api/workspaces",
        headers=auth_headers(owner["access_token"]),
        json={"name": "Concurrent access"},
    ).json()

    def raise_unique_conflict(_: Session) -> None:
        raise IntegrityError("INSERT INTO memberships", {}, Exception("duplicate membership"))

    monkeypatch.setattr(Session, "commit", raise_unique_conflict)

    response = client.post(
        f"/api/workspaces/{workspace['id']}/members",
        headers=auth_headers(owner["access_token"]),
        json={"email": member["user"]["email"], "role": "member"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "User is already a workspace member."


def test_rejects_whitespace_only_mutation_fields(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "blank-input-owner@example.test")
    headers = auth_headers(owner["access_token"])

    blank_workspace = client.post("/api/workspaces", headers=headers, json={"name": "   "})
    assert blank_workspace.status_code == 422

    workspace = client.post("/api/workspaces", headers=headers, json={"name": "Validated workspace"}).json()
    blank_application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=headers,
        json={"company": "  ", "job_title": "\t"},
    )
    assert blank_application.status_code == 422

    application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=headers,
        json={"company": "Validated Company", "job_title": "Backend Intern"},
    ).json()
    blank_task = client.post(f"/api/applications/{application['id']}/tasks", headers=headers, json={"title": "\n "})
    blank_comment = client.post(f"/api/applications/{application['id']}/comments", headers=headers, json={"body": " \t"})
    assert blank_task.status_code == 422
    assert blank_comment.status_code == 422


def test_workspace_list_returns_only_the_callers_memberships(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    member = register(client, "member@example.test")
    stranger = register(client, "stranger@example.test")
    shared = client.post(
        "/api/workspaces",
        headers=auth_headers(owner["access_token"]),
        json={"name": "Shared Search"},
    ).json()
    client.post(
        "/api/workspaces",
        headers=auth_headers(owner["access_token"]),
        json={"name": "Owner Only Search"},
    )
    invited = client.post(
        f"/api/workspaces/{shared['id']}/members",
        headers=auth_headers(owner["access_token"]),
        json={"email": member["user"]["email"], "role": "member"},
    )
    assert invited.status_code == 201

    member_workspaces = client.get("/api/workspaces", headers=auth_headers(member["access_token"]))
    stranger_workspaces = client.get("/api/workspaces", headers=auth_headers(stranger["access_token"]))

    assert member_workspaces.status_code == 200
    assert member_workspaces.json() == {"items": [{"id": shared["id"], "name": "Shared Search", "role": "member"}]}
    assert stranger_workspaces.status_code == 200
    assert stranger_workspaces.json() == {"items": []}


def test_member_cannot_invite_workspace_members(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    member = register(client, "member@example.test")
    candidate = register(client, "candidate@example.test")
    workspace = client.post(
        "/api/workspaces",
        headers=auth_headers(owner["access_token"]),
        json={"name": "Search"},
    ).json()

    invited = client.post(
        f"/api/workspaces/{workspace['id']}/members",
        headers=auth_headers(owner["access_token"]),
        json={"email": "member@example.test", "role": "member"},
    )
    assert invited.status_code == 201

    forbidden = client.post(
        f"/api/workspaces/{workspace['id']}/members",
        headers=auth_headers(member["access_token"]),
        json={"email": "candidate@example.test", "role": "member"},
    )

    assert forbidden.status_code == 403


def test_member_can_track_application_status_tasks_and_comments(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    member = register(client, "member@example.test")
    workspace = client.post("/api/workspaces", headers=auth_headers(owner["access_token"]), json={"name": "Search"}).json()

    invited = client.post(
        f"/api/workspaces/{workspace['id']}/members",
        headers=auth_headers(owner["access_token"]),
        json={"email": "member@example.test", "role": "member"},
    )
    assert invited.status_code == 201

    application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=auth_headers(member["access_token"]),
        json={"company": "Example Co", "job_title": "Backend Intern"},
    )
    assert application.status_code == 201
    application_id = application.json()["id"]

    moved = client.patch(
        f"/api/applications/{application_id}/status",
        headers=auth_headers(member["access_token"]),
        json={"status": "interview"},
    )
    assert moved.status_code == 200
    assert moved.json()["status"] == "interview"

    task = client.post(
        f"/api/applications/{application_id}/tasks",
        headers=auth_headers(member["access_token"]),
        json={"title": "Prepare system design notes"},
    )
    assert task.status_code == 201
    comment = client.post(
        f"/api/applications/{application_id}/comments",
        headers=auth_headers(member["access_token"]),
        json={"body": "Interview time confirmed with the team."},
    )
    assert comment.status_code == 201

    details = client.get(f"/api/applications/{application_id}", headers=auth_headers(owner["access_token"]))
    assert details.status_code == 200
    assert details.json()["tasks"][0]["title"] == "Prepare system design notes"
    assert details.json()["comments"][0]["body"] == "Interview time confirmed with the team."
    assert any(activity["action"] == "status_changed" for activity in details.json()["activities"])


def test_application_list_filters_searches_and_paginates_and_rejects_bad_token(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    workspace = client.post("/api/workspaces", headers=auth_headers(owner["access_token"]), json={"name": "Search"}).json()
    for company, title in [("Acme", "Backend Intern"), ("Beta", "Frontend Intern"), ("Acme Labs", "Platform Intern")]:
        created = client.post(
            f"/api/workspaces/{workspace['id']}/applications",
            headers=auth_headers(owner["access_token"]),
            json={"company": company, "job_title": title},
        )
        assert created.status_code == 201
    applications = client.get(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=auth_headers(owner["access_token"]),
        params={"search": "Acme", "page": 2, "page_size": 1},
    )
    assert applications.status_code == 200
    assert applications.json()["total"] == 2
    assert len(applications.json()["items"]) == 1

    rejected = client.get(f"/api/workspaces/{workspace['id']}", headers=auth_headers("not-a-jwt"))
    assert rejected.status_code == 401


def test_member_can_mark_application_task_complete_and_activity_is_recorded(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    workspace = client.post("/api/workspaces", headers=auth_headers(owner["access_token"]), json={"name": "Search"}).json()
    application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=auth_headers(owner["access_token"]),
        json={"company": "Example Co", "job_title": "Backend Intern"},
    ).json()
    task = client.post(
        f"/api/applications/{application['id']}/tasks",
        headers=auth_headers(owner["access_token"]),
        json={"title": "Prepare interview examples"},
    ).json()

    completed = client.patch(
        f"/api/tasks/{task['id']}",
        headers=auth_headers(owner["access_token"]),
        json={"completed": True},
    )

    assert completed.status_code == 200
    assert completed.json()["completed"] is True
    details = client.get(f"/api/applications/{application['id']}", headers=auth_headers(owner["access_token"]))
    assert any(activity["action"] == "task_completed" for activity in details.json()["activities"])


def test_only_creator_or_owner_can_delete_workflow_records(tmp_path):
    client = make_client(tmp_path)
    owner = register(client, "owner@example.test")
    creator = register(client, "creator@example.test")
    peer = register(client, "peer@example.test")
    outsider = register(client, "outsider@example.test")
    owner_headers = auth_headers(owner["access_token"])
    creator_headers = auth_headers(creator["access_token"])
    peer_headers = auth_headers(peer["access_token"])
    outsider_headers = auth_headers(outsider["access_token"])
    workspace = client.post("/api/workspaces", headers=owner_headers, json={"name": "Deletion controls"}).json()

    for email in ("creator@example.test", "peer@example.test"):
        invited = client.post(
            f"/api/workspaces/{workspace['id']}/members",
            headers=owner_headers,
            json={"email": email, "role": "member"},
        )
        assert invited.status_code == 201

    application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=creator_headers,
        json={"company": "Example Co", "job_title": "Backend Intern"},
    ).json()
    task = client.post(
        f"/api/applications/{application['id']}/tasks",
        headers=creator_headers,
        json={"title": "Prepare interview notes"},
    ).json()
    comment = client.post(
        f"/api/applications/{application['id']}/comments",
        headers=creator_headers,
        json={"body": "Share sanitized interview notes."},
    ).json()

    assert client.delete(f"/api/tasks/{task['id']}", headers=peer_headers).status_code == 403
    assert client.delete(f"/api/comments/{comment['id']}", headers=peer_headers).status_code == 403
    assert client.delete(f"/api/applications/{application['id']}", headers=peer_headers).status_code == 403
    assert client.delete(f"/api/tasks/{task['id']}", headers=outsider_headers).status_code == 403

    assert client.delete(f"/api/tasks/{task['id']}", headers=creator_headers).status_code == 204
    assert client.delete(f"/api/comments/{comment['id']}", headers=creator_headers).status_code == 204
    details = client.get(f"/api/applications/{application['id']}", headers=creator_headers).json()
    assert details["tasks"] == []
    assert details["comments"] == []
    assert {"task_deleted", "comment_deleted"} <= {activity["action"] for activity in details["activities"]}

    assert client.delete(f"/api/applications/{application['id']}", headers=owner_headers).status_code == 204
    assert client.get(f"/api/applications/{application['id']}", headers=owner_headers).status_code == 404
    assert client.delete("/api/tasks/99999", headers=owner_headers).status_code == 404
    assert client.delete("/api/comments/99999", headers=owner_headers).status_code == 404
    assert client.delete("/api/applications/99999", headers=owner_headers).status_code == 404

    creator_owned_application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=creator_headers,
        json={"company": "Creator Co", "job_title": "Platform Intern"},
    ).json()
    assert client.delete(f"/api/applications/{creator_owned_application['id']}", headers=creator_headers).status_code == 204

    cascading_application = client.post(
        f"/api/workspaces/{workspace['id']}/applications",
        headers=creator_headers,
        json={"company": "Cascade Co", "job_title": "Software Intern"},
    ).json()
    client.post(f"/api/applications/{cascading_application['id']}/tasks", headers=creator_headers, json={"title": "Delete with parent"})
    client.post(f"/api/applications/{cascading_application['id']}/comments", headers=creator_headers, json={"body": "Delete with parent."})
    assert client.delete(f"/api/applications/{cascading_application['id']}", headers=owner_headers).status_code == 204

    with database.SessionLocal() as db:
        assert db.query(models.Task).filter_by(application_id=cascading_application["id"]).count() == 0
        assert db.query(models.Comment).filter_by(application_id=cascading_application["id"]).count() == 0
        assert db.query(models.Activity).filter_by(action="application_deleted", application_id=None).count() >= 1


def test_api_allows_local_vite_browser_origin(tmp_path):
    client = make_client(tmp_path)

    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
