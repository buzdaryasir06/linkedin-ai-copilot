# LinkedIn AI Copilot

> **Personal AI-powered LinkedIn assistant** – Generate smart comments and analyze job postings, all from a clean Chrome extension.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)
![OpenAI](https://img.shields.io/badge/AI-OpenAI-412991?logo=openai)

---

## 🚀 Features

### Comment Mode
- Generates **3 AI comment suggestions** for any LinkedIn post
- Styles: **Authority** (thought-leader), **Question** (engagement), **Strategic** (networking)
- One-click **Copy** or **Insert** into LinkedIn comment box
- **Regenerate** for fresh suggestions

### Job Mode
- Analyzes job postings against your profile
- Shows **skill match percentage** with visual meter
- Highlights **matched** and **missing** skills
- Generates **personalized application notes**
- Provides **resume improvement tips**
- Suggests **similar roles** to explore

### 🎯 Profile Enhancement System (NEW!)
- **Comprehensive profile optimization** with structured, actionable suggestions
- Analyzes **6 core profile sections**: Headline, About, Experience, Skills, Featured, Context
- Delivers **7 detailed improvement sections** (not generic advice):
  - **Headline Optimization** — High-impact rewrites with keyword strategy
  - **About Section Enhancement** — Professional summary with positioning & authority
  - **Experience Improvements** — Convert bullets to impact-driven CAR format
  - **Skills Strategy** — Skill recommendations and optimal ordering for target role
  - **Recruiter Optimization** — Keywords and positioning for discoverability
  - **Differentiation Analysis** — Tone, authority signals, competitive advantages
  - **Profile Score** — 0-10 rating with ranked improvement priorities
- **Role-tailored suggestions** for AI Engineers, Backend Devs, Marketing, Leadership, etc.
- **Competitive positioning** for standing out in selective markets
- See [PROFILE_ENHANCEMENT_GUIDE.md](./PROFILE_ENHANCEMENT_GUIDE.md) for full details

### Profile Settings
- Save your skills, experience, and summary
- **Auto-detect from LinkedIn Profile** button to extract data automatically
- Auto-fills Job Mode with your stored profile
- Persisted in local SQLite database
- **Clear buttons** on all input fields for easy management

### UI & Accessibility
- Manual copy-paste workflow for maximum control
- 8 accessible clear buttons with **ARIA labels** for screen readers
- **Type-safe buttons** to prevent accidental form submission
- Clean, minimalist LinkedIn-themed interface

---

## 📁 Project Structure

```
linkedin-ai-copilot/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, routes
│   │   ├── config.py            # Settings (env vars)
│   │   ├── models.py            # Pydantic schemas
│   │   ├── prompts.py           # LLM prompt templates
│   │   ├── services.py          # OpenAI integration
│   │   ├── database.py          # SQLite user profile
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── comments.py      # POST /generate-comment
│   │       └── jobs.py          # POST /analyze-job
│   ├── requirements.txt
│   └── .env.example
├── extension/
│   ├── manifest.json            # Manifest V3
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup logic
│   ├── popup.css                # LinkedIn-themed styles
│   ├── content.js               # DOM text extraction
│   ├── background.js            # API proxy service worker
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── README.md
```

---

## ⚙️ Prerequisites

- **Python 3.10+**
- **Google Chrome** (or Chromium-based browser)
- **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))

---

## 🛠️ Setup Instructions

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=sk-your-actual-key-here

# Start the server
uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
🚀 LinkedIn AI Copilot backend starting up…
```

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The LinkedIn AI Copilot icon should appear in your toolbar

### 3. Usage

1. Make sure the backend server is running (`uvicorn app.main:app --reload`)
2. Navigate to [linkedin.com](https://www.linkedin.com)
3. You'll see small **AI** buttons appear near posts and job listings
4. Click the extension icon in your toolbar to open the popup
5. Toggle between **Comment Mode** and **Job Mode**
6. Enter text (or let it auto-extract from the page)
7. Click **Generate Comments** or **Analyze Job**
8. Use **Copy**, **Insert**, or **Regenerate** as needed

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/generate-comment` | Generate 3 comment suggestions |
| `POST` | `/analyze-job` | Analyze a job posting |
| `POST` | `/enhance-profile-advanced` | **[NEW]** Comprehensive profile enhancement with structured suggestions |
| `GET` | `/profile` | Get stored user profile |
| `PUT` | `/profile` | Update user profile |
| `GET` | `/health` | Health check |

### Example: Generate Comments

```bash
curl -X POST http://localhost:8000/generate-comment \
  -H "Content-Type: application/json" \
  -d '{"post_text": "AI is transforming how we build software."}'
```

### Example: Analyze Job

```bash
curl -X POST http://localhost:8000/analyze-job \
  -H "Content-Type: application/json" \
  -d '{
    "job_text": "Looking for a Senior Python Developer with FastAPI experience...",
    "user_skills": ["Python", "FastAPI", "PostgreSQL"],
    "user_experience": "3 years backend development"
  }'
```

### Example: Enhance Profile (NEW!)

```bash
curl -X POST http://localhost:8000/enhance-profile-advanced \
  -H "Content-Type: application/json" \
  -d '{
    "current_headline": "Python Developer | Open to Opportunities",
    "about_section": "Experienced developer passionate about building scalable systems...",
    "experience_descriptions": ["Developed REST APIs", "Led a team", "Optimized databases"],
    "current_skills": ["Python", "FastAPI", "PostgreSQL"],
    "target_role": "AI/ML Backend Engineer",
    "years_of_experience": 5,
    "industry": "FinTech / SaaS",
    "company_experience": "Series A startups"
  }'
```

Response includes:
- Headline optimization with keywords
- Enhanced about section with positioning
- Experience improvements with impact metrics
- Skills strategy with niche positioning
- Recruiter optimization keywords
- Profile score (0-10) with ranked priorities

See [PROFILE_ENHANCEMENT_EXAMPLES.md](./PROFILE_ENHANCEMENT_EXAMPLES.md) for complete real-world examples.

---

## � Recent Updates (v2.0.0)

### ✨ Profile Enhancement System (Major Feature!)
- **Comprehensive profile optimization** with 7 detailed analysis sections
- **Rewritten examples** for every suggestion (headline, about, experience, skills)
- **Role-tailored recommendations** for target positions
- **Recruiter optimization** with keyword strategy for discoverability
- **Differentiation analysis** for competitive positioning
- **Profile scoring** (0-10) with ranked improvement priorities
- **No generic advice** — every suggestion is specific and actionable
- See [PROFILE_ENHANCEMENT_GUIDE.md](./PROFILE_ENHANCEMENT_GUIDE.md) for full documentation
- Real-world examples in [PROFILE_ENHANCEMENT_EXAMPLES.md](./PROFILE_ENHANCEMENT_EXAMPLES.md)

### 🔄 Architecture Improvements
- **Enhanced prompting** with expert-level system instructions
- **Structured output** with validated Pydantic models
- **Role-aware analysis** that understands market positioning
- **Authority signal detection** and recommendations
- **Competitive positioning framework** for tech talent markets

### ✨ Previous Features (v1.1.0)
- **Auto-detect from LinkedIn Profile** — Automatically extract name, headline, skills, and experience
- **Clear Buttons** — Quick field management with accessibility compliance

---

## 📚 Documentation

- **[PROFILE_ENHANCEMENT_GUIDE.md](./PROFILE_ENHANCEMENT_GUIDE.md)** — Comprehensive guide to the Profile Enhancement System
- **[PROFILE_ENHANCEMENT_EXAMPLES.md](./PROFILE_ENHANCEMENT_EXAMPLES.md)** — Real-world examples with full request/response
- **README.md** — This file

---

## 🔒 Security Notes

- API keys are stored in `.env` (never committed to git)
- All AI interactions are **human-in-the-loop** — nothing is posted automatically
- CORS is permissive for MVP; restrict `allow_origins` in production
- No LinkedIn credentials are accessed or stored

---

## 📜 Recent Updates History (v1.1.0)

### ✨ New Features (v1.1.0)
- **Auto-detect from LinkedIn Profile** — Automatically extract name, headline, skills, and experience from your LinkedIn profile page
- **Clear Buttons** — 8 dedicated clear buttons for quick field management
- **Profile Enhancement** — AI-powered suggestions to improve your professional summary

### 🔧 Improvements (v1.1.0)
- **Accessibility Compliance** — All clear buttons now include:
  - `type="button"` attributes to prevent accidental form submission
  - Unique `aria-label` attributes for screen reader support
  - Valid SVG syntax for proper rendering
- **Security Hardening** — Removed sensitive raw LLM response data from backend logs and error messages
- **Job Analysis** — Fixed response validation to properly match LLM output fields
- **Simplified UI** — Removed floating AI buttons in favor of clean copy-paste workflow

### 🐛 Bug Fixes (v1.1.0)
- Fixed PII exposure in backend logging and exception messages
- Corrected job analysis response field mapping
- Improved content extraction reliability with multiple selector fallbacks

MIT — Use freely for personal and commercial projects.
