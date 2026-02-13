"""
main.py – FastAPI application entry point.

Sets up CORS, includes routers, initializes the database,
and provides a health check endpoint.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db, get_user_profile, save_user_profile
from .models import UserProfile, UserProfileUpdate
from .routers import comments, jobs

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─── Lifespan (startup / shutdown) ──────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, cleanup on shutdown."""
    logger.info("🚀 LinkedIn AI Copilot backend starting up…")
    await init_db()
    yield
    logger.info("👋 Backend shutting down.")


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LinkedIn AI Copilot",
    description="Personal AI-powered LinkedIn assistant – Comment & Job analysis modes.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow requests from Chrome extension and local dev
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for MVP; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(comments.router)
app.include_router(jobs.router)


# ─── Utility Endpoints ──────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "linkedin-ai-copilot"}


@app.get("/profile", response_model=UserProfile | None)
async def read_profile():
    """Retrieve the stored user profile."""
    return await get_user_profile()


@app.put("/profile", response_model=UserProfile)
async def update_profile(update: UserProfileUpdate):
    """Create or update the user profile."""
    existing = await get_user_profile()
    profile = UserProfile(
        name=update.name if update.name is not None else (existing.name if existing else ""),
        skills=update.skills if update.skills is not None else (existing.skills if existing else []),
        experience=update.experience if update.experience is not None else (existing.experience if existing else ""),
        summary=update.summary if update.summary is not None else (existing.summary if existing else ""),
    )
    return await save_user_profile(profile)


@app.post("/analyze-profile")
async def analyze_profile(data: dict):
    """Analyze raw LinkedIn profile text with AI and return structured data."""
    from .services import analyze_profile_text
    raw_text = data.get("raw_text", "")
    if not raw_text or len(raw_text) < 20:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Not enough profile text to analyze.")
    return await analyze_profile_text(raw_text)


@app.post("/enhance-profile")
async def enhance_profile(data: dict):
    """Get AI-powered suggestions to improve a LinkedIn profile."""
    from .services import enhance_profile_text
    raw_text = data.get("raw_text", "")
    if not raw_text or len(raw_text) < 20:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Not enough profile text to enhance.")
    return await enhance_profile_text(raw_text)


