"""
tests/conftest.py – Shared pytest fixtures.

Uses a temporary file-based SQLite database for each test session.
aiosqlite's :memory: creates a NEW db per connection, so a temp file
ensures tables persist across the multiple connections used by database.py.
"""

import os
import tempfile
import pytest
import pytest_asyncio
import asyncio

# Create a temp DB file BEFORE importing any app code
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db_path = _tmp.name
_tmp.close()

os.environ["DATABASE_URL"] = _tmp_db_path
os.environ["GROQ_API_KEY"] = "test_key_not_real"
os.environ["GROQ_MODEL"] = "llama-3.3-70b-versatile"

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db
from app.config import get_settings


@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Initialize the database tables before each test."""
    # Clear the settings cache so env vars take effect
    get_settings.cache_clear()
    await init_db()
    yield


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing FastAPI endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def pytest_sessionfinish(session, exitstatus):
    """Clean up the temp database file after all tests."""
    try:
        os.unlink(_tmp_db_path)
    except OSError:
        pass
