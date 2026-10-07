"""Small SQLite persistence layer. Transactions keep review changes together."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from . import config


def now():
    return datetime.now(timezone.utc).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False)


@contextmanager
def connect():
    db = sqlite3.connect(config.DB, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def audit(db, entity, action, reviewer, details):
    db.execute(
        "INSERT INTO audit(entity,action,reviewer,details,created) VALUES(?,?,?,?,?)",
        (entity, action, reviewer, encode(details), now()),
    )


def init_db():
    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS studies (
          id TEXT PRIMARY KEY, origin TEXT NOT NULL CHECK(origin IN ('mock','real')),
          title TEXT NOT NULL, characteristics TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS papers (
          id TEXT PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, filename TEXT NOT NULL,
          study_id TEXT REFERENCES studies(id), pages TEXT NOT NULL, page_count INTEGER,
          screening TEXT, decision TEXT NOT NULL DEFAULT 'Pending', reason TEXT,
          reviewer TEXT, reviewed_at TEXT, extraction TEXT, draft TEXT,
          job TEXT, error TEXT, version INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS outcomes (
          id TEXT PRIMARY KEY, study_id TEXT NOT NULL REFERENCES studies(id),
          paper_id TEXT REFERENCES papers(id), data TEXT NOT NULL, raw TEXT NOT NULL,
          status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', reviewer TEXT, reviewed_at TEXT);
        CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, study_id TEXT, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (
          id INTEGER PRIMARY KEY, entity TEXT NOT NULL, action TEXT NOT NULL,
          reviewer TEXT, details TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS model_runs (
          id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, task TEXT NOT NULL,
          model TEXT NOT NULL, prompt_version TEXT NOT NULL, status TEXT NOT NULL,
          reserved REAL NOT NULL, actual REAL, input_tokens INTEGER, output_tokens INTEGER,
          created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires REAL NOT NULL);
        """)
        # Additive migration keeps existing deployed reviews intact.
        columns = {row["name"] for row in db.execute("PRAGMA table_info(papers)")}
        if "treatment_class" not in columns:
            db.execute("ALTER TABLE papers ADD COLUMN treatment_class TEXT")
        # A restart never silently leaves a paper stuck in processing.
        db.execute(
            "UPDATE papers SET job=NULL,error='Processing was interrupted. Your saved work is safe. Please try again.' WHERE job IS NOT NULL"
        )
        db.execute("UPDATE model_runs SET status='interrupted' WHERE status='running'")
