"""
database.py – SQLite storage for user profile (MVP).

Uses aiosqlite for async database operations.
Stores a single user profile row for personalization in Job Mode.
"""

import json
import logging
import aiosqlite

from .config import get_settings
from .models import UserProfile

logger = logging.getLogger(__name__)

# SQL statements
CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '[]',
    experience TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT ''
);
"""

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


def _get_db_path() -> str:
    """Return the SQLite database file path."""
    return get_settings().database_url


async def init_db() -> None:
    """Create the user_profile table if it doesn't exist."""
    async with aiosqlite.connect(_get_db_path()) as db:
        await db.execute(CREATE_TABLE)
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
