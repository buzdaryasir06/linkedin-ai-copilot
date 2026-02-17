# LinkedIn AI Copilot v2.0 – Complete Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION V3                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────┐      ┌──────────────────┐                │
│  │  POPUP (UI Layer)  │      │ CONTENT SCRIPT   │                │
│  ├────────────────────┤      ├──────────────────┤                │
│  │ • Comment Tab      │      │ • Job page       │                │
│  │ • Job Match Tab    │      │   detection      │                │
│  │ • Dashboard Tab    │      │ • Job card       │                │
│  │ • Settings Tab     │      │   extraction     │                │
│  └────────┬───────────┘      │ • DOM overlay    │                │
│           │                  │   (match badges) │                │
│           │                  └────────┬─────────┘                │
│           │                           │                           │
│    ┌──────▼────────────────────────────▼─────────┐               │
│    │   BACKGROUND SERVICE WORKER (Router)        │               │
│    ├──────────────────────────────────────────────┤               │
│    │ • Message routing                            │               │
│    │ • API proxying                               │               │
│    │ • batch job scanning coordinator             │               │
│    │ • Storage abstraction service                │               │
│    └──────┬───────────────────────────────────────┘               │
│           │                                                        │
│    ┌──────▼────────────────────────────────────────┐             │
│    │   STORAGE LAYER (Abstraction)                │             │
│    ├──────────────────────────────────────────────┤             │
│    │ • chrome.storage.local (current)             │             │
│    │ • Prepared for: SQLite, PostgreSQL migration │             │
│    │ • Job records + metadata                     │             │
│    └──────────────────────────────────────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ (HTTP API)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    FASTAPI BACKEND                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────┐          │
│  │  REST ENDPOINTS                                    │          │
│  ├────────────────────────────────────────────────────┤          │
│  │ POST   /generate-comment        (existing)         │          │
│  │ POST   /analyze-job             (existing)         │          │
│  │ POST   /batch-score-jobs        (NEW)              │          │
│  │ POST   /jobs/track              (NEW)              │          │
│  │ GET    /jobs                    (NEW - pagination) │          │
│  │ PUT    /jobs/{id}               (NEW)              │          │
│  │ DELETE /jobs/{id}               (NEW)              │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐          │
│  │  SERVICES LAYER                                    │          │
│  ├────────────────────────────────────────────────────┤          │
│  │ • OpenAI integration (comments, job analysis)      │          │
│  │ • Batch job matching engine                        │          │
│  │ • Profile comparison service                       │          │
│  │ • Data validation/sanitization                     │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐          │
│  │  DATA MODELS                                       │          │
│  ├────────────────────────────────────────────────────┤          │
│  │ • Job tracking record (NEW)                        │          │
│  │ • Batch score request/response                     │          │
│  │ • Existing: Profile, Comments, Job Analysis       │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐          │
│  │  DATABASE                                          │          │
│  ├────────────────────────────────────────────────────┤          │
│  │ SQLite (current):                                  │          │
│  │  • user_profiles                                   │          │
│  │  • tracked_jobs (NEW)                              │          │
│  │  • job_metadata (NEW)                              │          │
│  │                                                    │          │
│  │ Migration path: PostgreSQL with Alembic            │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Job Tracking Dashboard – Storage Schema

### Chrome Storage Structure

**MVP: chrome.storage.local**

```javascript
{
  // Job tracking records
  "tracked_jobs": [
    {
      "id": "uuid-1",                              // Immutable unique identifier
      "job_id": "linkedin_job_12345",              // External LinkedIn job ID
      "job_title": "Senior Backend Engineer",
      "company_name": "TechCorp Inc",
      "location": "San Francisco, CA",
      "description": "...",                         // Full job description stored
      
      // AI Analysis Results
      "match_percentage": 82,
      "missing_skills": ["Kubernetes", "Go"],
      "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
      "ranking_level": "high",                      // high/medium/low
      
      // Metadata
      "status": "new",                              // new/saved/applied/rejected
      "notes": "Great company culture, remote ok",
      "analyzed_date": "2026-02-17T14:32:00Z",
      "created_date": "2026-02-17T14:32:00Z",
      "updated_date": "2026-02-17T15:45:00Z",
      
      // Tracking Metadata
      "source": "batch_scan|manual",                // Where it came from
      "source_url": "https://linkedin.com/jobs/...", // Job listing URL
      "interview_notes": "",
      "salary_min": null,
      "salary_max": null,
      "application_date": null,
      "rejection_reason": null
    }
  ],
  
  // Global dashboard state
  "dashboard_state": {
    "filters": {
      "status": ["new", "saved"],                   // Active status filters
      "minMatchPercentage": 60,                     // Minimum match threshold
      "searchQuery": ""                             // Text search
    },
    "sorting": {
      "field": "analyzed_date",                     // Sort field
      "direction": "desc"                           // asc/desc
    },
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "totalRecords": 45
    }
  },
  
  // Sync metadata (for future cloud sync)
  "sync_metadata": {
    "lastSync": "2026-02-17T15:00:00Z",
    "pendingUploads": [],
    "syncEnabled": false,
    "backend_url": "http://localhost:8000"
  }
}
```

### Backend Database Schema (PostgreSQL/SQLite Migration Path)

**SQL Migrations (Alembic compatible)**

```sql
-- v1: Initial job tracking tables
CREATE TABLE tracked_jobs (
    id UUID PRIMARY KEY,
    user_id INT NOT NULL,
    job_id TEXT UNIQUE NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    description TEXT NOT NULL,
    match_percentage INT CHECK (match_percentage >= 0 AND match_percentage <= 100),
    missing_skills TEXT[],  -- PostgreSQL array, JSON list in SQLite
    matched_skills TEXT[],
    ranking_level VARCHAR(20),
    status VARCHAR(20) DEFAULT 'new',
    notes TEXT,
    analyzed_date TIMESTAMP NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50),
    source_url TEXT,
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    application_date TIMESTAMP,
    rejection_reason TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_user_date (user_id, analyzed_date),
    INDEX idx_match_percentage (user_id, match_percentage)
);

-- Query optimization: Materialized summary
CREATE TABLE job_summary_stats (
    id UUID PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    total_jobs INT DEFAULT 0,
    avg_match_percentage DECIMAL(5,2),
    high_count INT DEFAULT 0,
    medium_count INT DEFAULT 0,
    low_count INT DEFAULT 0,
    last_updated TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit trail for compliance
CREATE TABLE job_changes_audit (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL,
    user_id INT NOT NULL,
    change_type VARCHAR(50),  -- created/updated/deleted/status_changed
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_id) REFERENCES tracked_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_changes (user_id, changed_at)
);
```

### Migration Strategy (New)

**Abstraction Layer – Works with Both Storage Backends**

```javascript
// storage/StorageAdapter.js
class StorageAdapter {
  /**
   * Unified storage interface supporting:
   * - Phase 1: chrome.storage.local
   * - Phase 2: Backend database via REST API
   * - Future: Direct PostgreSQL via new connection pool
   */
  
  constructor(mode = 'local') {
    // Supported modes: 'local' (chrome.storage), 'backend' (REST API)
    this.mode = mode;
    this.backend = 'http://localhost:8000';
  }
  
  // Save job record
  async saveJob(job) {
    if (this.mode === 'local') {
      return this._saveJobLocal(job);
    } else if (this.mode === 'backend') {
      return this._saveJobBackend(job);
    }
  }
  
  // Query jobs with filters
  async queryJobs(filters = {}) {
    if (this.mode === 'local') {
      return this._queryJobsLocal(filters);
    } else if (this.mode === 'backend') {
      return this._queryJobsBackend(filters);
    }
  }
  
  _addTimestamps(job) {
    const now = new Date().toISOString();
    return {
      ...job,
      created_date: job.created_date || now,
      updated_date: now
    };
  }
}
```

---

## Part 2: Batch Job Scanning Architecture

### Content Script: Job Page Detection & Extraction

**Detection Flow:**
1. Content script checks URL pattern: `/jobs/search` or `/jobs/view`
2. Extracts all visible job cards from DOM
3. Sends array to background script
4. Background script batches and sends to API
5. Backend returns match scores
6. Content script overlays badges

### Job Card Extraction Structure

```javascript
// Expected output from content script extraction
{
  "jobs": [
    {
      "job_id": "3792345678",
      "job_title": "Senior Backend Engineer",
      "company_name": "TechCorp Inc",
      "location": "San Francisco, CA",
      "description": "We're looking for...",  // If available
      "job_url": "https://www.linkedin.com/jobs/view/3792345678",
      "posting_date": "1 week ago",
      "dom_selector": "[data-job-id='3792345678']"  // For overlay injection
    },
    // ... more jobs
  ],
  "page_context": {
    "url": "https://www.linkedin.com/jobs/search/?...",
    "page_type": "search_results",
    "total_visible": 25,
    "scroll_position": 0
  }
}
```

### Batch Scoring Request/Response

**POST /batch-score-jobs**

```json
{
  "jobs": [
    {
      "job_id": "3792345678",
      "job_title": "Senior Backend Engineer",
      "company_name": "TechCorp",
      "description": "...",
      "location": "SF, CA"
    }
  ],
  "user_profile": {
    "skills": ["Python", "FastAPI", "PostgreSQL", "Redis"],
    "experience": "8 years backend engineering",
    "target_role": "Senior Backend Engineer"
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "job_id": "3792345678",
      "match_score": 82,
      "ranking_level": "high",
      "missing_skills": ["Kubernetes", "Go"],
      "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
      "summary": "Strong match. Needs K8s experience.",
      "analysis_id": "analysis_uuid_1"  // For tracking
    },
    {
      "job_id": "3792345679",
      "match_score": 45,
      "ranking_level": "low",
      "missing_skills": ["Java", "AWS", "Terraform"],
      "matched_skills": ["Python"],
      "summary": "Significant skill gaps in AWS and infrastructure."
    }
  ],
  "batch_id": "batch_uuid_123",
  "processed_count": 2,
  "processing_time_ms": 1234,
  "api_version": "v2.1"
}
```

---

## Message Passing Patterns

### Chrome Runtime Messaging Flow

**Scenario 1: User opens job search page → Batch scanning**

```
Content Script (Job Search Page)
  ↓ chrome.runtime.sendMessage({ action: 'EXTRACT_JOBS_PAGE' })
Background Service Worker
  ↓ (routes to) apiRequest('/batch-score-jobs', ...)
FastAPI Backend
  ↓ Returns: match_scores, rankings, missing_skills
Background Service Worker
  ↓ chrome.runtime.sendMessage({ action: 'OVERLAY_JOB_BADGES' })
Content Script
  ↓ DOM: Inject colored badges into job cards
User sees badges on LinkedIn job page
```

**Scenario 2: User analyzes job from popup → Store in dashboard**

```
Popup (Job Match Tab)
  ↓ user clicks "Analyze & Track"
Popup → Background Script
  ↓ chrome.runtime.sendMessage({ action: 'ANALYZE_JOB_AND_TRACK', ... })
Background Script
  ↓ (1) Calls /analyze-job endpoint
  ↓ (2) Calls /jobs/track endpoint to save
FastAPI Backend
  ↓ Returns: analysis + stored job record
Background Script
  ↓ Saves to chrome.storage.local (StorageAdapter)
  ↓ chrome.runtime.sendMessage to popup: job saved
Popup shows success → Dashboard tab updated
```

**Scenario 3: Dashboard filtering & sorting**

```
Popup (Dashboard Tab)
  ↓ User clicks filter/sort button
Popup
  ↓ Queries StorageAdapter.queryJobs(filters)
StorageAdapter (chrome.storage.local)
  ↓ Returns sorted/filtered records
Dashboard renders table
```

---

## API Endpoint Design

| Method | Endpoint | Purpose | New? |
|--------|----------|---------|------|
| POST | `/generate-comment` | AI comment suggestions | ✗ |
| POST | `/analyze-job` | Analyze single job | ✗ |
| POST | `/batch-score-jobs` | Batch job scoring | ✓ |
| POST | `/jobs/track` | Save analyzed job | ✓ |
| GET | `/jobs` | List tracked jobs (pagination, filters) | ✓ |
| GET | `/jobs/{id}` | Get single job details | ✓ |
| PUT | `/jobs/{id}` | Update job record (status, notes) | ✓ |
| DELETE | `/jobs/{id}` | Delete job record | ✓ |
| GET | `/jobs/stats` | Dashboard summary (total, avg match, etc.) | ✓ |

---

## Security Considerations

### 1. **Data Privacy**
- ✓ Job descriptions stored only in local `chrome.storage.local` (no cloud by default)
- ✓ User profile never stored on LinkedIn servers
- ✓ Backend receives job data but doesn't persist unless explicitly saved
- ✓ HTTPS only for backend communication (enforce in prod)
- ✓ API key stored in environment variable (backend-only, never in extension)

### 2. **Rate Limiting**
- Queue batch requests to avoid overloading LinkedIn DOM
- Max 50 jobs per batch request
- Backend rate limit: 100 batch requests/hour per user (configurable)
- Exponential backoff for failed requests

### 3. **XSS Protection**
- DOMPurify library for sanitizing job descriptions
- No `innerHTML` for user-generated content
- Content scripts use `textContent` where possible
- CSP headers on popup: `script-src 'self'`

### 4. **CSRF Protection**
- Backend: CSRF tokens for state-changing operations (DELETE, PUT)
- Extension validates tokens before modifying

### 5. **DOM Overlay Safety**
- Only inject match badges into official job card selectors
- No auto-clicks, auto-scrolls, or interactions
- No data exfiltration (all data stays in extension)

---

## Performance Considerations

### 1. **Batch Processing**
- Limit: 50 jobs per batch request
- Frontend split large pages into 50-job chunks
- Backend parallel processing: 10 concurrent analyses (async/await)

### 2. **Storage Optimization**
- Keep last 200 tracked jobs locally
- Pagination on dashboard (10 jobs per page default)
- Archive older jobs to backend (future feature)

### 3. **Caching**
- Cache user profile for 1 hour (reduce redundant API calls)
- Cache job search results for 5 min (allow user refresh)
- Invalidate on manual update

### 4. **API Response Time**
- Target: Single job analysis: < 2s
- Target: Batch 50 jobs: < 5s
- Backend uses async processing + OpenAI streaming

### 5. **Background Sync**
- Batch multiple save operations (debounce 500ms)
- Lazy load dashboard (don't fetch all 200 jobs on first render)
- Pagination API: `GET /jobs?page=1&pageSize=10`

---

## Modular Architecture – File Organization

### Extension Structure

```
extension/
├── background.js (updated)
├── content.js (updated)
├── popup.html (updated – new Dashboard tab)
├── popup.js (updated – new tab logic)
├── popup.css (updated)
├── manifest.json (updated)
├── storage/
│   ├── storage-adapter.js (abstraction layer)
│   ├── job-storage.js (job-specific queries)
│   └── migration-utils.js (future cloud migration)
├── dashboard/
│   ├── dashboard-ui.js (table, filters, sorting)
│   ├── dashboard-table.js (table rendering)
│   ├── dashboard-filters.js (filter UI)
│   └── dashboard-styles.css
├── scanner/
│   ├── job-scanner.js (batch extraction)
│   ├── job-page-detector.js (LinkedIn page detection)
│   ├── job-card-parser.js (DOM parsing)
│   └── badge-overlay.js (DOM injection)
├── services/
│   ├── batch-scoring-service.js (batch API calls)
│   ├── job-tracking-service.js (job CRUD)
│   └── messaging-service.js (unified message router)
├── utils/
│   ├── validators.js (input validation)
│   ├── formatters.js (date, skill formatting)
│   ├── constants.js (API paths, selectors)
│   └── logger.js (debug logging)
└── icons/
    ├── badge-high.svg (green)
    ├── badge-medium.svg (yellow)
    └── badge-low.svg (red)
```

### Backend Structure

```
backend/app/
├── routers/
│   ├── jobs.py (NEW – job CRUD endpoints)
│   ├── batch_scoring.py (NEW – batch analysis)
│   ├── comments.py (existing)
│   └── jobs_legacy.py (existing single-job endpoint)
├── models.py (updated – new schemas)
├── services/
│   ├── job_matcher.py (NEW – batch matching logic)
│   ├── skill_analyzer.py (existing, enhanced)
│   └── openai_service.py (existing)
├── database.py (updated – new ORM models)
├── database/
│   ├── models.py (SQLAlchemy models)
│   ├── schema.sql (migration reference)
│   └── migrations/ (Alembic folder – future)
└── config.py (updated)
```

---

## Implementation Priority

**Phase 1 (MVP):**
1. Storage adapter + dashboard UI (chrome.storage.local only)
2. Job tracking store/retrieve
3. Dashboard tab with filtering
4. Backend job CRUD endpoints

**Phase 2:**
1. Content script job detection + batch extraction
2. Batch scoring endpoint
3. DOM overlay badges
4. Live job scanning

**Phase 3:**
1. Backend database migration (SQLite → PostgreSQL)
2. Cloud sync option
3. Job archiving
4. Advanced reporting

---

## Migration Strategy – Local to Backend

```python
# backend/database/migrations/v2_add_job_tracking.py

def migrate_chrome_storage_to_backend():
  """
  One-time migration script for user data.
  
  1. User exports tracked_jobs from chrome.storage.local
  2. POST /jobs/import (admin endpoint)
  3. Backend creates records in tracked_jobs table
  4. Extension updates sync_metadata.syncEnabled = true
  5. New saves go to backend + local cache
  """
  pass
```

This design ensures:
✓ Clean separation of concerns
✓ Testable layers
✓ Future scalability without refactoring
✓ Security-first approach
✓ Performance optimized for batch operations
