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
        raise ValueError(f"AI returned an invalid JSON response. Raw: {raw}") from e

    if not isinstance(data, dict):
        logger.error("LLM response is not a dict: %s. Raw: %s", type(data), raw)
        raise ValueError(f"Expected JSON object (dict), got {type(data).__name__}. Raw: {raw}")

    if expected_keys:
        missing_keys = expected_keys - set(data.keys())
        if missing_keys:
            logger.error("LLM response missing keys: %s. Present keys: %s. Raw: %s", missing_keys, list(data.keys()), raw)
            raise ValueError(
                f"LLM response is missing required keys: {', '.join(sorted(missing_keys))}. "
                f"Expected keys: {', '.join(sorted(expected_keys))}. Raw: {raw}"
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
    
    # Use higher temperature for creativity in rewrites, but still structured
    # Use max_tokens=8000 for comprehensive response
    data = await _call_llm(
        messages,
        temperature=0.5,
        max_tokens=8000,
        expected_keys=expected_keys,
    )
    
    logger.info("Profile enhancement completed for target role: %s", target_role)
    return ProfileEnhancementResponse(**data)


