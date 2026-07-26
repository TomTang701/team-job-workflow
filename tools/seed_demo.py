"""Seed a sanitized local workspace for demonstrations only."""

from app import database
from app.models import Activity, Comment, JobApplication, Membership, Task, User, Workspace
from app.security import hash_password


def seed_demo() -> None:
    database.require_current_schema()
    db = database.SessionLocal()
    try:
        if db.query(User).filter_by(email="demo.owner@example.test").first():
            print("Sanitized demo data already exists.")
            return
        owner = User(email="demo.owner@example.test", password_hash=hash_password("demo-password-only"))
        db.add(owner)
        db.flush()
        workspace = Workspace(name="Sanitized Internship Search", owner_id=owner.id)
        db.add(workspace)
        db.flush()
        db.add(Membership(workspace_id=workspace.id, user_id=owner.id, role="owner"))
        backend = JobApplication(workspace_id=workspace.id, company="Example Systems", job_title="Backend Intern", status="applied", created_by_id=owner.id)
        platform = JobApplication(workspace_id=workspace.id, company="Sample Labs", job_title="Platform Intern", status="interview", created_by_id=owner.id)
        db.add_all([backend, platform])
        db.flush()
        db.add_all(
            [
                Task(application_id=platform.id, title="Prepare sanitized interview notes", created_by_id=owner.id),
                Comment(application_id=platform.id, author_id=owner.id, body="Demo collaboration note only; no employer data."),
                Activity(workspace_id=workspace.id, application_id=backend.id, actor_id=owner.id, action="status_changed", detail="saved to applied"),
                Activity(workspace_id=workspace.id, application_id=platform.id, actor_id=owner.id, action="comment_added", detail="Demo collaboration note added"),
            ]
        )
        db.commit()
        print("Seeded sanitized demo account: demo.owner@example.test / demo-password-only")
    finally:
        db.close()


def main() -> None:
    seed_demo()


if __name__ == "__main__":
    main()
