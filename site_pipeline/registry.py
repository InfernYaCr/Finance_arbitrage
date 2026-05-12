"""
registry.py — SQLite registry for PBN pipeline.

Tables:
  donors       — discovered/qualified donor sites
  crawl_runs   — crawl job history per donor
  site_targets — site builds (SITE_ID → donor + brand config)
  build_runs   — Astro build history per site

DB location: registry/registry.db (project root, gitignored).
"""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = _PROJECT_ROOT / "registry" / "registry.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _slug(url: str) -> str:
    """Turn a URL into a registry id: https://vsezaimyonline.ru → vsezaimyonline-ru"""
    from urllib.parse import urlparse
    host = urlparse(url).netloc.lower().replace("www.", "")
    return host.replace(".", "-")


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(path: Path = DB_PATH) -> None:
    """Create tables if they don't exist."""
    with connect(path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS donors (
                id          TEXT PRIMARY KEY,
                url         TEXT NOT NULL UNIQUE,
                niche       TEXT,
                verdict     TEXT DEFAULT 'PENDING',
                score       REAL,
                page_count  INTEGER,
                crawled_at  TEXT,
                notes       TEXT,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS crawl_runs (
                id          TEXT PRIMARY KEY,
                donor_id    TEXT NOT NULL REFERENCES donors(id),
                started_at  TEXT NOT NULL,
                finished_at TEXT,
                page_count  INTEGER,
                credit_cost INTEGER,
                mode        TEXT,
                output_dir  TEXT
            );

            CREATE TABLE IF NOT EXISTS site_targets (
                id              TEXT PRIMARY KEY,
                donor_id        TEXT NOT NULL REFERENCES donors(id),
                brand_name      TEXT,
                brand_name_full TEXT,
                config_path     TEXT,
                theme           TEXT DEFAULT 'alpha',
                metrika_id      TEXT,
                beget_host      TEXT,
                beget_ftp_user  TEXT,
                created_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS build_runs (
                id          TEXT PRIMARY KEY,
                site_id     TEXT NOT NULL REFERENCES site_targets(id),
                started_at  TEXT NOT NULL,
                finished_at TEXT,
                page_count  INTEGER,
                status      TEXT
            );
        """)


# ── Donors ────────────────────────────────────────────────────────────────────

def upsert_donor(
    url: str,
    *,
    niche: str | None = None,
    verdict: str = "PENDING",
    score: float | None = None,
    page_count: int | None = None,
    notes: str | None = None,
    path: Path = DB_PATH,
) -> str:
    """Insert or update a donor. Returns donor_id."""
    init_db(path)
    donor_id = _slug(url)
    with connect(path) as conn:
        existing = conn.execute(
            "SELECT id FROM donors WHERE id = ?", (donor_id,)
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE donors SET
                    url=?, niche=COALESCE(?,niche), verdict=?,
                    score=COALESCE(?,score), page_count=COALESCE(?,page_count),
                    notes=COALESCE(?,notes), crawled_at=?
                   WHERE id=?""",
                (url, niche, verdict, score, page_count, notes, _now(), donor_id),
            )
        else:
            conn.execute(
                """INSERT INTO donors
                   (id,url,niche,verdict,score,page_count,notes,created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (donor_id, url, niche, verdict, score, page_count, notes, _now()),
            )
    return donor_id


def get_donor(url_or_id: str, path: Path = DB_PATH) -> dict[str, Any] | None:
    init_db(path)
    did = _slug(url_or_id) if url_or_id.startswith("http") else url_or_id
    with connect(path) as conn:
        row = conn.execute("SELECT * FROM donors WHERE id=?", (did,)).fetchone()
        return dict(row) if row else None


def list_donors(path: Path = DB_PATH) -> list[dict[str, Any]]:
    init_db(path)
    with connect(path) as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM donors ORDER BY created_at DESC"
        ).fetchall()]


# ── Crawl runs ────────────────────────────────────────────────────────────────

def insert_crawl_run(
    donor_url: str,
    *,
    page_count: int | None = None,
    credit_cost: int | None = None,
    mode: str = "base",
    output_dir: str | None = None,
    started_at: str | None = None,
    path: Path = DB_PATH,
) -> str:
    """Record a completed crawl run. Returns run_id."""
    init_db(path)
    donor_id = _slug(donor_url)
    # Ensure donor exists
    if not get_donor(donor_id, path):
        upsert_donor(donor_url, path=path)

    run_id = str(uuid.uuid4())[:8]
    with connect(path) as conn:
        conn.execute(
            """INSERT INTO crawl_runs
               (id,donor_id,started_at,finished_at,page_count,credit_cost,mode,output_dir)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                run_id,
                donor_id,
                started_at or _now(),
                _now(),
                page_count,
                credit_cost,
                mode,
                output_dir,
            ),
        )
        # Update donor page_count and crawled_at
        if page_count:
            conn.execute(
                "UPDATE donors SET page_count=?, crawled_at=? WHERE id=?",
                (page_count, _now(), donor_id),
            )
    return run_id


def list_crawl_runs(donor_url_or_id: str | None = None, path: Path = DB_PATH) -> list[dict[str, Any]]:
    init_db(path)
    with connect(path) as conn:
        if donor_url_or_id:
            did = _slug(donor_url_or_id) if donor_url_or_id.startswith("http") else donor_url_or_id
            rows = conn.execute(
                "SELECT * FROM crawl_runs WHERE donor_id=? ORDER BY started_at DESC",
                (did,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM crawl_runs ORDER BY started_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]


# ── Site targets ──────────────────────────────────────────────────────────────

def upsert_site_target(
    site_id: str,
    donor_url: str,
    *,
    brand_name: str | None = None,
    brand_name_full: str | None = None,
    config_path: str | None = None,
    theme: str = "alpha",
    metrika_id: str | None = None,
    beget_host: str | None = None,
    beget_ftp_user: str | None = None,
    path: Path = DB_PATH,
) -> None:
    init_db(path)
    donor_id = _slug(donor_url)
    if not get_donor(donor_id, path):
        upsert_donor(donor_url, path=path)
    with connect(path) as conn:
        existing = conn.execute(
            "SELECT id FROM site_targets WHERE id=?", (site_id,)
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE site_targets SET
                    donor_id=?, brand_name=COALESCE(?,brand_name),
                    brand_name_full=COALESCE(?,brand_name_full),
                    config_path=COALESCE(?,config_path), theme=?,
                    metrika_id=COALESCE(?,metrika_id),
                    beget_host=COALESCE(?,beget_host),
                    beget_ftp_user=COALESCE(?,beget_ftp_user)
                   WHERE id=?""",
                (donor_id, brand_name, brand_name_full, config_path,
                 theme, metrika_id, beget_host, beget_ftp_user, site_id),
            )
        else:
            conn.execute(
                """INSERT INTO site_targets
                   (id,donor_id,brand_name,brand_name_full,config_path,
                    theme,metrika_id,beget_host,beget_ftp_user,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (site_id, donor_id, brand_name, brand_name_full, config_path,
                 theme, metrika_id, beget_host, beget_ftp_user, _now()),
            )


def list_site_targets(path: Path = DB_PATH) -> list[dict[str, Any]]:
    init_db(path)
    with connect(path) as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM site_targets ORDER BY created_at DESC"
        ).fetchall()]


# ── Build runs ────────────────────────────────────────────────────────────────

def insert_build_run(
    site_id: str,
    *,
    page_count: int | None = None,
    status: str = "ok",
    started_at: str | None = None,
    path: Path = DB_PATH,
) -> str:
    init_db(path)
    run_id = str(uuid.uuid4())[:8]
    with connect(path) as conn:
        conn.execute(
            """INSERT INTO build_runs
               (id,site_id,started_at,finished_at,page_count,status)
               VALUES (?,?,?,?,?,?)""",
            (run_id, site_id, started_at or _now(), _now(), page_count, status),
        )
    return run_id
