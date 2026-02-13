"""
routers/jobs.py – Job Mode endpoint.

POST /analyze-job
Accepts a job description and user profile, returns skill analysis,
personalized note, resume tips, and similar roles.
"""

import logging
from fastapi import APIRouter, HTTPException

from ..models import JobAnalysisRequest, JobAnalysisResponse
from ..services import analyze_job
from ..database import get_user_profile

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Job Mode"])


@router.post("/analyze-job", response_model=JobAnalysisResponse)
async def analyze_job_posting(request: JobAnalysisRequest):
    """
    Analyze a LinkedIn job posting against the user's profile.

    If user_skills or user_experience are not provided in the request,
    falls back to the stored user profile from the database.
    """
    logger.info("Analyzing job posting (%d chars)", len(request.job_text))

    # Merge with stored profile if request fields are empty
    user_skills = request.user_skills
    user_experience = request.user_experience

    if not user_skills or not user_experience:
        stored_profile = await get_user_profile()
        if stored_profile:
            if not user_skills:
                user_skills = stored_profile.skills
            if not user_experience:
                user_experience = stored_profile.experience
            logger.info("Merged request with stored user profile")

    try:
        result = await analyze_job(
            job_text=request.job_text,
            user_skills=user_skills,
            user_experience=user_experience,
        )
        return result
    except ValueError as e:
        logger.warning("Job analysis failed: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error in job analysis: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze job posting. Please check your API key and try again.",
        )
