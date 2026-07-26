import os
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker


Base = declarative_base()
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATABASE_URL = os.getenv("TJW_DATABASE_URL", f"sqlite:///{(PROJECT_ROOT / 'local.sqlite3').as_posix()}")


def make_engine(url: str):
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    return create_engine(url, **kwargs)


engine = make_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def configure_database(url: str) -> None:
    global DATABASE_URL, engine, SessionLocal
    engine.dispose()
    DATABASE_URL = url
    engine = make_engine(url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def schema_is_current() -> bool:
    try:
        inspector = inspect(engine)
        if "alembic_version" not in inspector.get_table_names():
            return False
        with engine.connect() as connection:
            current_revision = connection.execute(text("select version_num from alembic_version")).scalar_one_or_none()
        config = Config(str(PROJECT_ROOT / "alembic.ini"))
        expected_revision = ScriptDirectory.from_config(config).get_current_head()
        return current_revision == expected_revision
    except SQLAlchemyError:
        return False


def require_current_schema() -> None:
    if not schema_is_current():
        raise RuntimeError("Database migrations are required. Run alembic upgrade head.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
