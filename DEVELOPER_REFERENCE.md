# Profile Enhancement System: Developer Reference

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Environment Variable
```bash
export GROQ_API_KEY="your-groq-api-key"
# or add to .env file
```

### 3. Run the Server
```bash
uvicorn app.main:app --reload
```

### 4. Test the Endpoint
```bash
curl -X POST "http://localhost:8000/enhance-profile-advanced" \
  -H "Content-Type: application/json" \
  -d '{
    "current_headline": "Python Developer",
    "about_section": "5+ years experience...",
    "experience_descriptions": ["Built APIs", "Led team"],
    "current_skills": ["Python", "FastAPI"],
    "target_role": "Senior Backend Engineer",
    "years_of_experience": 5
  }'
```

---

## System Architecture

```
Request (ProfileEnhancementRequest)
    ↓
[Validation via Pydantic]
    ↓
[build_profile_enhancement_prompt()]
    ├─ System message: Expert LinkedIn branding strategist persona
    ├─ User message: Structured analysis instructions
    └─ Input data: Profile information + target role
    ↓
[LLM Processing via Groq API]
    ├─ Model: Llama 3.3 70B
    ├─ Temperature: 0.5 (balance creativity + consistency)
    └─ Max tokens: 8000 (comprehensive response)
    ↓
[JSON Parsing & Validation]
    ├─ Parse LLM response as JSON
    ├─ Validate against expected keys
    └─ Handle errors gracefully
    ↓
Response (ProfileEnhancementResponse)
    ├─ headline_optimization
    ├─ about_section_enhancement
    ├─ experience_improvements
    ├─ skills_strategy
    ├─ recruiter_optimization
    ├─ differentiation_analysis
    ├─ overall_score
    └─ executive_summary
```

---

## Data Models

### Input: ProfileEnhancementRequest
```python
{
    "current_headline": str,              # Current 120-char headline
    "about_section": str,                 # Professional summary
    "experience_descriptions": list[str], # Bullet points
    "current_skills": list[str],          # Skill list
    "target_role": str,                   # Target position
    "years_of_experience": int,           # YoE (0-60)
    "featured_section": str | None,       # Optional projects/links
    "industry": str | None,               # Optional industry context
    "company_experience": str | None      # Optional company type context
}
```

### Output: ProfileEnhancementResponse
```python
{
    "headline_optimization": {
        "current_headline": str,
        "optimized_headline": str,
        "why_stronger": str,
        "keyword_suggestions": list[str],
        "char_count": int
    },
    "about_section_enhancement": {
        "current_about": str,
        "optimized_about": str,
        "positioning_statement": str,
        "authority_elements": list[str],
        "structure_explanation": str
    },
    "experience_improvements": {
        "improvements": list[{
            "original": str,
            "improved": str,
            "improvement_reason": str,
            "metrics_added": str | None
        }],
        "missing_details": list[str],
        "overall_feedback": str
    },
    "skills_strategy": {
        "current_skills": list[str],
        "recommended_additions": list[str],
        "suggested_ordering_strategy": str,
        "niche_positioning": list[str],
        "skills_to_deemphasize": list[str]
    },
    "recruiter_optimization": {
        "high_value_keywords": list[str],
        "suggested_positioning": str,
        "search_terms_to_include": list[str],
        "visibility_recommendations": list[str]
    },
    "differentiation_analysis": {
        "tone_consistency": str,
        "differentiation_factors": list[str],
        "authority_signals": list[str],
        "competitive_advantages": list[str]
    },
    "overall_score": {
        "score_out_of_10": float,
        "score_breakdown": dict,
        "top_3_priorities": list[str],
        "weeks_to_expert_profile": int
    },
    "executive_summary": str
}
```

---

## Key Design Principles

### 1. **No Generic Advice**
- Every suggestion includes specific examples
- All recommendations are rewritten versions
- Clear reasoning for each change

### 2. **Role-Based Analysis**
- Tailored to specific target roles
- Considers market position and competitive dynamics
- Understands different career trajectories

### 3. **Authority Signals**
- Identifies credibility builders
- Suggests ways to demonstrate depth
- Focuses on hiring signals

### 4. **Structured Output**
- Fully validated JSON response
- Type-safe Pydantic models
- Clear separation of concerns

### 5. **Production-Ready**
- Error handling and validation
- Graceful fallbacks
- Proper logging

---

## Prompt Engineering Details

### System Message (Key Elements)
```
"You are a world-class LinkedIn personal branding strategist, recruiter, and AI system architect."
"Your expertise spans compensation negotiation, executive positioning, and tech talent acquisition."
"You provide ZERO generic advice — every suggestion is specific, rewritten, and directly applicable."
"You focus on positioning, authority, competitive differentiation, and measurable impact."
```

### User Message Structure
```
1. Current Profile Data (headline, about, experience, skills)
2. Target Role & Context (position, industry, company background)
3. Critical Instructions (no generic advice, be specific, etc.)
4. Response Format (exact JSON structure expected)
```

### Temperature & Token Settings
```
temperature = 0.5  # Balanced between creative rewrites and consistent structure
max_tokens = 8000  # Comprehensive response across 7+ sections
response_format = {"type": "json_object"}  # Enforced JSON output
```

---

## Error Handling

### Common Errors & Solutions

**1. JSON Parsing Error**
```python
# If LLM response isn't valid JSON:
# → Check prompt clarity
# → Increase max_tokens (might be truncating)
# → Reduce complexity in user message
```

**2. Missing Keys Error**
```python
# If response missing required fields:
# → Add field explicitly to response format example
# → List all expected keys in prompt
# → Validate response structure
```

**3. Timeout Error**
```python
# If LLM call takes >45 seconds:
# → Reduce max_tokens
# → Simplify profile input
# → Check Groq API status
```

---

## Testing the System

### Unit Test Example
```python
import pytest
from app.services import enhance_profile
from app.models import ProfileEnhancementRequest

@pytest.mark.asyncio
async def test_enhance_profile_basic():
    result = await enhance_profile(
        current_headline="Python Developer",
        about_section="5+ years building backends",
        experience_descriptions=["Built APIs", "Led team"],
        current_skills=["Python", "FastAPI"],
        target_role="Backend Engineer",
        years_of_experience=5
    )
    
    assert result.headline_optimization is not None
    assert result.overall_score.score_out_of_10 >= 0
    assert len(result.overall_score.top_3_priorities) == 3
    assert result.executive_summary is not None
```

### Integration Test Example
```python
@pytest.mark.asyncio
async def test_enhance_profile_endpoint():
    client = TestClient(app)
    request = {
        "current_headline": "Python Developer",
        "about_section": "5+ years building backends",
        "experience_descriptions": ["Built APIs", "Led team"],
        "current_skills": ["Python", "FastAPI"],
        "target_role": "Backend Engineer",
        "years_of_experience": 5
    }
    
    response = client.post("/enhance-profile-advanced", json=request)
    assert response.status_code == 200
    data = response.json()
    assert "headline_optimization" in data
    assert "overall_score" in data
```

---

## Performance Benchmarks

| Metric | Value |
|--------|-------|
| Average Processing Time | 15-30 seconds |
| Token Usage | ~1500-2000 tokens |
| Model | Llama 3.3 70B (via Groq) |
| Response Size | ~3-5 KB JSON |
| Concurrent Requests | 30/minute (Groq free tier) |

---

## Extending the System

### Adding a New Analysis Section

1. **Add to Pydantic model** (`models.py`):
```python
class NewAnalysisSection(BaseModel):
    field1: str
    field2: list[str]

# Add to ProfileEnhancementResponse:
new_section: NewAnalysisSection
```

2. **Update prompt** (`prompts.py`):
```python
# Add to build_profile_enhancement_prompt user message:
{
    "new_section": {
        "field1": "...",
        "field2": ["item1", "item2"]
    }
}
```

3. **Update service** (`services.py`):
```python
# Add to expected_keys:
expected_keys.add("new_section")
```

---

## Debugging Tips

### Check LLM Output
```python
# In services.py, increase logging:
logger.debug("LLM raw response: %s", raw)
```

### Validate Input
```python
# Manually test with simple profile:
profile = ProfileEnhancementRequest(
    current_headline="Simple Developer",
    about_section="Works with Python.",
    experience_descriptions=["Built thing."],
    current_skills=["Python"],
    target_role="Developer",
    years_of_experience=1
)
```

### Test Prompt Directly
```bash
# Test prompt generation independently:
from app.prompts import build_profile_enhancement_prompt
messages = build_profile_enhancement_prompt(...)
print(messages[1]["content"][:500])  # See first 500 chars
```

---

## Future Enhancements

- [ ] Add voice profiles (LinkedIn video summaries)
- [ ] Multi-language support
- [ ] LinkedIn engagement recommendations
- [ ] Competitive analysis (compare against similar profiles)
- [ ] Publication recommendations (Medium, Dev.to)
- [ ] Quarterly update prompts
- [ ] Job market trend integration
- [ ] Interview prep recommendations based on profile

---

## References

- **Groq Documentation**: https://console.groq.com/docs
- **Pydantic Documentation**: https://docs.pydantic.dev/
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **Profile Enhancement Guide**: [PROFILE_ENHANCEMENT_GUIDE.md](../PROFILE_ENHANCEMENT_GUIDE.md)
- **Examples**: [PROFILE_ENHANCEMENT_EXAMPLES.md](../PROFILE_ENHANCEMENT_EXAMPLES.md)

---

**Version:** 1.0  
**Last Updated:** February 2025  
**Maintained By:** LinkedIn AI Co-Pilot Team
