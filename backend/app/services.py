"""
services.py – Groq integration for generating comments and analyzing jobs.

Uses the OpenAI-compatible Groq API with Llama 3.3 70B model.
Groq provides a generous free tier (30 requests/minute).
"""

import json
import logging
from openai import AsyncOpenAI

from .config import get_settings
from .prompts import build_comment_prompt, build_job_analysis_prompt, build_profile_enhancement_prompt
from .models import CommentSuggestion, JobAnalysisResponse, ProfileEnhancementResponse

logger = logging.getLogger(__name__)


def _get_client() -> AsyncOpenAI:
    """Create an AsyncOpenAI client pointed at Groq's API."""
    settings = get_settings()
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )


def _sanitize_raw(raw: str, max_length: int = 100) -> str:
    """Sanitize raw LLM response for error messages to avoid PII leakage."""
    if not raw:
        return "Empty response"
    if len(raw) <= max_length:
        return raw
    return f"{raw[:max_length]}... [truncated/redacted]"


async def _call_llm(
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 1024,
    expected_keys: set[str] | None = None,
) -> dict:
    """
    Send messages to Groq and parse the JSON response.

    Args:
        messages: Chat messages to send.
        temperature: Controls randomness. 0 = deterministic, 1 = creative.
        max_tokens: Maximum tokens in the response.
        expected_keys: Optional set of keys that must be present in the JSON response.

    Raises ValueError if the response is not valid JSON or missing expected keys.
    """
    settings = get_settings()
    client = _get_client()

    logger.info("Calling Groq model=%s (temp=%.1f, max_tokens=%d)", settings.groq_model, temperature, max_tokens)

    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    logger.debug("LLM raw response: %s", raw[:200])

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s. Raw response: %s", e, raw)
        raise ValueError(f"AI returned an invalid JSON response. Raw (truncated): {_sanitize_raw(raw)}") from e

    if not isinstance(data, dict):
        logger.error("LLM response is not a dict: %s. Raw: %s", type(data), raw)
        raise ValueError(f"Expected JSON object (dict), got {type(data).__name__}. Raw (redacted): <redacted>")

    if expected_keys:
        missing_keys = expected_keys - set(data.keys())
        if missing_keys:
            logger.error("LLM response missing keys: %s. Present keys: %s. Raw: %s", missing_keys, list(data.keys()), raw)
            raise ValueError(
                f"LLM response is missing required keys: {', '.join(sorted(missing_keys))}. "
                f"Expected keys: {', '.join(sorted(expected_keys))}. Raw (truncated): {_sanitize_raw(raw)}"
            )

    return data


async def generate_comments(post_text: str, tone: str | None = None) -> list[CommentSuggestion]:
    """
    Generate 3 LinkedIn comment suggestions for a given post.
    """
    messages = build_comment_prompt(post_text, tone)
    # Validate that it returns 'comments' key
    data = await _call_llm(messages, expected_keys={"comments"})

    comments = data.get("comments", [])
    if not comments:
        # Fallback if the list is empty despite key presence
        raise ValueError("AI did not return any comments.")

    return [CommentSuggestion(**c) for c in comments[:5]]


async def analyze_job(
    job_text: str,
    user_skills: list[str],
    user_experience: str,
) -> JobAnalysisResponse:
    """
    Analyze a job posting against the user's profile.
    """
    messages = build_job_analysis_prompt(job_text, user_skills, user_experience)
    # The JobAnalysisResponse model expects these keys matching the prompt
    expected_keys = {"matched_skills", "missing_skills", "match_percentage", "personalized_note", "resume_tips", "similar_roles"}
    data = await _call_llm(messages, expected_keys=expected_keys)

    return JobAnalysisResponse(**data)


async def analyze_profile_text(raw_text: str) -> dict:
    """
    Analyze raw LinkedIn profile text and extract structured profile data.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a profile analyzer. Extract structured information from LinkedIn profile text. "
                "Return clean, organized data. Be concise and accurate."
            ),
        },
        {
            "role": "user",
            "content": f"""Extract the following from this LinkedIn profile text and return as JSON:

1. **name** – Full name of the person
2. **skills** – List of technical and professional skills (as an array of strings, max 15)
3. **experience** – A 1-2 sentence summary of their professional experience (years, roles, industries)
4. **summary** – A 2-3 sentence professional bio based on their profile

LinkedIn Profile Text:
\"\"\"
{raw_text[:2500]}
\"\"\"

Respond with ONLY valid JSON:
{{
  "name": "...",
  "skills": ["skill1", "skill2", "..."],
  "experience": "...",
  "summary": "..."
}}""",
        },
    ]

    expected_keys = {"name", "skills", "experience", "summary"}
    data = await _call_llm(messages, expected_keys=expected_keys)
    return data


async def enhance_profile_text(raw_text: str) -> dict:
    """
    Analyze a LinkedIn profile and return enhancement suggestions.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a LinkedIn profile optimization expert and personal branding coach. "
                "You help professionals make their LinkedIn profiles stand out to recruiters, "
                "clients, and connections. Be specific, actionable, and encouraging."
            ),
        },
        {
            "role": "user",
            "content": f"""Analyze this LinkedIn profile and provide specific improvement suggestions.

LinkedIn Profile:
\"\"\"
{raw_text[:2500]}
\"\"\"

Provide a comprehensive profile review with:
1. **profile_score** – Rate the profile out of 100 based on completeness, clarity, and impact.
2. **headline_suggestion** – Write a better, more compelling headline (max 120 chars). If it's already great, explain why.
3. **about_rewrite** – Write an improved About section (3-4 paragraphs) that tells their story, highlights achievements, and includes a call-to-action. Make it sound human, not corporate.
4. **skills_to_add** – List 5-8 skills they should add to their profile based on their experience.
5. **tips** – 4-6 specific, actionable tips to improve their overall LinkedIn presence (not just profile text — include activity, engagement, networking advice).

Respond with ONLY valid JSON:
{{
  "profile_score": 65,
  "headline_suggestion": "...",
  "about_rewrite": "...",
  "skills_to_add": ["skill1", "skill2"],
  "tips": ["tip1", "tip2", "tip3", "tip4"]
}}""",
        },
    ]

    # Use max_tokens=4096 for this longer response and validate required keys
    required_keys = {"profile_score", "headline_suggestion", "about_rewrite", "skills_to_add", "tips"}
    data = await _call_llm(messages, temperature=0, max_tokens=4096, expected_keys=required_keys)

    return data


async def enhance_profile(
    current_headline: str,
    about_section: str,
    experience_descriptions: list[str],
    current_skills: list[str],
    target_role: str,
    years_of_experience: int,
    featured_section: str | None = None,
    industry: str | None = None,
    company_experience: str | None = None,
) -> ProfileEnhancementResponse:
    """
    Comprehensive profile enhancement with structured, actionable, high-impact suggestions.
    
    Returns detailed optimization across:
    - Headline optimization with keyword suggestions
    - About section enhancement with positioning and authority
    - Experience section improvements with metrics and leadership focus
    - Skills strategy with niche positioning
    - Recruiter optimization for discoverability
    - Differentiation analysis for competitive positioning
    - Overall profile score with ranked priorities
    
    All suggestions are specific, rewritten examples with clear reasoning.
    Tailored to the target role with focus on standing out in AI/Backend markets.
    """
    messages = build_profile_enhancement_prompt(
        current_headline=current_headline,
        about_section=about_section,
        experience_descriptions=experience_descriptions,
        current_skills=current_skills,
        featured_section=featured_section,
        target_role=target_role,
        years_of_experience=years_of_experience,
        industry=industry,
        company_experience=company_experience,
    )
    
    # Expected keys from the comprehensive profile enhancement prompt
    expected_keys = {
        "headline_optimization",
        "about_section_enhancement",
        "experience_improvements",
        "skills_strategy",
        "recruiter_optimization",
        "differentiation_analysis",
        "overall_score",
        "executive_summary",
    }
    
    # Use balanced temperature (0.5) for consistency + structured output
    # Lower than default (0.7) prioritizes deterministic rewrites
    # Use max_tokens=8000 for comprehensive response
    data = await _call_llm(
        messages,
        temperature=0.5,
        max_tokens=8000,
        expected_keys=expected_keys,
    )
    
    logger.info("Profile enhancement completed for target role: %s", target_role)
    return ProfileEnhancementResponse(**data)


# ─── Batch Job Matching (v2.0) ────────────────────────────────────────────────

async def match_jobs_batch_service(
    jobs: list[dict],
    user_profile: dict,
    quick_mode: bool = False,
) -> list[dict]:
    """
    Score multiple jobs against user profile in batch for LinkedIn job page scanning.

    Fast scoring for real-time overlay feedback on job search results.
    Processes jobs in parallel for < 5s batch time (50 jobs).

    Args:
        jobs: List of job objects with job_title, company_name, description, location, etc.
        user_profile: {skills: [], experience: str, target_role: str, ...}
        quick_mode: If True, use faster deterministic scoring; if False, use LLM

    Returns:
        List of scored jobs with match_percentage, ranking_level, matched/missing skills
    """
    if not jobs:
        return []

    # In quick_mode, use deterministic heuristic scoring (fast, good for UX feedback)
    # In normal mode, use LLM-based scoring (slower but more accurate)
    
    if quick_mode:
        logger.info(f"[Batch Scorer] Quick mode: scoring {len(jobs)} jobs with heuristics")
        results = []
        for job in jobs:
            score = _score_job_heuristic(job, user_profile)
            results.append(score)
        return results
    else:
        logger.info(f"[Batch Scorer] Normal mode: scoring {len(jobs)} jobs with LLM (parallel)")
        # Use asyncio.gather to score jobs in parallel to meet the < 5s performance claim
        import asyncio
        tasks = [_score_job_llm(job, user_profile) for job in jobs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and log them
        valid_results = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(f"[Batch Scorer] Error scoring job {jobs[i].get('job_id', 'unknown')}: {res}")
                # Add a failed result placeholder
                valid_results.append({
                    "job_id": jobs[i].get("job_id"),
                    "match_score": 0,
                    "ranking_level": "none",
                    "matched_skills": [],
                    "missing_skills": [],
                    "summary": "Error during AI scoring",
                    "error": str(res)
                })
            else:
                valid_results.append(res)
        return valid_results


def _score_job_heuristic(job: dict, user_profile: dict) -> dict:
    """
    Fast heuristic scoring without LLM calls.

    Scores based on:
    - Skill keyword matching (exact match in description)
    - Job title alignment with target role
    - Location preference
    """
    job_id = job.get("job_id", "unknown")
    job_title = job.get("job_title", "").lower()
    description = job.get("description", "").lower()
    company = job.get("company_name", "")
    
    user_skills = [s.lower() for s in user_profile.get("skills", [])]
    target_role = user_profile.get("target_role", "").lower()
    experience = user_profile.get("experience", "").lower()
    
    # 1. Skill matching (max 50 points)
    matched_skills = []
    skill_score = 0
    for skill in user_skills:
        if skill in description or skill in job_title:
            matched_skills.append(skill)
            skill_score += 10  # 10 points per matched skill, max 50
    skill_score = min(skill_score, 50)
    
    # 2. Target role alignment (max 30 points)
    role_score = 0
    if target_role and target_role in job_title:
        role_score = 30
    elif target_role and target_role in description[:500]:  # Check first 500 chars
        role_score = 15
    
    # 3. Experience level alignment (max 20 points)
    exp_score = 0
    years_keywords = ["senior", "lead", "staff", "principal", "junior", "entry"]
    job_title_lower = job_title.lower()
    experience_lower = experience.lower()
    for keyword in years_keywords:
        keyword_lower = keyword.lower()
        in_title = keyword_lower in job_title_lower
        in_experience = keyword_lower in experience_lower
        if in_title and in_experience:
            exp_score += 10  # Full points when in both
        elif in_title or in_experience:
            exp_score += 5   # Partial points when in only one
    exp_score = min(exp_score, 20)
    
    # Total score
    total_score = skill_score + role_score + exp_score
    
    # Find missing skills (skills NOT in description AND NOT in job_title)
    missing_skills = [s for s in user_skills if s not in description and s not in job_title]
    
    # Ranking logic
    if total_score >= 70:
        ranking = "high"
    elif total_score >= 50:
        ranking = "medium"
    else:
        ranking = "low"
    
    return {
        "job_id": job_id,
        "match_score": total_score,
        "ranking_level": ranking,
        "matched_skills": matched_skills[:5],  # Top 5
        "missing_skills": missing_skills[:5],  # Top 5 missing
        "summary": f"{total_score}% match - {len(matched_skills)} skills match, {ranking} fit",
    }


async def _score_job_llm(job: dict, user_profile: dict) -> dict:
    """
    LLM-based job scoring for higher accuracy.

    Uses structured prompt to get match %, ranking, and skill analysis.
    """
    from .prompts import build_job_batch_scoring_prompt
    
    messages = build_job_batch_scoring_prompt(job, user_profile)
    
    expected_keys = {"match_percentage", "ranking_level", "matched_skills", "missing_skills", "summary"}
    
    # Lower temperature for consistent scoring
    data = await _call_llm(
        messages,
        temperature=0.3,
        max_tokens=500,
        expected_keys=expected_keys,
    )
    
    # Ensure proper types
    data["job_id"] = job.get("job_id")
    data["match_score"] = min(100, max(0, data.get("match_percentage", 50)))
    data["matched_skills"] = data.get("matched_skills", [])[:5]
    data["missing_skills"] = data.get("missing_skills", [])[:5]
    
    return data


