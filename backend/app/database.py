"""
database.py – SQLite storage for user profile and job tracking (v2.0).

Uses aiosqlite for async database operations.
Stores:
- User profile (1 row) for personalization
- Tracked jobs (n rows) for dashboard persistence
- Job statistics and audit log

See: STORAGE_SCHEMA_AND_MIGRATION.md for schema design and migration path.
"""

import json
import logging
import aiosqlite
import uuid
from datetime import datetime
from typing import List, Dict, Optional

from .config import get_settings
from .models import UserProfile

logger = logging.getLogger(__name__)

# SQL statements

# ─── User Profile ──────────────────────────────────────────────────────────

CREATE_USER_PROFILE_TABLE = """
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '[]',
    experience TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT ''
);
"""

# ─── Tracked Jobs (Dashboard) ──────────────────────────────────────────────

CREATE_TRACKED_JOBS_TABLE = """
CREATE TABLE IF NOT EXISTS tracked_jobs (
    id TEXT PRIMARY KEY,
    job_title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    job_url TEXT,
    source_linkedin_id TEXT,
    match_percentage INTEGER DEFAULT 0,
    ranking_level TEXT DEFAULT 'low',
    matched_skills TEXT NOT NULL DEFAULT '[]',
    missing_skills TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at TIMESTAMP,
    application_date TIMESTAMP,
    rejection_date TIMESTAMP,
    rejection_reason TEXT,
    interview_date TIMESTAMP,
    interview_stage TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    source TEXT DEFAULT 'manual'
);
"""

CREATE_TRACKED_JOBS_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_tracked_jobs_status ON tracked_jobs(status);",
    "CREATE INDEX IF NOT EXISTS idx_tracked_jobs_created ON tracked_jobs(created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_tracked_jobs_match ON tracked_jobs(match_percentage DESC);",
    "CREATE INDEX IF NOT EXISTS idx_tracked_jobs_ranking ON tracked_jobs(ranking_level);",
]

# ─── Job Audit Log ────────────────────────────────────────────────────────

CREATE_JOB_AUDIT_TABLE = """
CREATE TABLE IF NOT EXISTS job_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES tracked_jobs(id) ON DELETE CASCADE
);
"""

# SQL DML Statements
INSERT_PROFILE = """
INSERT INTO user_profile (name, skills, experience, summary)
VALUES (?, ?, ?, ?);
"""

UPDATE_PROFILE = """
UPDATE user_profile
SET name = ?, skills = ?, experience = ?, summary = ?
WHERE id = ?;
"""

SELECT_PROFILE = "SELECT id, name, skills, experience, summary FROM user_profile LIMIT 1;"

INSERT_TRACKED_JOB = """
INSERT INTO tracked_jobs (
    id, job_title, company_name, location, description, job_url, 
    source_linkedin_id, match_percentage, ranking_level, matched_skills, 
    missing_skills, status, notes, source, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
"""

SELECT_TRACKED_JOB = """
SELECT id, job_title, company_name, location, description, job_url, 
       source_linkedin_id, match_percentage, ranking_level, matched_skills, 
       missing_skills, status, notes, created_at, updated_at, last_viewed_at,
       application_date, rejection_date, rejection_reason, interview_date,
       interview_stage, salary_min, salary_max, source
FROM tracked_jobs WHERE id = ?;
"""

SELECT_ALL_TRACKED_JOBS = """
SELECT id, job_title, company_name, location, description, job_url, 
       source_linkedin_id, match_percentage, ranking_level, matched_skills, 
       missing_skills, status, notes, created_at, updated_at, last_viewed_at,
       application_date, rejection_date, rejection_reason, interview_date,
       interview_stage, salary_min, salary_max, source
FROM tracked_jobs
WHERE 1=1
{filters}
ORDER BY {sort_by} {sort_order}
LIMIT ? OFFSET ?;
"""

SELECT_TRACKED_JOBS_COUNT = """
SELECT COUNT(*) FROM tracked_jobs WHERE 1=1 {filters};
"""

UPDATE_TRACKED_JOB = """
UPDATE tracked_jobs
SET {updates}, updated_at = ?
WHERE id = ?;
"""

DELETE_TRACKED_JOB = """
DELETE FROM tracked_jobs WHERE id = ?;
"""


def _get_db_path() -> str:
    """Return the SQLite database file path."""
    return get_settings().database_url


async def init_db() -> None:
    """Create all tables if they don't exist."""
    async with aiosqlite.connect(_get_db_path()) as db:
        await db.execute(CREATE_USER_PROFILE_TABLE)
        await db.execute(CREATE_TRACKED_JOBS_TABLE)
        await db.execute(CREATE_JOB_AUDIT_TABLE)
        
        # Create indexes
        for index_sql in CREATE_TRACKED_JOBS_INDEXES:
            await db.execute(index_sql)
        
        await db.commit()
    logger.info("Database initialized at %s", _get_db_path())


async def get_user_profile() -> UserProfile | None:
    """
    Retrieve the stored user profile.

    Returns None if no profile exists yet.
    """
    async with aiosqlite.connect(_get_db_path()) as db:
        cursor = await db.execute(SELECT_PROFILE)
        row = await cursor.fetchone()

    if not row:
        return None

    return UserProfile(
        id=row[0],
        name=row[1],
        skills=json.loads(row[2]),
        experience=row[3],
        summary=row[4],
    )


async def save_user_profile(profile: UserProfile) -> UserProfile:
    """
    Create or update the user profile.

    If a profile already exists, it is updated. Otherwise a new row is inserted.
    """
    existing = await get_user_profile()
    skills_json = json.dumps(profile.skills)

    async with aiosqlite.connect(_get_db_path()) as db:
        if existing:
            await db.execute(
                UPDATE_PROFILE,
                (profile.name, skills_json, profile.experience, profile.summary, existing.id),
            )
            profile.id = existing.id
        else:
            cursor = await db.execute(
                INSERT_PROFILE,
                (profile.name, skills_json, profile.experience, profile.summary),
            )
            profile.id = cursor.lastrowid
        await db.commit()

    logger.info("User profile saved (id=%s)", profile.id)
    return profile


# ─── Job Tracking Functions (Dashboard v2.0) ───────────────────────────────────


def _row_to_job_dict(row: tuple) -> Dict:
    """Convert database row to job dictionary."""
    return {
        "id": row[0],
        "job_title": row[1],
        "company_name": row[2],
        "location": row[3],
        "description": row[4],
        "job_url": row[5],
        "source_linkedin_id": row[6],
        "match_percentage": row[7],
        "ranking_level": row[8],
        "matched_skills": json.loads(row[9]) if row[9] else [],
        "missing_skills": json.loads(row[10]) if row[10] else [],
        "status": row[11],
        "notes": row[12],
        "created_at": row[13],
        "updated_at": row[14],
        "last_viewed_at": row[15],
        "application_date": row[16],
        "rejection_date": row[17],
        "rejection_reason": row[18],
        "interview_date": row[19],
        "interview_stage": row[20],
        "salary_min": row[21],
        "salary_max": row[22],
        "source": row[23],
    }


async def save_tracked_job(job_data: Dict) -> Dict:
    """
    Save a tracked job to the database.

    Validates required fields and generates ID if missing.
    """
    # Generate ID if missing - use UUID for guaranteed uniqueness
    job_id = job_data.get("id") or str(uuid.uuid4())
    
    # Prepare fields
    job_title = job_data.get("job_title", "")
    company_name = job_data.get("company_name", "")
    
    if not job_title or not company_name:
        raise ValueError("job_title and company_name are required")
    
    matched_skills_json = json.dumps(job_data.get("matched_skills", []))
    missing_skills_json = json.dumps(job_data.get("missing_skills", []))
    now = datetime.utcnow().isoformat()
    
    async with aiosqlite.connect(_get_db_path()) as db:
        await db.execute(
            INSERT_TRACKED_JOB,
            (
                job_id,
                job_title,
                company_name,
                job_data.get("location", ""),
                job_data.get("description", ""),
                job_data.get("job_url", ""),
                job_data.get("source_linkedin_id", ""),
                job_data.get("match_percentage", 0),
                job_data.get("ranking_level", "low"),
                matched_skills_json,
                missing_skills_json,
                job_data.get("status", "new"),
                job_data.get("notes", ""),
                job_data.get("source", "manual"),
                now,
                now,
            ),
        )
        await db.commit()
    
    # Return the saved job
    job_data["id"] = job_id
    job_data["created_at"] = now
    job_data["updated_at"] = now
    job_data["matched_skills"] = json.loads(matched_skills_json)
    job_data["missing_skills"] = json.loads(missing_skills_json)
    
    logger.info(f"Saved tracked job: {job_title} at {company_name}")
    return job_data


async def get_tracked_job(job_id: str) -> Optional[Dict]:
    """Retrieve a single tracked job by ID."""
    async with aiosqlite.connect(_get_db_path()) as db:
        cursor = await db.execute(SELECT_TRACKED_JOB, (job_id,))
        row = await cursor.fetchone()
    
    if not row:
        return None
    
    return _row_to_job_dict(row)


async def list_tracked_jobs(
    page: int = 1,
    pageSize: int = 10,
    filters: Optional[Dict] = None,
    search: Optional[str] = None,
    sortBy: str = "created_at",
    sortOrder: str = "desc",
) -> Dict:
    """
    List tracked jobs with filtering, searching, sorting, and pagination.

    Filters supported:
    - status: List of statuses (e.g. ["new", "applied"])
    - min_match_percentage: Minimum match % (e.g. 70)
    - ranking_level: Filter by ranking (e.g. "high")
    """
    filters = filters or {}
    offset = (page - 1) * pageSize
    
    # Build WHERE clauses
    where_parts = []
    params = []
    
    if filters.get("status"):
        status_placeholders = ",".join(["?"] * len(filters["status"]))
        where_parts.append(f"status IN ({status_placeholders})")
        params.extend(filters["status"])
    
    if filters.get("min_match_percentage") is not None:
        where_parts.append(f"match_percentage >= ?")
        params.append(filters["min_match_percentage"])
    
    if filters.get("ranking_level"):
        where_parts.append(f"ranking_level = ?")
        params.append(filters["ranking_level"])
    
    if search:
        where_parts.append(f"(job_title LIKE ? OR company_name LIKE ? OR description LIKE ?)")
        search_term = f"%{search}%"
        params.extend([search_term, search_term, search_term])
    
    filter_sql = "AND " + " AND ".join(where_parts) if where_parts else ""
    
    # Validate sort parameters
    valid_sort_fields = ["created_at", "match_percentage", "job_title", "company_name", "updated_at"]
    sortBy = sortBy if sortBy in valid_sort_fields else "created_at"
    sortOrder = sortOrder if sortOrder.lower() in ["asc", "desc"] else "desc"
    
    # Get total count
    count_sql = SELECT_TRACKED_JOBS_COUNT.format(filters=filter_sql)
    async with aiosqlite.connect(_get_db_path()) as db:
        cursor = await db.execute(count_sql, params)
        count_row = await cursor.fetchone()
        total = count_row[0] if count_row else 0
    
    # Get paginated results
    query_sql = SELECT_ALL_TRACKED_JOBS.format(
        filters=filter_sql,
        sort_by=sortBy,
        sort_order=sortOrder.upper(),
    )
    
    query_params = params + [pageSize, offset]
    
    async with aiosqlite.connect(_get_db_path()) as db:
        cursor = await db.execute(query_sql, query_params)
        rows = await cursor.fetchall()
    
    jobs = [_row_to_job_dict(row) for row in rows]
    
    return {
        "jobs": jobs,
        "total": total,
    }


async def update_tracked_job(job_id: str, updates: Dict) -> Optional[Dict]:
    """Update a tracked job. Can only update metadata, not scores."""
    # Retrieve existing job first
    existing = await get_tracked_job(job_id)
    if not existing:
        return None
    
    # Only allow certain fields to be updated
    allowed_fields = {
        "status", "notes", "application_date", "rejection_date",
        "rejection_reason", "interview_date", "interview_stage",
        "salary_min", "salary_max", "last_viewed_at"
    }
    
    # Filter updates
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not safe_updates:
        return existing
    
    # Build SET clause
    set_parts = [f"{k} = ?" for k in safe_updates.keys()]
    set_sql = ", ".join(set_parts)
    
    # Prepare parameters
    params = list(safe_updates.values())
    now = datetime.utcnow().isoformat()
    params.append(now)
    params.append(job_id)
    
    update_sql = UPDATE_TRACKED_JOB.format(updates=set_sql)
    
    async with aiosqlite.connect(_get_db_path()) as db:
        await db.execute(update_sql, params)
        await db.commit()
    
    logger.info(f"Updated tracked job {job_id}: {safe_updates}")
    
    # Return updated job
    return await get_tracked_job(job_id)


async def delete_tracked_job(job_id: str) -> bool:
    """Delete a tracked job. Returns True if deleted, False if not found."""
    async with aiosqlite.connect(_get_db_path()) as db:
        cursor = await db.execute(DELETE_TRACKED_JOB, (job_id,))
        await db.commit()
        return cursor.rowcount > 0


async def get_job_stats() -> Dict:
    """
    Get dashboard statistics.

    Returns:
    - Total jobs tracked
    - Average match %
    - Breakdown by status and ranking
    - Conversion funnel (new → applied → interviewed → rejected)
    """
    async with aiosqlite.connect(_get_db_path()) as db:
        # Total count
        cursor = await db.execute("SELECT COUNT(*) FROM tracked_jobs")
        total = (await cursor.fetchone())[0]
        
        # Average match %
        cursor = await db.execute("SELECT AVG(match_percentage) FROM tracked_jobs")
        avg_match = (await cursor.fetchone())[0] or 0
        
        # Count by status
        cursor = await db.execute(
            "SELECT status, COUNT(*) FROM tracked_jobs GROUP BY status"
        )
        status_counts = dict(await cursor.fetchall())
        
        # Count by ranking
        cursor = await db.execute(
            "SELECT ranking_level, COUNT(*) FROM tracked_jobs GROUP BY ranking_level"
        )
        ranking_counts = dict(await cursor.fetchall())
        
        # Conversion funnel
        cursor = await db.execute(
            """
            SELECT 
                COALESCE(status, 'unknown') as status, 
                COUNT(*) as count
            FROM tracked_jobs
            WHERE status IN ('new', 'applied', 'interested', 'interviewed', 'rejected')
            GROUP BY status
            ORDER BY status
            """
        )
        funnel_rows = await cursor.fetchall()
        funnel = {row[0]: row[1] for row in funnel_rows}
    
    return {
        "total_jobs": total,
        "average_match_percentage": round(float(avg_match), 1),
        "by_status": status_counts,
        "by_ranking": ranking_counts,
        "funnel": {
            "new": funnel.get("new", 0),
            "applied": funnel.get("applied", 0),
            "interested": funnel.get("interested", 0),
            "interviewed": funnel.get("interviewed", 0),
            "rejected": funnel.get("rejected", 0),
        },
    }
