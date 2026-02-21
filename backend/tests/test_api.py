"""
tests/test_api.py – Tests for FastAPI endpoints.

Tests the HTTP interface without calling the real LLM — 
validates request validation, profile CRUD, and health check.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Health endpoint should return OK."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "linkedin-ai-copilot"


@pytest.mark.asyncio
async def test_get_profile_empty(client: AsyncClient):
    """GET /profile should return null when no profile exists."""
    resp = await client.get("/profile")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_put_and_get_profile(client: AsyncClient):
    """PUT /profile should save and return the profile."""
    resp = await client.put("/profile", json={
        "name": "API Test User",
        "skills": ["Python", "TypeScript"],
        "experience": "4 years",
        "summary": "Full-stack developer",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "API Test User"
    assert "Python" in data["skills"]

    # Verify GET returns the same data
    resp = await client.get("/profile")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "API Test User"


@pytest.mark.asyncio
async def test_comment_validation_too_short(client: AsyncClient):
    """POST /generate-comment with text too short should return 422."""
    resp = await client.post("/generate-comment", json={"post_text": "Hi"})
    assert resp.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_job_analysis_validation_too_short(client: AsyncClient):
    """POST /analyze-job with text too short should return 422."""
    resp = await client.post("/analyze-job", json={"job_text": "Short"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_profile_validation(client: AsyncClient):
    """POST /analyze-profile with text too short should return 422."""
    resp = await client.post("/analyze-profile", json={"raw_text": "Hi"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_enhance_profile_validation(client: AsyncClient):
    """POST /enhance-profile with text too short should return 422."""
    resp = await client.post("/enhance-profile", json={"raw_text": "Short"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_batch_score_validation_empty(client: AsyncClient):
    """POST /jobs/batch-score-jobs with empty jobs should return 422."""
    resp = await client.post("/jobs/batch-score-jobs", json={
        "jobs": [],
        "user_profile": {"skills": [], "experience": "", "target_role": ""},
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_track_job_via_api(client: AsyncClient):
    """POST /jobs/track should save a job and return success."""
    resp = await client.post("/jobs/track", json={
        "job_title": "API Test Job",
        "company_name": "TestCo",
        "match_percentage": 75,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["job"]["job_title"] == "API Test Job"


@pytest.mark.asyncio
async def test_list_jobs_via_api(client: AsyncClient):
    """GET /jobs/ should return paginated results."""
    resp = await client.get("/jobs/")
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data
    assert "total" in data
