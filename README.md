# LinkedIn AI Copilot

> **Personal AI-powered LinkedIn assistant** – Generate smart comments, analyze job postings, and enhance your profile, all from a clean Chrome extension.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)
![Groq](https://img.shields.io/badge/AI-Groq%20%2B%20Llama%203-412991?logo=meta)
[![CI](https://github.com/your-username/linkedin-ai-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/linkedin-ai-copilot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

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

### Job Scanner (Batch Scoring)
- Automatically scans LinkedIn job search pages
- **Batch scores** multiple jobs against your profile
- Injects **color-coded badges** directly onto job cards
- Hover/click for detailed match information

### Profile Enhancement
- **Comprehensive profile optimization** with structured, actionable suggestions
- Analyzes 6 core profile sections: Headline, About, Experience, Skills, Featured, Context
- **Headline rewriting** with keyword strategy
- **About section enhancement** with positioning & authority
- **Experience improvements** in impact-driven CAR format
- **Skills strategy** and recruiter optimization
- **Profile scoring** (0-10) with ranked improvement priorities
- See [PROFILE_ENHANCEMENT_GUIDE.md](./PROFILE_ENHANCEMENT_GUIDE.md) for full details

### Profile Settings
- Save your skills, experience, and summary
- **Auto-detect from LinkedIn Profile** button to extract data automatically
- Auto-fills Job Mode with your stored profile
- Persisted in local SQLite database

---

## 📁 Project Structure

```
linkedin-ai-copilot/
├── .github/workflows/
│   └── ci.yml                   # GitHub Actions CI pipeline
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, routes
│   │   ├── config.py            # Settings (env vars via pydantic-settings)
│   │   ├── models.py            # Pydantic request/response schemas
│   │   ├── prompts.py           # LLM prompt templates
│   │   ├── services.py          # Groq/LLM integration (with retry logic)
│   │   ├── database.py          # SQLite async persistence
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── comments.py      # POST /generate-comment
│   │       ├── jobs.py          # POST /analyze-job
│   │       └── batch_scoring.py # POST /jobs/batch-score-jobs + job tracking CRUD
│   ├── tests/
│   │   ├── conftest.py          # Pytest fixtures
│   │   ├── test_database.py     # Database CRUD tests
│   │   └── test_api.py          # API endpoint tests
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env.example
├── extension/
│   ├── manifest.json            # Chrome Manifest V3
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup logic (comment, job, settings, enhance modes)
│   ├── popup.css                # LinkedIn-themed styles
│   ├── content.js               # DOM text extraction from LinkedIn
│   ├── background.js            # API proxy service worker
│   ├── scanner/
│   │   ├── job-scanner.js       # Job page scanning orchestrator
│   │   ├── job-page-detector.js # LinkedIn job page detection
│   │   ├── job-card-parser.js   # Job card DOM parsing
│   │   └── badge-overlay.js     # Match score badge injection
│   ├── utils/
│   │   └── validators.js        # Data validation utilities
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## ⚙️ Prerequisites

- **Python 3.11+**
- **Google Chrome** (or Chromium-based browser)
- **Groq API key** ([Free at console.groq.com](https://console.groq.com))

---

## 🛠️ Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit .env and add your Groq API key:
# GROQ_API_KEY=gsk_your_key_here

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

1. Make sure the backend server is running
2. Navigate to [linkedin.com](https://www.linkedin.com)
3. Click the extension icon in your toolbar
4. Toggle between **Comment Mode** and **Job Mode**
5. Enter text or let it auto-extract from the page
6. Click **Generate Comments** or **Analyze Job**
7. Use **Copy**, **Insert**, or **Regenerate** as needed

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/generate-comment` | Generate 3 comment suggestions |
| `POST` | `/analyze-job` | Analyze a job posting |
| `POST` | `/enhance-profile` | Basic profile enhancement |
| `POST` | `/enhance-profile-advanced` | Comprehensive profile enhancement |
| `POST` | `/analyze-profile` | Analyze raw profile text |
| `GET` | `/profile` | Get stored user profile |
| `PUT` | `/profile` | Update user profile |
| `POST` | `/jobs/batch-score-jobs` | Batch score multiple jobs |
| `POST` | `/jobs/track` | Save a tracked job |
| `GET` | `/jobs/` | List tracked jobs (paginated) |
| `GET` | `/jobs/stats` | Dashboard statistics |
| `GET` | `/health` | Health check |

---

## 🧪 Running Tests

```bash
cd backend
pip install pytest pytest-asyncio httpx

pytest tests/ -v
```

---

## 🔒 Security Notes

- API keys are stored in `.env` (never committed to git — see `.env.example`)
- All AI interactions are **human-in-the-loop** — nothing is posted automatically
- CORS is restricted to configured origins (Chrome extension + localhost)
- No LinkedIn credentials are accessed or stored
- LLM calls include automatic retry with exponential backoff

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on setup, code quality, and submitting pull requests.

---

## 📜 License

MIT — See [LICENSE](./LICENSE) for details.

