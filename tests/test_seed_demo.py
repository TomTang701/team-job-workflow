from app import database
from app.models import Activity, Comment, JobApplication, Task
from tools import seed_demo


def test_seed_demo_creates_sanitized_collaboration_records_once(tmp_path):
    database.configure_database(f"sqlite:///{tmp_path / 'demo.sqlite3'}")

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
