"""
prompts.py – LLM prompt templates for Comment Mode and Job Mode.

Each function returns a formatted system + user prompt pair ready for the
OpenAI Chat Completions API. Prompts are designed to return valid JSON.
"""


def build_comment_prompt(post_text: str, tone: str | None = None) -> list[dict]:
    """
    Build the messages array for generating 5 LinkedIn comment suggestions.

    Returns 5 styles: authority, question, strategic, appreciation, project.
    """
    tone_instruction = ""
    if tone:
        tone_instruction = f"\nAdditional tone preference: {tone}."

    system_msg = (
        "You are a real human LinkedIn user who writes comments the way people actually talk. "
        "You are NOT an AI assistant. You write like a normal person — casual but professional. "
        "Your comments sound like someone quickly typing a genuine reaction from their phone. "
        "NEVER use corporate jargon, buzzwords, or overly polished language. "
        "NEVER start with 'Great post!' or 'This is so insightful!' — those are obvious AI patterns. "
        "NEVER use words like: leverage, synergy, resonate, insightful, game-changer, absolutely, kudos, hats off, couldn't agree more. "
        "Use contractions (it's, don't, I've). Vary sentence length. Be specific, not generic."
    )

    user_msg = f"""Read this LinkedIn post and write 5 different comments as if YOU are a real person genuinely reacting to it.

Write each comment in a different style:
1. **Authority** – Share a quick personal take or experience related to the topic. Like you've been there and have something real to add.
2. **Question** – Ask something you're genuinely curious about. Not a generic question — something specific to what they said.
3. **Strategic** – Add your own perspective that moves the conversation forward. Maybe mention a related idea or offer to connect on the topic.
4. **Appreciation** – If they shared an achievement, congratulate them the way a friend or colleague would — warm but not over the top. Be specific about WHAT you're congratulating.
5. **Project** – If they built or launched something, react like a fellow builder would — notice a specific detail, ask how they did something, or share why it caught your eye.

CRITICAL RULES for sounding human:
- Write like you're texting a professional friend, NOT writing an essay
- Keep it SHORT — 1-2 sentences is ideal, 3 max
- It's OK to start with lowercase or use casual phrasing
- Use "I" statements — share YOUR reaction, not generic praise
- Reference SPECIFIC details from the post, don't be vague
- One emoji max per comment (or none) — real people don't spam emojis
- Imperfect is better than polished — real comments aren't perfect
- DO NOT include hashtags
- DO NOT use quotation marks around their words{tone_instruction}

LinkedIn Post:
\"\"\"
{post_text}
\"\"\"

Respond with ONLY valid JSON in this exact format:
{{
  "comments": [
    {{"style": "authority", "comment": "..."}},
    {{"style": "question", "comment": "..."}},
    {{"style": "strategic", "comment": "..."}},
    {{"style": "appreciation", "comment": "..."}},
    {{"style": "project", "comment": "..."}}
  ]
}}"""

    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]


def build_job_analysis_prompt(
    job_text: str,
    user_skills: list[str],
    user_experience: str,
) -> list[dict]:
    """
    Build the messages array for analyzing a job posting against a user profile.

    Returns matched/missing skills, a personalized application note,
    resume improvement tips, and similar roles to explore.
    """
    skills_str = ", ".join(user_skills) if user_skills else "Not provided"

    system_msg = (
        "You are an expert career coach and resume strategist. "
        "You help professionals analyze job postings and optimize their applications. "
        "Be specific, actionable, and encouraging."
    )

    user_msg = f"""Analyze the following job posting against the candidate's profile.

**Job Posting:**
\"\"\"
{job_text}
\"\"\"

**Candidate Profile:**
- Skills: {skills_str}
- Experience: {user_experience if user_experience else "Not provided"}

Provide a comprehensive analysis with:
1. **Matched Skills** – Skills the candidate already has that match the job requirements.
2. **Missing Skills** – Skills required by the job that the candidate lacks.
3. **Match Percentage** – An estimated overall fit percentage (0–100).
4. **Personalized Note** – A 2–4 sentence personalized application note the candidate could include when applying to stand out.
5. **Resume Tips** – 3–5 specific, actionable resume improvements tailored to this job.
6. **Similar Roles** – 3–5 related job titles the candidate could also explore.

Respond with ONLY valid JSON in this exact format:
{{
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"],
  "match_percentage": 75,
  "personalized_note": "...",
  "resume_tips": ["tip1", "tip2", "tip3"],
  "similar_roles": ["role1", "role2", "role3"]
}}"""

    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]
