"""
services.py – Groq integration for generating comments and analyzing jobs.

Uses the OpenAI-compatible Groq API with Llama 3.3 70B model.
Groq provides a generous free tier (30 requests/minute).
"""

import json
import logging
from openai import AsyncOpenAI

from .config import get_settings
from .prompts import build_comment_prompt, build_job_analysis_prompt
from .models import CommentSuggestion, JobAnalysisResponse

logger = logging.getLogger(__name__)


def _get_client() -> AsyncOpenAI:
    """Create an AsyncOpenAI client pointed at Groq's API."""
    settings = get_settings()
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )


async def _call_llm(messages: list[dict]) -> dict:
    """
    Send messages to Groq and parse the JSON response.

    Raises ValueError if the response is not valid JSON.
    """
    settings = get_settings()
    client = _get_client()

    logger.info("Calling Groq model=%s", settings.groq_model)

    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    logger.debug("LLM raw response: %s", raw[:200])

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s", e)
        raise ValueError("AI returned an invalid response. Please try again.") from e


async def generate_comments(post_text: str, tone: str | None = None) -> list[CommentSuggestion]:
    """
    Generate 3 LinkedIn comment suggestions for a given post.

    Args:
        post_text: The LinkedIn post text to comment on.
        tone: Optional tone preference (supportive, professional, casual).

    Returns:
        List of 3 CommentSuggestion objects.
    """
    messages = build_comment_prompt(post_text, tone)
    data = await _call_llm(messages)

    comments = data.get("comments", [])
    if not comments:
        raise ValueError("AI did not return any comments.")

    return [CommentSuggestion(**c) for c in comments[:5]]


async def analyze_job(
    job_text: str,
    user_skills: list[str],
    user_experience: str,
) -> JobAnalysisResponse:
    """
    Analyze a job posting against the user's profile.

    Args:
        job_text: The job posting description.
        user_skills: List of user's current skills.
        user_experience: Brief experience summary.

    Returns:
        JobAnalysisResponse with match details, note, tips, and similar roles.
    """
    messages = build_job_analysis_prompt(job_text, user_skills, user_experience)
    data = await _call_llm(messages)

    return JobAnalysisResponse(**data)


async def analyze_profile_text(raw_text: str) -> dict:
    """
    Analyze raw LinkedIn profile text and extract structured profile data.

    Args:
        raw_text: Raw text from a LinkedIn profile page.

    Returns:
        Dict with name, skills, experience, and summary.
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

    data = await _call_llm(messages)
    return data

