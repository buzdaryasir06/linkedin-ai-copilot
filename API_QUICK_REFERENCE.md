# API Quick Reference - Job Tracking & Batch Scoring

## Endpoints Overview

### Batch Scoring
```
POST /batch-score-jobs
  Fast scoring for LinkedIn job search page scanner
  Body: { jobs[], user_profile, quick_mode }
  Response: { results[], batch_id, processing_time_ms }
```

### Job Tracking
```
POST   /jobs/track       Save a tracked job
GET    /jobs             List jobs with filters
GET    /jobs/{id}        Get single job detail
PUT    /jobs/{id}        Update job metadata
DELETE /jobs/{id}        Delete job
POST   /jobs/batch       Bulk import jobs
GET    /jobs/stats       Dashboard statistics
```

---

## Usage Examples

### 1. Batch Score Jobs (Real-Time Feedback)

```bash
curl -X POST http://localhost:8000/batch-score-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {
        "job_id": "3792345678",
        "job_title": "Senior Backend Engineer",
        "company_name": "TechCorp Inc",
        "location": "San Francisco, CA",
        "description": "We are looking for a Senior Backend Engineer with 7+ years experience in Python and FastAPI. Must have PostgreSQL expertise and AWS knowledge. Experience with Kubernetes and microservices required."
      },
      {
        "job_id": "3792345679",
        "job_title": "Full Stack Developer",
        "company_name": "StartupXYZ",
        "location": "Remote",
        "description": "Join our team as a Full Stack Developer. We use React, Node.js, and MongoDB. Experience with Go is nice to have."
      }
    ],
    "user_profile": {
      "skills": ["Python", "FastAPI", "PostgreSQL", "AWS", "React"],
      "experience": "8 years as backend engineer",
      "target_role": "Senior Backend Engineer"
    },
    "quick_mode": true
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "results": [
    {
      "job_id": "3792345678",
      "match_percentage": 82,
      "ranking_level": "high",
      "matched_skills": ["Python", "FastAPI", "PostgreSQL", "AWS"],
      "missing_skills": ["Kubernetes", "microservices"],
      "summary": "Strong backend match - has 4/6 core skills"
    },
    {
      "job_id": "3792345679",
      "match_percentage": 45,
      "ranking_level": "low",
      "matched_skills": ["React"],
      "missing_skills": ["Node.js", "MongoDB", "Go"],
      "summary": "Not aligned - missing core stack (Node.js, MongoDB)"
    }
  ],
  "batch_id": "batch_1704888234.567",
  "processed_count": 2,
  "processing_time_ms": 234,
  "api_version": "v2.1"
}
```

**Using JavaScript (in Chrome extension):**
```javascript
const response = await chrome.runtime.sendMessage({
  action: "BATCH_SCORE_JOBS",
  jobs: extractedJobs,  // from JobCardParser
  userProfile: userProfile,  // from popup form
  quickMode: true
});

// response.data.results = [ { job_id, match_percentage, ranking_level, ... } ]
```

---

### 2. Save Job to Dashboard

```bash
curl -X POST http://localhost:8000/jobs/track \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "3792345678",
    "job_title": "Senior Backend Engineer",
    "company_name": "TechCorp Inc",
    "location": "San Francisco, CA",
    "description": "Full job description...",
    "job_url": "https://www.linkedin.com/jobs/view/3792345678",
    "match_percentage": 82,
    "ranking_level": "high",
    "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
    "missing_skills": ["Kubernetes"],
    "status": "new",
    "source": "manual"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "job": {
    "id": "3792345678",
    "job_title": "Senior Backend Engineer",
    "company_name": "TechCorp Inc",
    "location": "San Francisco, CA",
    "match_percentage": 82,
    "ranking_level": "high",
    "status": "new",
    "created_at": "2025-01-15T14:23:45.123456",
    "updated_at": "2025-01-15T14:23:45.123456",
    "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
    "missing_skills": ["Kubernetes"],
    "notes": null,
    "source": "manual"
  }
}
```

---

### 3. List Tracked Jobs with Filtering

```bash
# Get first 10 "new" jobs
curl "http://localhost:8000/jobs?page=1&pageSize=10&status=new"

# Get high-match jobs (70%+)
curl "http://localhost:8000/jobs?page=1&minMatch=70&sortBy=match_percentage&sortOrder=desc"

# Search for Python jobs
curl "http://localhost:8000/jobs?page=1&search=Python"

# Filter by ranking and status
curl "http://localhost:8000/jobs?page=1&status=applied,interested&sortBy=created_at&sortOrder=desc"
```

**Response (200 OK):**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "3792345678",
      "job_title": "Senior Backend Engineer",
      "company_name": "TechCorp Inc",
      "location": "San Francisco, CA",
      "match_percentage": 82,
      "ranking_level": "high",
      "status": "new",
      "created_at": "2025-01-15T14:23:45",
      "notes": null,
      "salary_min": 150000,
      "salary_max": 200000
    }
  ],
  "total": 47,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```

---

### 4. Get Single Job Detail

```bash
curl "http://localhost:8000/jobs/3792345678"
```

**Response (200 OK):**
```json
{
  "success": true,
  "job": {
    "id": "3792345678",
    "job_title": "Senior Backend Engineer",
    "company_name": "TechCorp Inc",
    "location": "San Francisco, CA",
    "description": "Full job description...",
    "job_url": "https://www.linkedin.com/jobs/view/3792345678",
    "match_percentage": 82,
    "ranking_level": "high",
    "matched_skills": ["Python", "FastAPI", "PostgreSQL", "AWS"],
    "missing_skills": ["Kubernetes"],
    "status": "new",
    "notes": "Good opportunity, follow up next week",
    "created_at": "2025-01-15T14:23:45",
    "updated_at": "2025-01-15T14:23:45",
    "last_viewed_at": "2025-01-15T15:00:00",
    "application_date": null,
    "rejection_date": null,
    "interview_date": null,
    "interview_stage": null,
    "salary_min": 150000,
    "salary_max": 200000,
    "source": "manual"
  }
}
```

---

### 5. Update Job Status/Notes

```bash
curl -X PUT http://localhost:8000/jobs/3792345678 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "applied",
    "notes": "Applied on Jan 15, pending response",
    "application_date": "2025-01-15T14:30:00",
    "interview_stage": null
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "job": {
    "id": "3792345678",
    "status": "applied",
    "notes": "Applied on Jan 15, pending response",
    "application_date": "2025-01-15T14:30:00",
    "updated_at": "2025-01-15T14:35:00"
  }
}
```

**Allowed Fields to Update:**
- `status`: "new", "applied", "interested", "interviewed", "rejected"
- `notes`: String (any length)
- `application_date`: ISO timestamp
- `rejection_date`: ISO timestamp
- `rejection_reason`: String
- `interview_date`: ISO timestamp
- `interview_stage`: "phone", "technical", "final", "offer"
- `salary_min`, `salary_max`: Integers

**Cannot Update** (must re-analyze):
- `job_id`, `match_percentage`, `ranking_level`, `matched_skills`, `missing_skills`

---

### 6. Delete Job

```bash
curl -X DELETE http://localhost:8000/jobs/3792345678
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Job deleted"
}
```

---

### 7. Get Dashboard Statistics

```bash
curl "http://localhost:8000/jobs/stats"
```

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "total_jobs": 127,
    "average_match_percentage": 68.4,
    "by_status": {
      "new": 42,
      "applied": 35,
      "interested": 20,
      "interviewed": 15,
      "rejected": 15
    },
    "by_ranking": {
      "high": 45,
      "medium": 52,
      "low": 30
    },
    "funnel": {
      "new": 42,
      "applied": 35,
      "interested": 20,
      "interviewed": 15,
      "rejected": 15
    }
  }
}
```

---

### 8. Bulk Import Jobs

```bash
curl -X POST http://localhost:8000/jobs/batch \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {
        "job_title": "Backend Engineer",
        "company_name": "Company1",
        "location": "NYC",
        "description": "...",
        "match_percentage": 75,
        "ranking_level": "high",
        "status": "new",
        "matched_skills": ["Python"],
        "missing_skills": ["Go"],
        "source": "batch_import"
      },
      {
        "job_title": "Senior Backend",
        "company_name": "Company2",
        "location": "SF",
        "description": "...",
        "match_percentage": 85,
        "ranking_level": "high",
        "status": "new",
        "matched_skills": ["Python", "FastAPI"],
        "missing_skills": [],
        "source": "batch_import"
      }
    ]
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "saved_count": 2,
  "jobs": [
    { "id": "job_1...", "job_title": "Backend Engineer", ... },
    { "id": "job_2...", "job_title": "Senior Backend", ... }
  ]
}
```

---

## Error Handling

### Bad Request (400)

```json
{
  "detail": "jobs array is required"
}
```

### Not Found (404)

```json
{
  "detail": "Job not found"
}
```

### Server Error (500)

```json
{
  "detail": "Batch scoring failed: Error message"
}
```

---

## Query Parameters Reference

### Filtering
- `status`: Comma-separated statuses (e.g., `status=new,applied`)
- `minMatch`: Minimum match percentage 0-100 (e.g., `minMatch=70`)

### Pagination
- `page`: Page number (default 1, min 1)
- `pageSize`: Items per page (default 10, max 100)

### Sorting
- `sortBy`: Field to sort by
  - `created_at` (default)
  - `match_percentage`
  - `job_title`
  - `company_name`
  - `updated_at`
- `sortOrder`: `asc` or `desc` (default `desc`)

### Searching
- `search`: Free-text search (checks job_title, company_name, description)

### Examples
```
GET /jobs?page=1&pageSize=20
GET /jobs?status=applied,interested&sortBy=match_percentage&sortOrder=desc
GET /jobs?minMatch=70&search=Python
GET /jobs?page=2&pageSize=50&status=applied
```

---

## Performance Notes

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Batch score 50 (quick) | < 5 seconds | Heuristic mode, no API call |
| Batch score 50 (LLM) | 10-15 seconds | Via Groq API |
| List 1000 jobs | < 100ms | With pagination |
| Search query | 200-500ms | Depends on result count |
| Get stats | < 200ms | Database aggregation |

---

## Testing in Browser Console

```javascript
// Test from popup JavaScript console (while extension is running)

// 1. Batch score jobs
const response = await chrome.runtime.sendMessage({
  action: "BATCH_SCORE_JOBS",
  jobs: [{
    job_id: "123",
    job_title: "Python Developer",
    company_name: "TechCorp",
    description: "We need Python experts with FastAPI"
  }],
  userProfile: {
    skills: ["Python", "FastAPI"],
    experience: "5 years",
    target_role: "Backend Engineer"
  },
  quickMode: true
});
console.log(response);

// 2. Get dashboard jobs
fetch('http://localhost:8000/jobs?page=1&pageSize=10')
  .then(r => r.json())
  .then(data => console.log(data));

// 3. Get stats
fetch('http://localhost:8000/jobs/stats')
  .then(r => r.json())
  .then(stats => console.log(stats));
```

---

## Swagger UI

Browse all endpoints with interactive testing:

```
http://localhost:8000/docs
```

Features:
- Try it out: Test endpoints directly
- See request/response schemas
- View error examples
- Read endpoint descriptions

---

## Rate Limiting (Future)

Currently no rate limiting. Once implemented expect:
- `/batch-score-jobs`: 30 requests/minute (Groq API limit)
- `/jobs/track`: 100 requests/minute
- `/jobs`: 1000 requests/minute

---

## Debugging Tips

### View backend logs
Console output shows all operations:
```
2025-01-15 14:23:45 │ INFO     │ [Batch Scorer] Quick mode: scoring 25 jobs
2025-01-15 14:23:46 │ INFO     │ [Track Job] Saved Senior Engineer at TechCorp
```

### Check database
```bash
# Using sqlite3 CLI
sqlite3 backend/data.db
> SELECT COUNT(*) FROM tracked_jobs;
> SELECT * FROM tracked_jobs WHERE ranking_level = 'high';
```

### Network debugging
Open DevTools → Network tab → Filter by `localhost:8000`

---

## Common Workflows

### Workflow 1: Manual Job Analysis
```
1. User finds job on LinkedIn
2. Copy job details to popup
3. Click "Analyze Job" → Call /analyze-job
4. Click "Save" → Call POST /jobs/track
5. Job appears in Dashboard tab
```

### Workflow 2: Batch Scanning
```
1. User visits LinkedIn job search
2. Scanner auto-initializes (on /jobs/search page)
3. Extracts visible jobs → Sends BATCH_SCORE_JOBS message
4. Background sends POST /batch-score-jobs
5. Injected badges show match % (high/medium/low)
6. High-match jobs saved via POST /jobs/track
```

### Workflow 3: Dashboard Review
```
1. Open popup → Dashboard tab
2. See all saved jobs
3. Filter by status="applied" → See 35 applied jobs
4. Sort by match % → See best matches first
5. Click job → View details
6. Update status to "interviewed"
7. Export CSV → Save locally
```

---

## Support

For issues:
1. Check `BACKEND_V2_IMPLEMENTATION.md` for detailed design
2. Review error messages in console + backend logs
3. See `V2_IMPLEMENTATION_CHECKLIST.md` for troubleshooting
