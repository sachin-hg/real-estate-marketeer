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
        Base.metadata.create_all(bind=_engine)   # creates new tables (runs, etc.)
        _migrate(_engine)
    return _engine


def _migrate(engine) -> None:
    """Apply additive column migrations for SQLite (ALTER TABLE ADD COLUMN)."""
    import sqlalchemy as sa

    # ── published_posts migrations ────────────────────────────────────────────
    post_cols = [
        ("user_rating",           "INTEGER"),
        ("user_tags",             "TEXT"),
        ("user_feedback",         "TEXT"),
        ("user_action",           "VARCHAR(32)"),
        ("rejection_reason",      "TEXT"),
        ("draft_type",            "VARCHAR(16)"),
        ("zomato_hook",           "TEXT"),
        ("trend_hashtag",         "VARCHAR(128)"),
        ("media_format",          "VARCHAR(32)"),
        ("qa_decision",           "VARCHAR(32)"),
        ("post_status",           "VARCHAR(32)"),
        ("qa_rejection_reasons",  "TEXT"),
        ("qa_critique",           "TEXT"),
        ("qa_quality_dimensions", "TEXT"),
        ("engagement_reasoning",  "TEXT"),
        ("trend_data",            "TEXT"),
        ("extra_data",            "TEXT"),
        ("image_cloud_url",       "TEXT"),
        ("source_topic",          "TEXT"),
    ]
    with engine.connect() as conn:
        existing = {
            row[1]
            for row in conn.execute(sa.text("PRAGMA table_info(published_posts)"))
        }
        for col_name, col_type in post_cols:
            if col_name not in existing:
                conn.execute(sa.text(
                    f"ALTER TABLE published_posts ADD COLUMN {col_name} {col_type}"
                ))

        # ── runs migrations ───────────────────────────────────────────────────
        existing_runs = {
            row[1]
            for row in conn.execute(sa.text("PRAGMA table_info(runs)"))
        }
        for col_name, col_type in [("error", "TEXT"), ("summary_json", "TEXT")]:
            if col_name not in existing_runs:
                conn.execute(sa.text(f"ALTER TABLE runs ADD COLUMN {col_name} {col_type}"))

        # ── users backfill ────────────────────────────────────────────────────
        # One-time migration for DBs created before the auth feature was added.
        # Runs only when the users table is empty; becomes a no-op after that.
        user_count = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar()
        if user_count == 0:
            _users = [
                ('sachin.ag',  '$2b$10$ZbzruRJ.5pn/MkpBPgmKaO0f11ejvBlEMVnBIFagq1qh/J5UUpK4.', 'admin'),
                ('mohan.mr',   '$2b$10$nqGtiPTO6ygqah.7jYNG3uDx5IpYL0XxFGOuAgRjQyqjBoQboswcq', 'investor'),
                ('shubh.gp',   '$2b$10$xZ/jEqa02XE18Q.SjB8raeAf2fc3JMOqjRGbOF8jb1uOT7THVlUZG', 'investor'),
                ('rohan.ag',   '$2b$10$QTCtjuc3TPOPM.77lxONnO2kSuntXt6AjKcmcDL/2unIcrO8Dq8kO', 'investor'),
                ('monika.ag',  '$2b$10$hGqknK9maHf49lNJ3RDJ3eYgTHriEyp17gjmH5QD1K9JFwj.pImfu', 'investor'),
            ]
            for username, password_hash, role in _users:
                conn.execute(sa.text(
                    "INSERT OR IGNORE INTO users (username, password_hash, role, created_at, is_active) "
                    "VALUES (:u, :p, :r, datetime('now'), 1)"
                ), {'u': username, 'p': password_hash, 'r': role})

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
