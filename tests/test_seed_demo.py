from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from app import database
from app.models import Activity, Comment, JobApplication, Task
from tools import seed_demo


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def migrate_database(database_url: str) -> None:
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")


def test_seed_demo_creates_sanitized_collaboration_records_once(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'demo.sqlite3'}"
    monkeypatch.setenv("TJW_DATABASE_URL", database_url)
    database.configure_database(database_url)
    migrate_database(database_url)

    seed_demo.seed_demo()
    db = database.SessionLocal()
    try:
        assert db.query(JobApplication).count() == 2
        assert db.query(Task).count() >= 1
        assert db.query(Comment).count() >= 1
        assert db.query(Activity).count() >= 1
    finally:
        db.close()

    seed_demo.seed_demo()
    db = database.SessionLocal()
    try:
        assert db.query(JobApplication).count() == 2
    finally:
        db.close()


def test_seed_demo_rejects_an_unmigrated_database(tmp_path):
    database.configure_database(f"sqlite:///{tmp_path / 'unmigrated.sqlite3'}")

    with pytest.raises(RuntimeError, match="alembic upgrade head"):
        seed_demo.seed_demo()
