# Job Tracking Schema & Migration Strategy

## Part 1: Chrome Storage Schema (MVP)

### Data Structure
```javascript
// Key: "tracked_jobs"
// Type: IndexedDB-compatible JSON array
{
  "tracked_jobs": [
    {
      // Identifiers
      "id": "uuid-550e8400-e29b-41d4-a716-446655440000",
      "job_id": "linkedin_3792345678_2026",
      "created_date": "2026-02-17T14:32:00Z",
      
      // Job Content
      "job_title": "Senior Backend Engineer",
      "company_name": "TechCorp Inc",
      "location": "San Francisco, CA",
      "description": "Full job description text...",
      "job_url": "https://www.linkedin.com/jobs/view/3792345678",
      
      // Analysis Results
      "match_percentage": 82,
      "ranking_level": "high",  // high|medium|low
      "matched_skills": ["Python", "FastAPI", "PostgreSQL", "Redis"],
      "missing_skills": ["Kubernetes", "Go", "gRPC"],
      
      // Metadata
      "status": "new",  // new|saved|applied|rejected|archived
      "notes": "Great company culture, good remote policy",
      "analyzed_date": "2026-02-17T14:32:00Z",
      "updated_date": "2026-02-17T15:45:00Z",
      
      // Tracking Details
      "source": "batch_scan",  // batch_scan|manual|auto
      "source_url": "https://www.linkedin.com/jobs/search/...",
      "application_date": null,
      "application_url": null,
      "rejection_date": null,
      "rejection_reason": null,
      "interview_date": null,
      "interview_stage": null,
      
      // Compensation
      "salary_min": 180000,
      "salary_max": 250000,
      "salary_currency": "USD",
      "posting_date": "2026-02-10",
      "apply_difficulty": "medium",  // easy|medium|hard
      
      // Internal
      "synced": false,
      "sync_status": "pending",  // pending|synced|error
      "last_sync_attempt": null
    }
  ]
}
```

### Storage Keys (.local)

| Key | Type | Purpose |
|-----|------|---------|
| `tracked_jobs` | Array | Main job records |
| `dashboard_preferences` | Object | User filter/sort preferences |
| `sync_config` | Object | Cloud sync settings |
| `user_profile` | Object | Cached user profile for matching |
| `batch_queue` | Array | Pending jobs to sync to backend |
| `ui_state` | Object | Last viewed tab, scroll position |

### Query Patterns (StorageAdapter Implementation)

```javascript
// Helper functions for common queries
class JobStorageQueries {
  
  // Get all jobs matching status
  async getJobsByStatus(status) {
    // SELECT * FROM tracked_jobs WHERE status = status
  }
  
  // Get jobs with match >= threshold
  async getJobsByMinMatch(minMatch) {
    // SELECT * FROM tracked_jobs WHERE match_percentage >= minMatch
  }
  
  // Search jobs by title/company/skills
  async searchJobs(query) {
    // SELECT * FROM tracked_jobs WHERE
    //   job_title LIKE query OR company_name LIKE query OR
    //   matched_skills includes query OR missing_skills includes query
  }
  
  // Get recent jobs (last N)
  async getRecentJobs(limit = 50) {
    // SELECT * FROM tracked_jobs ORDER BY analyzed_date DESC LIMIT limit
  }
  
  // Get dashboard stats
  async getDashboardStats() {
    //   SELECT
    //     COUNT(*) as total_jobs,
    //     AVG(match_percentage) as avg_match,
    //     SUM(CASE WHEN ranking_level='high' THEN 1 ELSE 0 END) as high_count,
    //     SUM(CASE WHEN ranking_level='medium' THEN 1 ELSE 0 END) as medium_count,
    //     SUM(CASE WHEN ranking_level='low' THEN 1 ELSE 0 END) as low_count
  }
}
```

---

## Part 2: Backend Database Schema (PostgreSQL)

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_enabled BOOLEAN DEFAULT false,
    last_sync TIMESTAMP
);
```

### Tracked Jobs Table
```sql
CREATE TABLE tracked_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Job Identifiers
    job_id VARCHAR(255) NOT NULL,
    job_url TEXT,
    
    -- Job Content
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    description TEXT NOT NULL,
    posting_date DATE,
    apply_difficulty VARCHAR(50),
    
    -- Analysis Results
    match_percentage INTEGER CHECK (match_percentage >= 0 AND match_percentage <= 100),
    ranking_level VARCHAR(20) CHECK (ranking_level IN ('high', 'medium', 'low')),
    matched_skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    missing_skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    analysis_summary TEXT,
    
    -- Status & Tracking
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    notes TEXT,
    
    -- Application Status
    application_date TIMESTAMP,
    application_url TEXT,
    rejection_date TIMESTAMP,
    rejection_reason TEXT,
    interview_date TIMESTAMP,
    interview_stage VARCHAR(100),
    
    -- Compensation
    salary_min DECIMAL(10, 2),
    salary_max DECIMAL(10, 2),
    salary_currency VARCHAR(3) DEFAULT 'USD',
    
    -- Metadata
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    source_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite unique constraint ensures per-user uniqueness
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, job_id)
);

-- Performance indexes (separate CREATE INDEX statements for cross-db compatibility)
CREATE INDEX idx_user_status ON tracked_jobs(user_id, status);
CREATE INDEX idx_user_date ON tracked_jobs(user_id, created_at);
CREATE INDEX idx_user_match ON tracked_jobs(user_id, match_percentage);
CREATE INDEX idx_ranking ON tracked_jobs(ranking_level);
```

### Job Stats (Materialized View)
```sql
CREATE MATERIALIZED VIEW job_stats_by_user AS
SELECT
    user_id,
    COUNT(*) as total_jobs,
    ROUND(AVG(match_percentage), 2) as avg_match_percentage,
    COUNT(CASE WHEN ranking_level = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN ranking_level = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN ranking_level = 'low' THEN 1 END) as low_count,
    COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
    NOW() as last_updated
FROM tracked_jobs
GROUP BY user_id;

-- Refresh periodically
-- SELECT refresh_materialized_view('job_stats_by_user');
```

### Audit Log
```sql
CREATE TABLE job_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES tracked_jobs(id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL, -- created|updated|deleted|status_changed
    old_data TEXT,  -- JSON stored as TEXT for SQLite compatibility
    new_data TEXT,  -- JSON stored as TEXT for SQLite compatibility
    change_source VARCHAR(50), -- extension|api|admin
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance index (separate CREATE INDEX for compatibility)
CREATE INDEX idx_user_job_audit ON job_audit_log(user_id, job_id, created_at);
```

---

## Part 3: Migration Strategy

### Approach: Abstraction Layer (No Code Refactoring)

**Key Principle:**
The extension ALWAYS works with StorageAdapter, which abstracts the underlying storage backend.

```javascript
// extension/storage/storage-adapter.js

class StorageAdapter {
  constructor(options = {}) {
    this.backend = options.backend || 'local';  // 'local' | 'api' | 'postgres'
    this.apiUrl = options.apiUrl || 'http://localhost:8000';
    this.enableCaching = options.enableCaching !== false;
  }
  
  async initialize() {
    // Detect if backend is available
    // Set up sync if enabled
  }
  
  async saveJob(job) {
    const withTimestamps = this._addTimestamps(job);
    
    if (this.backend === 'local') {
      return await this._saveJobLocal(withTimestamps);
    } else if (this.backend === 'api') {
      // Dual-write: save locally AND to API
      const [local, remote] = await Promise.all([
        this._saveJobLocal(withTimestamps),
        this._saveJobApi(withTimestamps)
      ]);
      return remote;  // Return backend version as source of truth
    }
  }
  
  async getJobs(filters = {}) {
    if (this.backend === 'local') {
      return this._getJobsLocal(filters);
    } else if (this.backend === 'api') {
      return this._getJobsApi(filters);
    }
  }
  
  async deleteJob(jobId) {
    // Dual-delete if API mode
  }
  
  // Internal implementations
  async _saveJobLocal(job) {
    // chrome.storage.local impl
  }
  
  async _saveJobApi(job) {
    // REST API impl
  }
  
  _addTimestamps(job) {
    const now = new Date().toISOString();
    return {
      ...job,
      created_at: job.created_at || now,
      updated_at: now
    };
  }
}

// Export singleton
export const storageAdapter = new StorageAdapter({
  backend: 'local',  // Will change to 'api' after migration
  enableCaching: true
});
```

### Migration Timeline

**Phase 1 (Month 1): MVP Architecture**
- Extension uses StorageAdapter with `backend: 'local'`
- All data in chrome.storage.local
- User can manually export via settings

**Phase 2 (Month 2): Backend Preparation**
- Backend endpoints ready (`/jobs`, `/batch-score-jobs`)
- Database schema deployed (SQLite initially)
- Migration APIs implemented (`/jobs/import`, `/jobs/export`)

**Phase 3 (Month 3): Dual-Write**
- StorageAdapter switches to `backend: 'api'`
- New jobs saved to BOTH local + API
- Existing local jobs: lazy-sync on next read
- User sees toggle: "Sync to Cloud (Beta)"

**Phase 4 (Month 4): Cloud-First**
- StorageAdapter prioritizes backend
- Local becomes cache only
- Successful sync = delete local copy
- Option to disable local caching

**Phase 5+: PostgreSQL Migration**
- Seamless switch from SQLite to PostgreSQL
- StorageAdapter backend still handles it
- No UI/extension changes needed

### Migration Checklist

```sql
-- Pre-migration (Backend Setup)
✓ Create users table with email auth
✓ Create tracked_jobs table with proper indexes
✓ Add Alembic migrations folder
✓ Implement /jobs/import endpoint (batch insert)
✓ Implement /jobs/export endpoint
✓ Add audit logging triggers

-- Data Migration
✓ Run backup of chrome.storage (user exports)
✓ POST /jobs/import with batch data
✓ Verify record counts match
✓ Test query performance on new indexes

-- Cutover
✓ Deploy new StorageAdapter code
✓ Enable "Sync to Cloud" toggle for beta users
✓ Monitor: error logs, API response times
✓ Disable local-only mode after 1 month (30-day backup)

-- Post-migration
✓ Monitor cloud storage growth
✓ Refresh materialized views daily
✓ Archive old jobs (> 6 months) to cold storage
```

---

## Part 4: Index Strategy (Performance)

### Primary Indexes (Query Optimization)

| Table | Columns | Reason |
|-------|---------|--------|
| tracked_jobs | (user_id, status) | Filter by user and status |
| tracked_jobs | (user_id, created_at) | Recent jobs query |
| tracked_jobs | (user_id, match_percentage) | Filter by min match |
| tracked_jobs | (ranking_level) | Global aggregations |
| job_audit_log | (user_id, job_id, created_at) | Audit trail search |

### Query Plans to Test

```sql
-- Q1: Get user's recent high-match jobs
SELECT * FROM tracked_jobs
WHERE user_id = ? AND status IN ('new', 'saved')
  AND match_percentage >= ?
ORDER BY created_at DESC
LIMIT 10;

-- Q2: Dashboard stats
SELECT
  ranking_level,
  COUNT(*) as count
FROM tracked_jobs
WHERE user_id = ?
GROUP BY ranking_level;

-- Q3: Search jobs
SELECT * FROM tracked_jobs
WHERE user_id = ?
  AND (job_title ILIKE ? OR company_name ILIKE ?)
LIMIT 50;
```

---

## Part 5: Rollback Strategy

If needed to revert to local-only:

```javascript
// Automatic fallback
async function saveJobWithFallback(job) {
  try {
    // Try API first
    return await storageAdapter._saveJobApi(job);
  } catch (apiError) {
    console.warn('API failed, falling back to local', apiError);
    // Fall back to local
    return await storageAdapter._saveJobLocal(job);
  }
}
```

---

## Deployment Checklist

- [ ] Database schema applied in dev/staging
- [ ] Migration scripts tested with sample data
- [ ] StorageAdapter tested with both backends
- [ ] API endpoints load-tested (100 reqs/sec)
- [ ] Materialize views created and refreshed
- [ ] Backup procedures documented
- [ ] Rollback procedures tested
- [ ] User communication drafted
- [ ] Beta user group identified
- [ ] Monitoring alerts configured
