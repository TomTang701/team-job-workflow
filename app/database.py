import os
from pathlib import Path

from sqlalchemy import create_engine
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
