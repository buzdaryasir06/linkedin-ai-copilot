"""
prompts.py – LLM prompt templates for Comment Mode and Job Mode.

Each function returns a formatted system + user prompt pair ready for the
OpenAI Chat Completions API. Prompts are designed to return valid JSON.
"""

import json


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


def build_profile_enhancement_prompt(
    current_headline: str,
    about_section: str,
    experience_descriptions: list[str],
    current_skills: list[str],
    featured_section: str | None,
    target_role: str,
    years_of_experience: int,
    industry: str | None,
    company_experience: str | None,
) -> list[dict]:
    """
    Build the messages array for comprehensive profile enhancement.
    
    Returns structured, actionable, and high-impact profile optimization suggestions
    tailored to the target role, with specific rewritten examples and authority signals.
    """
    
    experience_str = "\n".join([f"- {exp}" for exp in experience_descriptions]) if experience_descriptions else "Not provided"
    skills_str = ", ".join(current_skills) if current_skills else "Not provided"
    featured_str = featured_section if featured_section else "Not provided"
    industry_str = industry if industry else "Not specified"
    company_str = company_experience if company_experience else "Not specified"
    
    system_msg = (
        "You are a world-class LinkedIn personal branding strategist, recruiter, and AI system architect. "
        "Your expertise spans compensation negotiation, executive positioning, and tech talent acquisition across FAANG and top startups. "
        "You understand what makes elite LinkedIn profiles stand out to top recruiters and how authority signals influence hiring decisions. "
        "You provide ZERO generic advice — every suggestion is specific, rewritten, and directly applicable. "
        "You focus on positioning, authority, competitive differentiation, and measurable impact. "
        "You understand that in AI/Backend roles, depth, innovation, and leadership are what separate top 1% candidates from the rest. "
        "Your tone is professional, confident, modern, and never corporate-buzzword heavy."
    )
    
    user_msg = f"""Analyze and enhance this LinkedIn profile for competitive positioning as a {target_role}.

CURRENT PROFILE:
───────────────
Headline: {current_headline}

About Section:
{about_section}

Experience Bullets:
{experience_str}

Current Skills:
{skills_str}

Featured Section:
{featured_str}

Target Role: {target_role}
Years of Experience: {years_of_experience}
Industry Context: {industry_str}
Company Background: {company_str}

CRITICAL INSTRUCTIONS:
─────────────────────
You are a senior LinkedIn branding consultant analyzing this profile. Provide ZERO generic advice.
- Every headline suggestion must be rewritten and explained specifically
- Every about section must have a clear structure with positioning, authority, and vision
- Every experience improvement must include why it's stronger and what metrics could be added
- Every skill recommendation must be proven high-value for this specific target role
- All suggestions must differentiate from competitors in the {target_role} space
- Tone must be professional, confident, modern (never corporate jargon)
- Focus on what makes candidates hireable to top-tier tech companies

Your analysis must address:
1. TONE CONSISTENCY across the profile
2. DIFFERENTIATION from other {target_role} candidates
3. AUTHORITY SIGNALS (credentials, depth, impact)
4. COMPETITIVE ADVANTAGES in a crowded AI/Backend market
5. HOW TO STAND OUT to top-tier recruiters and hiring managers

RESPOND WITH ONLY VALID JSON - NO EXPLANATIONS OUTSIDE JSON:

{{
  "headline_optimization": {{
    "current_headline": "{current_headline}",
    "optimized_headline": "Write a concise, high-impact headline (max 120 chars) that speaks directly to {target_role} requirements. Be specific. Example: 'AI/ML Backend Engineer | Python/FastAPI/LLMs | Built Recommendation Systems @ Scale'",
    "why_stronger": "Explain specifically why this is more compelling — what keywords, tone, authority signals make it stand out vs generic headlines",
    "keyword_suggestions": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "char_count": 0
  }},
  "about_section_enhancement": {{
    "current_about": "{about_section[:500]}...",
    "optimized_about": "Rewrite the entire About section (3-4 tight paragraphs). Structure: [HOOK - grab attention with credibility] [EXPERTISE - deep technical positioning] [IMPACT - measurable results/outcomes] [VISION - future direction/what you're solving]. Make it human, confident, modern.",
    "positioning_statement": "Write one clear sentence that positions them uniquely as a {target_role} — this should be the core differentiator",
    "authority_elements": ["element1", "element2", "element3", "element4"],
    "structure_explanation": "Explain how the optimized about follows hook → expertise → impact → vision framework and why each element matters"
  }},
  "experience_improvements": {{
    "improvements": [
      {{
        "original": "First experience bullet from list",
        "improved": "Rewrite this bullet to be impact-driven. Add metrics where possible. Highlight leadership, ownership, technical depth.",
        "improvement_reason": "Specifically explain why the improved version is stronger — what was generic vs specific, what metrics add proof",
        "metrics_added": "If metrics were added, mention them. Otherwise null."
      }}
    ],
    "missing_details": ["detail1", "detail2"],
    "overall_feedback": "2-3 sentences on how to position experience section for {target_role} visibility and impact"
  }},
  "skills_strategy": {{
    "current_skills": {json.dumps(skills_str.split(", ") if skills_str != "Not provided" else [])},
    "recommended_additions": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "suggested_ordering_strategy": "Explain EXACTLY how to order skills for maximum recruiter impact in {target_role} searches",
    "niche_positioning": ["niche1", "niche2", "niche3"],
    "skills_to_deemphasize": ["generic_skill1"]
  }},
  "recruiter_optimization": {{
    "high_value_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"],
    "suggested_positioning": "How to position the profile to show up in recruiter searches for {target_role} roles at top companies",
    "search_terms_to_include": ["search_term1", "search_term2", "search_term3"],
    "visibility_recommendations": ["recommendation1", "recommendation2", "recommendation3"]
  }},
  "differentiation_analysis": {{
    "tone_consistency": "Analyze if tone is consistent — is it confident? modern? or corporate-buzzword heavy? What to fix.",
    "differentiation_factors": ["factor1", "factor2", "factor3"],
    "authority_signals": ["signal1", "signal2", "signal3"],
    "competitive_advantages": ["advantage1", "advantage2"]
  }},
  "overall_score": {{
    "score_out_of_10": 6.5,
    "score_breakdown": {{
      "headline": 5,
      "about_section": 6,
      "experience": 7,
      "skills": 6,
      "authority_signals": 5,
      "differentiation": 4
    }},
    "top_3_priorities": [
      "Priority 1 (most impactful): specific action with reasoning",
      "Priority 2: specific action with reasoning",
      "Priority 3: specific action with reasoning"
    ],
    "weeks_to_expert_profile": 4
  }},
  "executive_summary": "2-3 sentence summary of the biggest opportunities and concrete next steps to position as a top-tier {target_role} candidate"
}}
"""
    
    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]
