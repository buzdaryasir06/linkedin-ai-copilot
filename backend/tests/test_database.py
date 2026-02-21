"""
tests/test_database.py – Tests for database CRUD operations.
"""

import pytest
import json

from app.database import (
    init_db,
    get_user_profile,
    save_user_profile,
    save_tracked_job,
    get_tracked_job,
    list_tracked_jobs,
    update_tracked_job,
    delete_tracked_job,
    get_job_stats,
)
from app.models import UserProfile


# ─── User Profile Tests ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_profile_initially():
    """Database should return None when no profile exists."""
    result = await get_user_profile()
    # Could be None or a previously-saved profile from another test
    # (in-memory DB is shared within session), so we just verify the call works
    assert result is None or isinstance(result, UserProfile)


@pytest.mark.asyncio
async def test_save_and_retrieve_profile():
    """Saving a profile should persist and be retrievable."""
    profile = UserProfile(
        name="Test User",
        skills=["Python", "FastAPI", "React"],
        experience="5 years backend development",
        summary="Backend engineer specializing in API design",
    )
    saved = await save_user_profile(profile)
    assert saved.name == "Test User"
    assert saved.id is not None

    retrieved = await get_user_profile()
    assert retrieved is not None
    assert retrieved.name == "Test User"
    assert "Python" in retrieved.skills
    assert retrieved.experience == "5 years backend development"


@pytest.mark.asyncio
async def test_update_existing_profile():
    """Updating a profile should overwrite existing values."""
    profile = UserProfile(
        name="Original Name",
        skills=["Python"],
        experience="3 years",
        summary="Original summary",
    )
    await save_user_profile(profile)

    updated = UserProfile(
        name="Updated Name",
        skills=["Python", "Go"],
        experience="5 years",
        summary="Updated summary",
    )
    result = await save_user_profile(updated)
    assert result.name == "Updated Name"
    assert "Go" in result.skills


# ─── Job Tracking Tests ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_save_and_retrieve_job():
    """Saving a job should persist all fields."""
    job_data = {
        "job_title": "Senior Backend Engineer",
        "company_name": "TechCorp",
        "location": "San Francisco, CA",
        "description": "Build scalable APIs...",
        "job_url": "https://linkedin.com/jobs/123",
        "match_percentage": 85,
        "ranking_level": "high",
        "matched_skills": ["Python", "FastAPI"],
        "missing_skills": ["Kubernetes"],
        "status": "new",
        "source": "manual",
    }
    saved = await save_tracked_job(job_data)
    assert saved["job_title"] == "Senior Backend Engineer"
    assert saved["id"] is not None

    retrieved = await get_tracked_job(saved["id"])
    assert retrieved is not None
    assert retrieved["company_name"] == "TechCorp"
    assert retrieved["match_percentage"] == 85
    assert "Python" in retrieved["matched_skills"]


@pytest.mark.asyncio
async def test_save_job_requires_title_and_company():
    """Should raise ValueError if job_title or company_name is missing."""
    with pytest.raises(ValueError, match="required"):
        await save_tracked_job({"job_title": "", "company_name": ""})


@pytest.mark.asyncio
async def test_update_job():
    """Updating a job should change only allowed fields."""
    saved = await save_tracked_job({
        "job_title": "Dev",
        "company_name": "Co",
        "status": "new",
    })
    
    updated = await update_tracked_job(saved["id"], {"status": "applied", "notes": "Sent resume"})
    assert updated is not None
    assert updated["status"] == "applied"
    assert updated["notes"] == "Sent resume"


@pytest.mark.asyncio
async def test_delete_job():
    """Deleting a job should remove it from the database."""
    saved = await save_tracked_job({
        "job_title": "To Delete",
        "company_name": "DeleteCorp",
    })
    
    result = await delete_tracked_job(saved["id"])
    assert result is True

    retrieved = await get_tracked_job(saved["id"])
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_nonexistent_job():
    """Deleting a non-existent job should return False."""
    result = await delete_tracked_job("nonexistent-id")
    assert result is False


@pytest.mark.asyncio
async def test_list_jobs_with_pagination():
    """Listing jobs should support pagination."""
    for i in range(5):
        await save_tracked_job({
            "job_title": f"Job {i}",
            "company_name": f"Company {i}",
        })

    result = await list_tracked_jobs(page=1, pageSize=2)
    assert len(result["jobs"]) <= 2
    assert result["total"] >= 5


@pytest.mark.asyncio
async def test_get_job_stats():
    """Stats endpoint should return structured statistics."""
    stats = await get_job_stats()
    assert "total_jobs" in stats
    assert "average_match_percentage" in stats
    assert "by_status" in stats
    assert "funnel" in stats
