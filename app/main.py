from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.database import get_db, init_db
from app.security import create_access_token, decode_access_token, hash_password, verify_password


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Team Job Workflow", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
bearer = HTTPBearer()
VALID_STATUSES = {"saved", "applied", "interview", "offer", "rejected"}


def normalize_required_text(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Value must contain non-whitespace characters.")
    return normalized


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=256)

    _normalize_email = field_validator("email")(normalize_required_text)


class WorkspaceInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)

    _normalize_name = field_validator("name")(normalize_required_text)


class MembershipInput(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: str

    _normalize_email = field_validator("email")(normalize_required_text)


class ApplicationInput(BaseModel):
    company: str = Field(min_length=2, max_length=160)
    job_title: str = Field(min_length=2, max_length=160)

    _normalize_fields = field_validator("company", "job_title")(normalize_required_text)


class StatusInput(BaseModel):
    status: str


class TaskInput(BaseModel):
    title: str = Field(min_length=2, max_length=240)

    _normalize_title = field_validator("title")(normalize_required_text)


class TaskCompletionInput(BaseModel):
    completed: bool


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=4000)

    _normalize_body = field_validator("body")(normalize_required_text)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> models.User:
    try:
        user_id = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.") from exc
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists.")
    return user


def membership_for(db: Session, workspace_id: int, user_id: int) -> models.Membership:
    membership = db.query(models.Membership).filter_by(workspace_id=workspace_id, user_id=user_id).one_or_none()
    if membership is None:
        raise HTTPException(status_code=403, detail="Workspace access is required.")
    return membership


def application_for(db: Session, application_id: int, user_id: int) -> tuple[models.JobApplication, models.Membership]:
    application = db.get(models.JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application was not found.")
    return application, membership_for(db, application.workspace_id, user_id)


def log_activity(db: Session, workspace_id: int, actor_id: int, action: str, detail: str, application_id: int | None = None) -> None:
    db.add(models.Activity(workspace_id=workspace_id, actor_id=actor_id, action=action, detail=detail, application_id=application_id))


def token_response(user: models.User) -> dict:
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": {"id": user.id, "email": user.email}}


@app.post("/api/auth/register", status_code=201)
def register(payload: Credentials, db: Session = Depends(get_db)) -> dict:
    email = payload.email.strip().casefold()
    if db.query(models.User).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="Email is already registered.")
    user = models.User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered.") from exc
    db.refresh(user)
    return token_response(user)


@app.post("/api/auth/login")
def login(payload: Credentials, db: Session = Depends(get_db)) -> dict:
    user = db.query(models.User).filter_by(email=payload.email.strip().casefold()).one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return token_response(user)


@app.post("/api/workspaces", status_code=201)
def create_workspace(payload: WorkspaceInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    workspace = models.Workspace(name=payload.name.strip(), owner_id=user.id)
    db.add(workspace)
    db.flush()
    db.add(models.Membership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    log_activity(db, workspace.id, user.id, "workspace_created", workspace.name)
    db.commit()
    return {"id": workspace.id, "name": workspace.name, "role": "owner"}


@app.get("/api/workspaces")
def list_workspaces(user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = (
        db.query(models.Workspace, models.Membership)
        .join(models.Membership, models.Membership.workspace_id == models.Workspace.id)
        .filter(models.Membership.user_id == user.id)
        .order_by(models.Workspace.created_at.desc())
        .all()
    )
    return {"items": [{"id": workspace.id, "name": workspace.name, "role": membership.role} for workspace, membership in rows]}


@app.get("/api/workspaces/{workspace_id}")
def get_workspace(workspace_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    membership = membership_for(db, workspace_id, user.id)
    workspace = db.get(models.Workspace, workspace_id)
    return {"id": workspace.id, "name": workspace.name, "role": membership.role}


@app.post("/api/workspaces/{workspace_id}/members", status_code=201)
def add_member(workspace_id: int, payload: MembershipInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    membership = membership_for(db, workspace_id, user.id)
    if membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can add members.")
    if payload.role not in {"owner", "member"}:
        raise HTTPException(status_code=422, detail="Role must be owner or member.")
    invited = db.query(models.User).filter_by(email=payload.email.strip().casefold()).one_or_none()
    if invited is None:
        raise HTTPException(status_code=404, detail="User must register before joining a workspace.")
    if db.query(models.Membership).filter_by(workspace_id=workspace_id, user_id=invited.id).first():
        raise HTTPException(status_code=409, detail="User is already a workspace member.")
    db.add(models.Membership(workspace_id=workspace_id, user_id=invited.id, role=payload.role))
    log_activity(db, workspace_id, user.id, "member_added", invited.email)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="User is already a workspace member.") from exc
    return {"user_id": invited.id, "email": invited.email, "role": payload.role}


@app.post("/api/workspaces/{workspace_id}/applications", status_code=201)
def create_application(workspace_id: int, payload: ApplicationInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    membership_for(db, workspace_id, user.id)
    application = models.JobApplication(workspace_id=workspace_id, company=payload.company.strip(), job_title=payload.job_title.strip(), status="saved", created_by_id=user.id)
    db.add(application)
    db.flush()
    log_activity(db, workspace_id, user.id, "application_created", application.company, application.id)
    db.commit()
    return application_payload(application)


@app.get("/api/workspaces/{workspace_id}/applications")
def list_applications(workspace_id: int, status_filter: str | None = None, search: str | None = None, page: int = 1, page_size: int = 20, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    membership_for(db, workspace_id, user.id)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    query = db.query(models.JobApplication).filter_by(workspace_id=workspace_id)
    if status_filter:
        query = query.filter_by(status=status_filter)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(models.JobApplication.company.ilike(term), models.JobApplication.job_title.ilike(term)))
    total = query.count()
    rows = query.order_by(models.JobApplication.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [application_payload(row) for row in rows], "page": page, "page_size": page_size, "total": total}


@app.patch("/api/applications/{application_id}/status")
def update_status(application_id: int, payload: StatusInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    application, _ = application_for(db, application_id, user.id)
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid application status.")
    old_status = application.status
    application.status = payload.status
    log_activity(db, application.workspace_id, user.id, "status_changed", f"{old_status} -> {payload.status}", application.id)
    db.commit()
    return application_payload(application)


@app.post("/api/applications/{application_id}/tasks", status_code=201)
def create_task(application_id: int, payload: TaskInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    application, _ = application_for(db, application_id, user.id)
    task = models.Task(application_id=application.id, title=payload.title.strip(), created_by_id=user.id)
    db.add(task)
    log_activity(db, application.workspace_id, user.id, "task_created", task.title, application.id)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "completed": task.completed}


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskCompletionInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task was not found.")
    application, _ = application_for(db, task.application_id, user.id)
    task.completed = payload.completed
    action = "task_completed" if payload.completed else "task_reopened"
    log_activity(db, application.workspace_id, user.id, action, task.title, application.id)
    db.commit()
    return {"id": task.id, "title": task.title, "completed": task.completed}


@app.post("/api/applications/{application_id}/comments", status_code=201)
def create_comment(application_id: int, payload: CommentInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    application, _ = application_for(db, application_id, user.id)
    comment = models.Comment(application_id=application.id, author_id=user.id, body=payload.body.strip())
    db.add(comment)
    log_activity(db, application.workspace_id, user.id, "comment_added", "Comment added", application.id)
    db.commit()
    db.refresh(comment)
    return {"id": comment.id, "body": comment.body, "author_id": comment.author_id}


@app.get("/api/applications/{application_id}")
def get_application(application_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    application, _ = application_for(db, application_id, user.id)
    payload = application_payload(application)
    payload["tasks"] = [{"id": task.id, "title": task.title, "completed": task.completed} for task in db.query(models.Task).filter_by(application_id=application.id).all()]
    payload["comments"] = [{"id": comment.id, "body": comment.body, "author_id": comment.author_id} for comment in db.query(models.Comment).filter_by(application_id=application.id).all()]
    payload["activities"] = [{"action": activity.action, "detail": activity.detail, "actor_id": activity.actor_id} for activity in db.query(models.Activity).filter_by(application_id=application.id).order_by(models.Activity.created_at).all()]
    return payload


def application_payload(application: models.JobApplication) -> dict:
    return {"id": application.id, "workspace_id": application.workspace_id, "company": application.company, "job_title": application.job_title, "status": application.status}
