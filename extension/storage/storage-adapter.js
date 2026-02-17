/**
 * storage/storage-adapter.js
 *
 * Unified storage interface supporting multiple backends:
 * - Phase 1 (MVP): chrome.storage.local
 * - Phase 2: REST API (dual-write during migration)
 * - Phase 3+: PostgreSQL backend (transparent to UI)
 *
 * The extension never directly calls chrome.storage; it always uses this adapter.
 * This ensures we can migrate backends without refactoring UI code.
 */

class StorageAdapter {
  constructor(options = {}) {
    this.backend = options.backend || 'local'; // 'local' | 'api' | 'postgres'
    this.apiUrl = options.apiUrl || 'http://localhost:8000';
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    
    // In-memory cache for performance
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // Request queuing for batch operations
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.queueDebounceMs = 500;
    this.queueTimer = null;
    
    this.logger = options.logger || console;
  }

  /**
   * Initialize adapter (check backend availability, setup sync, etc)
   */
  async initialize() {
    try {
      this.logger.log('[StorageAdapter] Initializing with backend:', this.backend);
      
      if (this.backend === 'api') {
        // Check if backend is reachable
        const isHealthy = await this._checkBackendHealth();
        if (!isHealthy) {
          this.logger.warn('[StorageAdapter] Backend unavailable, falling back to local');
          this.backend = 'local';
        }
      }
      
      // Load sync metadata
      const metadata = await this._getMetadata();
      this.syncEnabled = metadata?.sync_enabled || false;
    } catch (error) {
      this.logger.error('[StorageAdapter] Init error:', error);
      // Gracefully downgrade to local
      this.backend = 'local';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Public API: Job Operations
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Save a job record
   * @param {Object} job - Job data
   * @returns {Promise<Object>} Saved job
   */
  async saveJob(job) {
    try {
      const validated = this._validateJob(job);
      const withTimestamps = this._addTimestamps(validated);
      const jobId = validated?.id || this._generateUUID();
      const withId = { id: jobId, ...withTimestamps };

      if (this.backend === 'local') {
        return await this._saveJobLocal(withId);
      } else if (this.backend === 'api') {
        return await this._saveJobWithDualWrite(withId);
      }
    } catch (error) {
      this.logger.error('[StorageAdapter] Save job error:', error);
      throw error;
    }
  }

  /**
   * Get a single job by ID
   * @param {string} jobId - Job UUID
   * @returns {Promise<Object|null>}
   */
  async getJob(jobId) {
    try {
      // Check cache first
      if (this._isCached(`job_${jobId}`)) {
        return this._getFromCache(`job_${jobId}`);
      }

      let job;
      if (this.backend === 'local') {
        job = await this._getJobLocal(jobId);
      } else if (this.backend === 'api') {
        job = await this._getJobApi(jobId);
      }

      if (job && this.cacheEnabled) {
        this._setCache(`job_${jobId}`, job);
      }
      return job;
    } catch (error) {
      this.logger.error('[StorageAdapter] Get job error:', error);
      return null;
    }
  }

  /**
   * Query jobs with filters, pagination, sorting
   * @param {Object} options - Query options
   * @returns {Promise<{jobs: Array, total: number, page: number}>}
   */
  async queryJobs(options = {}) {
    try {
      const cacheKey = `query_${JSON.stringify(options)}`;
      
      if (this._isCached(cacheKey)) {
        return this._getFromCache(cacheKey);
      }

      let result;
      if (this.backend === 'local') {
        result = await this._queryJobsLocal(options);
      } else if (this.backend === 'api') {
        result = await this._queryJobsApi(options);
      }

      if (result && this.cacheEnabled) {
        this._setCache(cacheKey, result);
      }
      return result;
    } catch (error) {
      this.logger.error('[StorageAdapter] Query jobs error:', error);
      return { jobs: [], total: 0, page: options.page || 1 };
    }
  }

  /**
   * Update a job (partial update)
   * @param {string} jobId - Job UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated job
   */
  async updateJob(jobId, updates) {
    try {
      const currentJob = await this.getJob(jobId);
      if (!currentJob) {
        throw new Error(`Job not found: ${jobId}`);
      }

      const updatedJob = {
        ...currentJob,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const validated = this._validateJob(updatedJob);

      if (this.backend === 'local') {
        await this._updateJobLocal(jobId, validated);
      } else if (this.backend === 'api') {
        await this._updateJobApi(jobId, validated);
      }

      // Invalidate cache
      this._invalidateCache(`job_${jobId}`);
      this._invalidateCache('query_*');

      return validated;
    } catch (error) {
      this.logger.error('[StorageAdapter] Update job error:', error);
      throw error;
    }
  }

  /**
   * Delete a job
   * @param {string} jobId - Job UUID
   * @returns {Promise<boolean>}
   */
  async deleteJob(jobId) {
    try {
      if (this.backend === 'local') {
        await this._deleteJobLocal(jobId);
      } else if (this.backend === 'api') {
        await this._deleteJobApi(jobId);
      }

      // Invalidate cache
      this._invalidateCache(`job_${jobId}`);
      this._invalidateCache('query_*');

      return true;
    } catch (error) {
      this.logger.error('[StorageAdapter] Delete job error:', error);
      return false;
    }
  }

  /**
   * Bulk save multiple jobs
   * @param {Array} jobs - Array of job objects
   * @returns {Promise<Array>} Saved jobs
   */
  async saveJobsInBatch(jobs) {
    try {
      const validated = jobs.map(j => this._validateJob(j));
      const withTimestamps = validated.map(j => this._addTimestamps(j));

      if (this.backend === 'local') {
        return await this._saveJobsBatchLocal(withTimestamps);
      } else if (this.backend === 'api') {
        return await this._saveJobsBatchApi(withTimestamps);
      }
    } catch (error) {
      this.logger.error('[StorageAdapter] Batch save error:', error);
      throw error;
    }
  }

  /**
   * Get dashboard summary statistics
   * @returns {Promise<Object>}
   */
  async getDashboardStats() {
    try {
      if (this._isCached('stats')) {
        return this._getFromCache('stats');
      }

      let stats;
      if (this.backend === 'local') {
        stats = await this._getStatsLocal();
      } else if (this.backend === 'api') {
        stats = await this._getStatsApi();
      }

      if (stats && this.cacheEnabled) {
        this._setCache('stats', stats, 60000); // 1 min cache
      }
      return stats;
    } catch (error) {
      this.logger.error('[StorageAdapter] Get stats error:', error);
      return this._getEmptyStats();
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Backend Implementation: chrome.storage.local
  // ─────────────────────────────────────────────────────────────────────

  async _saveJobLocal(job) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        const jobs = result.tracked_jobs || [];
        
        // Check if job already exists
        const existingIdx = jobs.findIndex(j => j.id === job.id);
        if (existingIdx >= 0) {
          jobs[existingIdx] = job;
        } else {
          jobs.push(job);
        }

        chrome.storage.local.set({ tracked_jobs: jobs }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(job);
          }
        });
      });
    });
  }

  async _getJobLocal(jobId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        const jobs = result.tracked_jobs || [];
        const job = jobs.find(j => j.id === jobId);
        resolve(job || null);
      });
    });
  }

  async _queryJobsLocal(options = {}) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        let jobs = result.tracked_jobs || [];

        // Apply filters
        jobs = this._applyFilters(jobs, options.filters || {});

        // Apply search
        if (options.search) {
          jobs = this._applySearch(jobs, options.search);
        }

        // Apply sorting
        if (options.sortBy) {
          jobs = this._applySorting(jobs, options.sortBy, options.sortOrder);
        }

        // Apply pagination
        const page = options.page || 1;
        const pageSize = options.pageSize || 10;
        const totalRecords = jobs.length;
        const paginatedJobs = jobs.slice((page - 1) * pageSize, page * pageSize);

        resolve({
          jobs: paginatedJobs,
          total: totalRecords,
          page,
          pageSize,
          totalPages: Math.ceil(totalRecords / pageSize),
        });
      });
    });
  }

  async _updateJobLocal(jobId, updates) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        const jobs = result.tracked_jobs || [];
        const idx = jobs.findIndex(j => j.id === jobId);
        
        if (idx < 0) {
          reject(new Error(`Job not found: ${jobId}`));
          return;
        }

        jobs[idx] = updates;
        chrome.storage.local.set({ tracked_jobs: jobs }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(updates);
          }
        });
      });
    });
  }

  async _deleteJobLocal(jobId) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        let jobs = result.tracked_jobs || [];
        jobs = jobs.filter(j => j.id !== jobId);
        
        chrome.storage.local.set({ tracked_jobs: jobs }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      });
    });
  }

  async _saveJobsBatchLocal(jobs) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        let stored = result.tracked_jobs || [];
        
        // Merge new jobs with existing
        const jobMap = new Map(stored.map(j => [j.id, j]));
        for (const job of jobs) {
          jobMap.set(job.id, job);
        }

        const merged = Array.from(jobMap.values());
        chrome.storage.local.set({ tracked_jobs: merged }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(jobs);
          }
        });
      });
    });
  }

  async _getStatsLocal() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tracked_jobs'], (result) => {
        const jobs = result.tracked_jobs || [];
        
        const stats = {
          total_jobs: jobs.length,
          avg_match_percentage: 0,
          high_count: 0,
          medium_count: 0,
          low_count: 0,
          applied_count: 0,
          rejected_count: 0,
          status_breakdown: {},
        };

        if (jobs.length === 0) {
          resolve(stats);
          return;
        }

        let totalMatch = 0;
        for (const job of jobs) {
          totalMatch += job.match_percentage || 0;
          
          if (job.ranking_level === 'high') stats.high_count++;
          else if (job.ranking_level === 'medium') stats.medium_count++;
          else if (job.ranking_level === 'low') stats.low_count++;
          
          if (job.status === 'applied') stats.applied_count++;
          if (job.status === 'rejected') stats.rejected_count++;
          
          stats.status_breakdown[job.status] = (stats.status_breakdown[job.status] || 0) + 1;
        }

        stats.avg_match_percentage = Math.round(totalMatch / jobs.length);
        resolve(stats);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Backend Implementation: REST API (Future)
  // ─────────────────────────────────────────────────────────────────────

  async _saveJobWithDualWrite(job) {
    try {
      const [localResult, apiResult] = await Promise.allSettled([
        this._saveJobLocal(job),
        this._saveJobApi(job),
      ]);

      // Prefer API result as source of truth, fallback to local
      if (apiResult.status === 'fulfilled') {
        return apiResult.value;
      }
      return localResult.value;
    } catch (error) {
      // Fall back to local if both fail
      return this._saveJobLocal(job);
    }
  }

  async _saveJobApi(job) {
    const response = await fetch(`${this.apiUrl}/jobs/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }

  async _getJobApi(jobId) {
    const response = await fetch(`${this.apiUrl}/jobs/${jobId}`);
    if (!response.ok) return null;
    return response.json();
  }

  async _queryJobsApi(options = {}) {
    const params = new URLSearchParams({
      page: options.page || 1,
      pageSize: options.pageSize || 10,
      ...(options.sortBy && { sortBy: options.sortBy }),
      ...(options.sortOrder && { sortOrder: options.sortOrder }),
      ...(options.search && { search: options.search }),
      ...(options.filters && { filters: JSON.stringify(options.filters) }),
    });

    const response = await fetch(`${this.apiUrl}/jobs?${params}`);
    if (!response.ok) throw new Error('API error');
    return response.json();
  }

  async _updateJobApi(jobId, updates) {
    const response = await fetch(`${this.apiUrl}/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }

  async _deleteJobApi(jobId) {
    const response = await fetch(`${this.apiUrl}/jobs/${jobId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  }

  async _saveJobsBatchApi(jobs) {
    const response = await fetch(`${this.apiUrl}/jobs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }

  async _getStatsApi() {
    const response = await fetch(`${this.apiUrl}/jobs/stats`);
    if (!response.ok) throw new Error('API error');
    return response.json();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────

  _validateJob(job) {
    if (!job.job_id) throw new Error('job_id is required');
    if (!job.job_title) throw new Error('job_title is required');
    if (!job.company_name) throw new Error('company_name is required');
    
    return {
      ...job,
      match_percentage: Math.min(100, Math.max(0, job.match_percentage || 0)),
      status: job.status || 'new',
      missing_skills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
      matched_skills: Array.isArray(job.matched_skills) ? job.matched_skills : [],
    };
  }

  _addTimestamps(job) {
    const now = new Date().toISOString();
    return {
      ...job,
      created_at: job.created_at || now,
      updated_at: now,
    };
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  _applyFilters(jobs, filters = {}) {
    let result = jobs;

    if (filters.status && filters.status.length > 0) {
      result = result.filter(j => filters.status.includes(j.status));
    }

    if (filters.minMatchPercentage) {
      result = result.filter(j => j.match_percentage >= filters.minMatchPercentage);
    }

    if (filters.rankingLevel && filters.rankingLevel.length > 0) {
      result = result.filter(j => filters.rankingLevel.includes(j.ranking_level));
    }

    return result;
  }

  _applySearch(jobs, searchQuery) {
    const q = searchQuery.toLowerCase();
    return jobs.filter(j => 
      j.job_title.toLowerCase().includes(q) ||
      j.company_name.toLowerCase().includes(q) ||
      (j.location && j.location.toLowerCase().includes(q)) ||
      (j.notes && j.notes.toLowerCase().includes(q))
    );
  }

  _applySorting(jobs, sortBy = 'created_at', sortOrder = 'desc') {
    const sorted = [...jobs].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      // Handle null/undefined values defensively
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        const aStr = (aVal ?? '').toString();
        const bStr = (bVal ?? '').toString();
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }
      
      // For numeric comparison, coerce null/undefined to 0
      const aNum = Number(aVal ?? 0);
      const bNum = Number(bVal ?? 0);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return sorted;
  }

  // Cache management
  _isCached(key) {
    if (!this.cacheEnabled) return false;
    
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    
    if (Date.now() - timestamp > this.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return false;
    }
    
    return this.cache.has(key);
  }

  _getFromCache(key) {
    return this.cache.get(key);
  }

  _setCache(key, value, ttl = null) {
    if (!this.cacheEnabled) return;
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  _invalidateCache(pattern = '*') {
    if (pattern === '*') {
      this.cache.clear();
      this.cacheTimestamps.clear();
    } else if (pattern.endsWith('*')) {
      // Wildcard pattern (e.g., 'query_*')
      const prefix = pattern.slice(0, -1);
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          this.cacheTimestamps.delete(key);
        }
      }
    }
  }

  async _checkBackendHealth() {
    try {
      const response = await fetch(`${this.apiUrl}/health`, { timeout: 5000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  async _getMetadata() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sync_metadata'], (result) => {
        resolve(result.sync_metadata || {});
      });
    });
  }

  _getEmptyStats() {
    return {
      total_jobs: 0,
      avg_match_percentage: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      applied_count: 0,
      rejected_count: 0,
      status_breakdown: {},
    };
  }
}

// Export singleton instance
const storageAdapter = new StorageAdapter({
  backend: 'local', // Will change to 'api' after migration
  cacheEnabled: true,
});

// Initialize on first use
storageAdapter.initialize().catch(err => console.error('Failed to init storage:', err));
