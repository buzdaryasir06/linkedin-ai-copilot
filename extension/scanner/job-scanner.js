/**
 * scanner/job-scanner.js
 *
 * Main coordinator for job page scanning, extraction, batch scoring, and overlay.
 * Orchestrates content script, background script, and DOM operations.
 */

class JobScanner {
  constructor(options = {}) {
    this.isScanning = false;
    this.scannedJobs = new Map(); // jobId -> score
    this.extractedJobs = [];
    this.batchSize = options.batchSize || 50;
    this.autoScan = options.autoScan !== false;
    this.scoreThreshold = options.scoreThreshold || 0; // Show all by default
    this.logger = options.logger || console;
  }

  /**
   * Initialize scanner on job page
   */
  async initialize() {
    if (!JobPageDetector.isJobPage()) {
      this.logger.log('[JobScanner] Not on a job page, skipping');
      return false;
    }

    this.logger.log('[JobScanner] Initializing on job page');

    // Wait for jobs to load
    const loaded = await JobPageDetector.waitForJobsToLoad();
    if (!loaded) {
      this.logger.warn('[JobScanner] No jobs found on page');
      return false;
    }

    // Initial scan
    if (this.autoScan) {
      await this.scanVisibleJobs();
    }

    // Watch for new jobs (infinite scroll)
    JobPageDetector.watchForNewJobs(
      (newElements) => {
        this.logger.log('[JobScanner] New jobs detected, rescanning...');
        this.scanVisibleJobs();
      },
      { debounceMs: 2000, maxWatchTime: 300000 } // 5 min max
    );

    return true;
  }

  /**
   * Scan all visible jobs on page
   */
  async scanVisibleJobs() {
    if (this.isScanning) {
      this.logger.warn('[JobScanner] Already scanning, deferring request');
      return;
    }

    try {
      this.isScanning = true;
      BadgeOverlay.showNotification('🔍 Scanning jobs...', 'info');

      // Extract jobs from DOM
      const jobElements = document.querySelectorAll('[data-job-id]');
      this.logger.log(`[JobScanner] Found ${jobElements.length} job cards`);

      const jobs = JobCardParser.parseJobCards(jobElements);
      this.logger.log(`[JobScanner] Parsed ${jobs.length} valid jobs`);

      if (jobs.length === 0) {
        this.logger.warn('[JobScanner] No valid jobs extracted');
        return;
      }

      // Store extracted jobs
      this.extractedJobs = jobs;

      // Send to background for batch scoring
      await this.requestBatchScoring(jobs);

    } catch (error) {
      this.logger.error('[JobScanner] Scan error:', error);
      BadgeOverlay.showNotification('❌ Scan failed: ' + error.message, 'error');
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Request batch scoring from background script
   */
  async requestBatchScoring(jobs) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'BATCH_SCORE_JOBS',
          jobs: jobs.map(j => ({
            job_id: j.job_id,
            job_title: j.job_title,
            company_name: j.company_name,
            location: j.location,
            description: j.description,
          })),
          pageContext: JobPageDetector.getPageContext(),
        },
        (response) => {
          if (chrome.runtime.lastError) {
            this.logger.error('[JobScanner] Chrome error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          if (!response) {
            this.logger.error('[JobScanner] No response from background');
            BadgeOverlay.showNotification('❌ No response from backend', 'error');
            reject(new Error('No response'));
            return;
          }

          if (!response.success) {
            this.logger.error('[JobScanner] Backend error:', response.error);
            BadgeOverlay.showNotification(`❌ ${response.error}`, 'error');
            reject(response.error);
            return;
          }

          this.handleBatchScoringResponse(response.data, jobs);
          resolve(response.data);
        }
      );
    });
  }

  /**
   * Handle batch scoring response
   */
  async handleBatchScoringResponse(scoreResults, originalJobs) {
    // Map scores by job ID
    const scoreMap = {};
    for (const result of scoreResults) {
      scoreMap[result.job_id] = result;
      this.scannedJobs.set(result.job_id, result);
    }

    this.logger.log(`[JobScanner] Received scores for ${scoreResults.length} jobs`);

    // Inject badges
    const injectionResult = BadgeOverlay.injectBadges(scoreMap, originalJobs);

    // Notify success
    BadgeOverlay.showNotification(
      `✓ ${injectionResult.injected.length} jobs analyzed!`,
      'success'
    );

    // Optionally store jobs that meet threshold
    if (this.scoreThreshold > 0) {
      await this.storeHighScoringJobs(scoreResults);
    }
  }

  /**
   * Store jobs above threshold to extension storage
   */
  async storeHighScoringJobs(scoreResults) {
    const filtered = scoreResults.filter(r => r.match_score >= this.scoreThreshold);

    if (filtered.length === 0) {
      this.logger.log('[JobScanner] No jobs met threshold for storage');
      return;
    }

    // Send to background to save to storage
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'STORE_SCANNED_JOBS',
          jobs: filtered.map((score, idx) => {
            const original = this.extractedJobs.find(j => j.job_id === score.job_id);
            return {
              job_id: score.job_id,
              job_title: original?.job_title || 'Unknown',
              company_name: original?.company_name || 'Unknown',
              location: original?.location || '',
              description: original?.description || '',
              job_url: original?.job_url || '',
              match_percentage: score.match_score,
              ranking_level: score.ranking_level,
              missing_skills: score.missing_skills || [],
              matched_skills: score.matched_skills || [],
              status: 'new',
              source: 'batch_scan',
              source_url: window.location.href,
            };
          }),
        },
        (response) => {
          if (response?.success) {
            this.logger.log(`[JobScanner] Stored ${filtered.length} high-scoring jobs`);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Get scan summary
   */
  getSummary() {
    const scores = Array.from(this.scannedJobs.values()).map(s => s.match_score);

    return {
      totalScanned: this.scannedJobs.size,
      highMatches: scores.filter(s => s >= 75).length,
      mediumMatches: scores.filter(s => s >= 50 && s < 75).length,
      lowMatches: scores.filter(s => s < 50).length,
      averageScore: scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
    };
  }

  /**
   * Export scan results as CSV
   */
  exportResults() {
    const headers = ['Job ID', 'Title', 'Company', 'Location', 'Match %', 'Level', 'Missing Skills'];
    const rows = [];

    for (const [jobId, score] of this.scannedJobs) {
      const job = this.extractedJobs.find(j => j.job_id === jobId);
      if (job) {
        rows.push([
          jobId,
          job.job_title,
          job.company_name,
          job.location || '',
          score.match_score,
          score.ranking_level,
          (score.missing_skills || []).join('; '),
        ]);
      }
    }

    let csv = headers.join(',') + '\n';
    csv += rows.map(row => 
      row.map(cell => {
        // Remove newlines and escape quotes for clean CSV
        const sanitized = String(cell)
          .replace(/\r?\n/g, ' ')  // Replace newlines with spaces
          .replace(/"/g, '""');     // Escape quotes
        return `"${sanitized}"`;
      }).join(',')
    ).join('\n');

    return csv;
  }

  /**
   * Clear scan results and badges
   */
  clear() {
    BadgeOverlay.removeAllBadges();
    BadgeOverlay.clearHighlights();
    this.scannedJobs.clear();
    this.extractedJobs = [];
    this.logger.log('[JobScanner] Cleared scan results');
  }
}

// Initialize scanner if on job page
if (JobPageDetector.isJobPage()) {
  const scanner = new JobScanner({
    autoScan: true,
    scoreThreshold: 60, // Store jobs above 60%
  });

  window.jobScanner = scanner; // Expose globally

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scanner.initialize());
  } else {
    scanner.initialize();
  }
}
