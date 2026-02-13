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

---

## 🔒 Security Notes

- API keys are stored in `.env` (never committed to git)
- All AI interactions are **human-in-the-loop** — nothing is posted automatically
- CORS is permissive for MVP; restrict `allow_origins` in production
- No LinkedIn credentials are accessed or stored

---

## � Recent Updates (v1.1.0)

### ✨ New Features
- **Auto-detect from LinkedIn Profile** — Automatically extract name, headline, skills, and experience from your LinkedIn profile page
- **Clear Buttons** — 8 dedicated clear buttons for quick field management
- **Profile Enhancement** — AI-powered suggestions to improve your professional summary

### 🔧 Improvements
- **Accessibility Compliance** — All clear buttons now include:
  - `type="button"` attributes to prevent accidental form submission
  - Unique `aria-label` attributes for screen reader support
  - Valid SVG syntax for proper rendering
- **Security Hardening** — Removed sensitive raw LLM response data from backend logs and error messages
- **Job Analysis** — Fixed response validation to properly match LLM output fields
- **Simplified UI** — Removed floating AI buttons in favor of clean copy-paste workflow

### 🐛 Bug Fixes
- Fixed PII exposure in backend logging and exception messages
- Corrected job analysis response field mapping
- Improved content extraction reliability with multiple selector fallbacks

---

## �📜 License

MIT — Use freely for personal and commercial projects.
