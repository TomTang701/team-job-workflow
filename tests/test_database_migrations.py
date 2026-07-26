from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from app import database
from app.main import app


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_application_health_requires_an_alembic_managed_schema(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'migration.sqlite3'}"
    monkeypatch.setenv("TJW_DATABASE_URL", database_url)
    database.configure_database(database_url)

    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json() == {"detail": "Database migrations are required. Run alembic upgrade head."}

    assert inspect(database.engine).get_table_names() == []

    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    command.upgrade(config, "head")

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}

    inspector = inspect(database.engine)
    assert set(inspector.get_table_names()) == {
        "activities",
        "alembic_version",
        "comments",
        "job_applications",
        "memberships",
        "tasks",
        "users",
        "workspaces",
    }
    with database.engine.connect() as connection:
        assert connection.execute(text("select version_num from alembic_version")).scalar_one() == "20260725_01"
