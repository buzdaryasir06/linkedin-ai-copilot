"""
models.py – Pydantic request / response schemas.

Defines the data contracts for both Comment Mode and Job Mode endpoints.
All fields are validated automatically by FastAPI.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ─── Comment Mode ────────────────────────────────────────────────────────────

class CommentRequest(BaseModel):
    """Incoming request to generate LinkedIn comment suggestions."""
    post_text: str = Field(..., min_length=10, description="The LinkedIn post text to comment on")
    tone: Optional[str] = Field(None, description="Optional tone preference: supportive, professional, casual")


class CommentSuggestion(BaseModel):
    """A single AI-generated comment suggestion."""
    style: str = Field(..., description="Comment style: authority, question, or strategic")
    comment: str = Field(..., description="The generated comment text")


class CommentResponse(BaseModel):
    """Response containing 3 comment suggestions."""
    post_text: str
    comments: list[CommentSuggestion]


# ─── Job Mode ────────────────────────────────────────────────────────────────

class JobAnalysisRequest(BaseModel):
    """Incoming request to analyze a LinkedIn job posting."""
    job_text: str = Field(..., min_length=10, description="The job posting text or description")
    user_skills: list[str] = Field(default_factory=list, description="User's current skills")
    user_experience: str = Field("", description="Brief summary of user's experience")


class JobAnalysisResponse(BaseModel):
    """Structured analysis of a job posting against user's profile."""
    matched_skills: list[str] = Field(default_factory=list, description="Skills the user already has")
    missing_skills: list[str] = Field(default_factory=list, description="Skills the user should acquire")
    match_percentage: int = Field(0, ge=0, le=100, description="Overall skill match percentage")
    personalized_note: str = Field("", description="AI-generated personalized application note")
    resume_tips: list[str] = Field(default_factory=list, description="Specific resume improvement suggestions")
    similar_roles: list[str] = Field(default_factory=list, description="Similar job titles to explore")


# ─── User Profile (for SQLite storage) ───────────────────────────────────────

class UserProfile(BaseModel):
    """User profile stored locally for personalization."""
    id: Optional[int] = None
    name: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: str = ""
    summary: str = ""


class UserProfileUpdate(BaseModel):
    """Partial update for user profile."""
    name: Optional[str] = None
    skills: Optional[list[str]] = None
    experience: Optional[str] = None
    summary: Optional[str] = None
