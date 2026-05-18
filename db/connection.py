from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from config import get_settings

# Use a sync engine for simplicity (SQLite default).
# For Postgres, swap DATABASE_URL to postgresql://... and pip install psycopg2.
_engine = None
_SessionLocal = None


def _get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        url = get_settings().database_url
        # aiosqlite URL → convert to sync for the ORM layer used here
        sync_url = url.replace("sqlite+aiosqlite", "sqlite")
        _engine = create_engine(sync_url, connect_args={"check_same_thread": False})
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        from db.models import Base
        Base.metadata.create_all(bind=_engine)
        _migrate(_engine)
    return _engine


def _migrate(engine) -> None:
    """Apply additive column migrations for SQLite (ALTER TABLE ADD COLUMN)."""
    new_cols = [
        ("user_rating",      "INTEGER"),
        ("user_tags",        "TEXT"),
        ("user_feedback",    "TEXT"),
        ("user_action",      "VARCHAR(32)"),
        ("rejection_reason", "TEXT"),
        ("draft_type",       "VARCHAR(16)"),
        ("zomato_hook",      "TEXT"),
        ("trend_hashtag",    "VARCHAR(128)"),
        ("media_format",     "VARCHAR(32)"),
    ]
    with engine.connect() as conn:
        existing = {
            row[1]
            for row in conn.execute(
                __import__("sqlalchemy").text("PRAGMA table_info(published_posts)")
            )
        }
        for col_name, col_type in new_cols:
            if col_name not in existing:
                conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE published_posts ADD COLUMN {col_name} {col_type}"
                    )
                )
        conn.commit()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    _get_engine()
    session = _SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
