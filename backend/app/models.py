"""
models.py – Pydantic request / response schemas.

Defines the data contracts for both Comment Mode and Job Mode endpoints.
All fields are validated automatically by FastAPI.
"""

from pydantic import BaseModel, Field, field_validator
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


# ─── Profile Enhancement Mode ────────────────────────────────────────────────

class HeadlineOptimization(BaseModel):
    """Optimized headline with detailed reasoning."""
    current_headline: str = Field(..., description="Current headline from profile")
    optimized_headline: str = Field(..., description="Rewritten, high-impact headline (max 120 chars)")
    why_stronger: str = Field(..., description="Specific explanation of why it's more compelling")
    keyword_suggestions: list[str] = Field(default_factory=list, description="Keywords to incorporate for SEO")
    char_count: int = Field(0, description="Character count of optimized headline")


class AboutSectionEnhancement(BaseModel):
    """Enhanced About section with positioning and authority."""
    current_about: str = Field(..., description="Current About section")
    optimized_about: str = Field(..., description="Rewritten About section (3-4 paragraphs)")
    positioning_statement: str = Field(..., description="Clear, one-sentence positioning statement")
    authority_elements: list[str] = Field(default_factory=list, description="Authority signals included (credibility, depth, impact)")
    structure_explanation: str = Field(..., description="Explanation of how structure follows hook → expertise → impact → vision")


class ExperienceImprovement(BaseModel):
    """Improved experience bullet point."""
    original: str = Field(..., description="Original bullet point from experience")
    improved: str = Field(..., description="Impact-driven rewrite with metrics where possible")
    improvement_reason: str = Field(..., description="Why this is stronger (leadership, ownership, technical depth)")
    metrics_added: Optional[str] = Field(None, description="Metrics or quantifiable results added")


class ExperienceSectionImprovements(BaseModel):
    """Complete experience section improvements."""
    improvements: list[ExperienceImprovement] = Field(default_factory=list, description="Individual bullet point improvements")
    missing_details: list[str] = Field(default_factory=list, description="Suggested missing details to add")
    overall_feedback: str = Field(..., description="Overall feedback on impact and positioning in experience")


class SkillsStrategy(BaseModel):
    """Strategic recommendations for skills section."""
    current_skills: list[str] = Field(default_factory=list, description="Skills currently on profile")
    recommended_additions: list[str] = Field(default_factory=list, description="High-value skills to add (tailored to target role)")
    suggested_ordering_strategy: str = Field(..., description="Strategy for ordering skills for maximum impact")
    niche_positioning: list[str] = Field(default_factory=list, description="Niche/specialized skills that differentiate from competitors")
    skills_to_deemphasize: list[str] = Field(default_factory=list, description="Generic skills that don't align with target role")


class RecruiterOptimization(BaseModel):
    """Keywords and positioning for recruiter discoverability."""
    high_value_keywords: list[str] = Field(default_factory=list, description="Keywords recruiters search for (ATS-optimized)")
    suggested_positioning: str = Field(..., description="How to position profile for optimal recruiter discovery")
    search_terms_to_include: list[str] = Field(default_factory=list, description="Specific search terms and phrases to naturally incorporate")
    visibility_recommendations: list[str] = Field(default_factory=list, description="Actions to improve recruiter visibility")


class DifferentiationAnalysis(BaseModel):
    """Analysis of what makes profile stand out."""
    tone_consistency: str = Field(..., description="Analysis of tone consistency across profile")
    differentiation_factors: list[str] = Field(default_factory=list, description="What makes this profile unique vs competitors")
    authority_signals: list[str] = Field(default_factory=list, description="Authority signals currently present")
    competitive_advantages: list[str] = Field(default_factory=list, description="Competitive advantages to emphasize")


class ProfileEnhancementScore(BaseModel):
    """Overall profile score and priorities."""
    score_out_of_10: float = Field(0, ge=0, le=10, description="Overall profile score (0-10)")
    score_breakdown: dict = Field(default_factory=dict, description="Breakdown by section (headline, about, experience, skills, etc.)")
    top_3_priorities: list[str] = Field(default_factory=list, description="Top 3 improvement priorities, ranked by impact")
    weeks_to_expert_profile: int = Field(4, description="Estimated weeks to transform profile to expert level")


class ProfileEnhancementRequest(BaseModel):
    """Request for comprehensive profile enhancement."""
    current_headline: str = Field(..., min_length=5, max_length=220, description="Current LinkedIn headline")
    about_section: str = Field(..., min_length=20, max_length=2600, description="Current About section text")
    experience_descriptions: list[str] = Field(
        default_factory=list, 
        max_items=20,
        description="List of experience bullet points or descriptions (max 20 items, 2000 chars each)"
    )
    current_skills: list[str] = Field(
        default_factory=list, 
        max_items=100,
        description="Current skills listed on profile (max 100 items)"
    )
    featured_section: Optional[str] = Field(None, description="Featured section content (projects, articles, etc.)")
    target_role: str = Field(..., min_length=5, max_length=220, description="Target role (e.g., 'Python Backend Developer', 'AI Engineer')")
    years_of_experience: int = Field(..., ge=0, le=60, description="Total years of professional experience")
    industry: Optional[str] = Field(None, max_length=1000, description="Current/target industry (e.g., 'FinTech', 'SaaS')")
    company_experience: Optional[str] = Field(None, max_length=1000, description="Company types worked at (startups, FAANG, etc.)")
    
    @field_validator('experience_descriptions')
    @classmethod
    def validate_experience_descriptions(cls, v):
        """Ensure each experience description is max 2000 characters."""
        if not isinstance(v, list):
            return v
        for i, exp in enumerate(v):
            if len(exp) > 2000:
                raise ValueError(f"Experience description {i+1} exceeds 2000 character limit (got {len(exp)} chars)")
        return v


class ProfileEnhancementResponse(BaseModel):
    """Comprehensive profile enhancement response."""
    headline_optimization: HeadlineOptimization
    about_section_enhancement: AboutSectionEnhancement
    experience_improvements: ExperienceSectionImprovements
    skills_strategy: SkillsStrategy
    recruiter_optimization: RecruiterOptimization
    differentiation_analysis: DifferentiationAnalysis
    overall_score: ProfileEnhancementScore
    executive_summary: str = Field(..., description="2-3 sentence summary of key opportunities and recommendations")


# ─── Batch Scoring ───────────────────────────────────────────────────────────

class BatchJobItem(BaseModel):
    """A single job to be scored in a batch request."""
    job_id: str = Field(..., min_length=1, description="Unique job identifier")
    job_title: str = Field(..., min_length=1, description="Job title")
    company_name: str = Field("", description="Company name")
    location: str = Field("", description="Job location")
    description: str = Field("", description="Job description text")


class BatchUserProfile(BaseModel):
    """User profile info for batch scoring context."""
    skills: list[str] = Field(default_factory=list)
    experience: str = ""
    target_role: str = ""


class BatchScoreRequest(BaseModel):
    """Request to score multiple jobs against a user profile."""
    jobs: list[BatchJobItem] = Field(..., min_length=1, max_length=50, description="Jobs to score (max 50)")
    user_profile: BatchUserProfile = Field(default_factory=BatchUserProfile)
    quick_mode: bool = Field(False, description="If true, use faster/cheaper scoring")


# ─── Job Tracking ────────────────────────────────────────────────────────────

class TrackJobRequest(BaseModel):
    """Request to save an analyzed job to the tracking dashboard."""
    job_id: Optional[str] = None
    job_title: str = Field(..., min_length=1, description="Job title")
    company_name: str = Field(..., min_length=1, description="Company name")
    location: str = ""
    description: str = ""
    job_url: str = ""
    source_linkedin_id: Optional[str] = None
    match_percentage: int = Field(0, ge=0, le=100)
    ranking_level: str = "low"
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    status: str = "new"
    source: str = "manual"


class JobUpdateRequest(BaseModel):
    """Allowed fields for updating a tracked job."""
    status: Optional[str] = None
    notes: Optional[str] = None
    application_date: Optional[str] = None
    rejection_date: Optional[str] = None
    rejection_reason: Optional[str] = None
    interview_date: Optional[str] = None
    interview_stage: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None


class BatchSaveJobsRequest(BaseModel):
    """Request to bulk-save multiple jobs."""
    jobs: list[TrackJobRequest] = Field(..., min_length=1, max_length=100, description="Jobs to save (max 100)")


# ─── Profile Analysis ────────────────────────────────────────────────────────

class ProfileAnalysisRequest(BaseModel):
    """Request to analyze raw LinkedIn profile text."""
    raw_text: str = Field(..., min_length=20, description="Raw LinkedIn profile text to analyze")


class ProfileEnhanceRequest(BaseModel):
    """Request to get AI-powered profile improvement suggestions."""
    raw_text: str = Field(..., min_length=20, description="Raw LinkedIn profile text to enhance")

