/**
 * storage/job-storage.js
 *
 * High-level job storage queries built on top of StorageAdapter.
 * Provides convenience methods for common job querying patterns.
 */

class JobStorage {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Get all jobs with a specific status
   */
  async getJobsByStatus(status) {
    return this.adapter.queryJobs({
      filters: { status: [status] },
      pageSize: 1000,
    });
  }

  /**
   * Get jobs matching criteria for dashboard high-interest display
   */
  async getHighInterestJobs(minMatch = 70) {
    return this.adapter.queryJobs({
      filters: {
        minMatchPercentage: minMatch,
        status: ['new', 'saved'],
      },
      sortBy: 'created_at',
      sortOrder: 'desc',
      pageSize: 20,
    });
  }

  /**
   * Search jobs across multiple fields
   */
  async searchJobs(query, options = {}) {
    return this.adapter.queryJobs({
      search: query,
      filters: options.filters || {},
      sortBy: options.sortBy || 'created_at',
      sortOrder: options.sortOrder || 'desc',
      pageSize: options.pageSize || 10,
      page: options.page || 1,
    });
  }

  /**
   * Get recent jobs (last N days)
   */
  async getRecentJobs(days = 7, limit = 50) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);

    const allJobs = await this.adapter.queryJobs({ pageSize: 1000 });
    const recent = allJobs.jobs.filter(job =>
      new Date(job.created_at) >= pastDate
    );

    return {
      jobs: recent.slice(0, limit),
      total: recent.length,
    };
  }

  /**
   * Get jobs by ranking level
   */
  async getJobsByRanking(rankingLevel) {
    return this.adapter.queryJobs({
      filters: { rankingLevel: [rankingLevel] },
      sortBy: 'created_at',
      sortOrder: 'desc',
      pageSize: 1000,
    });
  }

  /**
   * Get jobs applied to
   */
  async getAppliedJobs() {
    return this.getJobsByStatus('applied');
  }

  /**
   * Get jobs saved for later
   */
  async getSavedJobs() {
    return this.getJobsByStatus('saved');
  }

  /**
   * Get rejected jobs (reasons analysis)
   */
  async getRejectedJobs() {
    return this.getJobsByStatus('rejected');
  }

  /**
   * Get jobs grouped by company
   */
  async getJobsByCompany(company) {
    return this.adapter.queryJobs({
      search: company,
      filters: {},
      pageSize: 1000,
    });
  }

  /**
   * Get jobs requiring specific skill
   */
  async getJobsRequiringSkill(skill) {
    // This is a post-fetch filter since stored jobs don't have indexed skills
    const allJobs = await this.adapter.queryJobs({ pageSize: 1000 });

    const filtered = allJobs.jobs.filter(job =>
      (job.missing_skills && job.missing_skills.includes(skill)) ||
      (job.description && job.description.toLowerCase().includes(skill.toLowerCase()))
    );

    return {
      jobs: filtered,
      total: filtered.length,
    };
  }

  /**
   * Get salary range statistics
   */
  async getSalaryStats() {
    const all = await this.adapter.queryJobs({ pageSize: 1000 });
    const withSalary = all.jobs.filter(j => j.salary_min && j.salary_max);

    if (withSalary.length === 0) {
      return { min: null, max: null, avg: null, median: null };
    }

    const avgSalaries = withSalary.map(j => (j.salary_min + j.salary_max) / 2);
    const sorted = avgSalaries.sort((a, b) => a - b);

    // Calculate median correctly for even/odd length arrays
    let median;
    if (sorted.length % 2 === 0) {
      // Even: average of two middle values
      median = (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    } else {
      // Odd: middle value
      median = sorted[Math.floor(sorted.length / 2)];
    }

    return {
      min: Math.min(...withSalary.map(j => j.salary_min)),
      max: Math.max(...withSalary.map(j => j.salary_max)),
      avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      median: Math.round(median),
      count: withSalary.length,
    };
  }

  /**
   * Get skill gap analysis (most common missing skills)
   */
  async getSkillGaps(limit = 10) {
    const all = await this.adapter.queryJobs({ pageSize: 1000 });

    const skillCounts = {};
    for (const job of all.jobs) {
      if (job.missing_skills && Array.isArray(job.missing_skills)) {
        for (const skill of job.missing_skills) {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
      }
    }

    return Object.entries(skillCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([skill, count]) => ({ skill, count }));
  }

  /**
   * Get matched skills (most commonly owned)
   */
  async getMatchedSkillsFrequency(limit = 15) {
    const all = await this.adapter.queryJobs({ pageSize: 1000 });

    const skillCounts = {};
    for (const job of all.jobs) {
      if (job.matched_skills && Array.isArray(job.matched_skills)) {
        for (const skill of job.matched_skills) {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
      }
    }

    return Object.entries(skillCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([skill, count]) => ({ skill, count }));
  }

  /**
   * Get jobs by match percentage ranges
   */
  async getJobsByMatchRange(minMatch, maxMatch) {
    return this.adapter.queryJobs({
      filters: {
        minMatchPercentage: minMatch,
        // Note: maxMatch would need custom filter
      },
      pageSize: 1000,
    }).then(result => ({
      ...result,
      jobs: result.jobs.filter(j => {
        // Handle null/undefined match_percentage
        if (typeof j.match_percentage !== 'number') return true; // Include unscored jobs
        return j.match_percentage <= maxMatch;
      }),
    }));
  }

  /**
   * Get jobs by location (city/region)
   */
  async getJobsByLocation(location) {
    return this.adapter.queryJobs({
      search: location,
      pageSize: 1000,
    });
  }

  /**
   * Bulk update job status (e.g., mark all as reviewed)
   */
  async updateMultipleJobsStatus(jobIds, newStatus) {
    const promises = jobIds.map(id =>
      this.adapter.updateJob(id, { status: newStatus })
    );

    return Promise.allSettled(promises);
  }

  /**
   * Export jobs to CSV
   */
  async exportToCSV() {
    const all = await this.adapter.queryJobs({ pageSize: 10000 });

    const headers = [
      'Job Title',
      'Company',
      'Location',
      'Match %',
      'Level',
      'Status',
      'Salary Range',
      'Matched Skills',
      'Missing Skills',
      'Applied Date',
      'Notes',
    ];

    const rows = all.jobs.map(job => [
      job.job_title,
      job.company_name,
      job.location || '',
      job.match_percentage,
      job.ranking_level,
      job.status,
      job.salary_min && job.salary_max ? `${job.salary_min}-${job.salary_max}` : '',
      (job.matched_skills || []).join('; '),
      (job.missing_skills || []).join('; '),
      job.application_date || '',
      job.notes || '',
    ]);

    let csv = headers.join(',') + '\n';
    csv += rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    return csv;
  }

  /**
   * Import jobs from the backend (one-time migration)
   */
  async importFromBackend() {
    // This would call a backend endpoint like POST /jobs/export
    // and then bulk save locally
    // Implementation depends on backend providing this endpoint
  }

  /**
   * Clean up old jobs (archive)
   */
  async archiveOldJobs(daysThreshold = 180) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    const all = await this.adapter.queryJobs({ pageSize: 10000 });
    const oldJobIds = all.jobs
      .filter(job => new Date(job.created_at) < cutoffDate && job.status !== 'applied')
      .map(job => job.id);

    // Mark as archived instead of deleting
    return this.updateMultipleJobsStatus(oldJobIds, 'archived');
  }

  /**
   * Duplicate check (prevent duplicate saves)
   */
  async isDuplicateJob(jobId, jobTitle, company) {
    const all = await this.adapter.queryJobs({ pageSize: 10000 });

    return all.jobs.some(job =>
      job.job_id === jobId ||
      ((job.job_title || '').toLowerCase() === (jobTitle || '').toLowerCase() &&
        (job.company_name || '').toLowerCase() === (company || '').toLowerCase())
    );
  }

  /**
   * Get application funnel data
   */
  async getApplicationFunnel() {
    const all = await this.adapter.queryJobs({ pageSize: 10000 });

    const funnel = {
      total_viewed: all.total,
      total_saved: all.jobs.filter(j => j.status === 'saved').length,
      total_applied: all.jobs.filter(j => j.status === 'applied').length,
      total_interviewed: all.jobs.filter(j => j.status === 'interviewed').length,
      total_rejected: all.jobs.filter(j => j.status === 'rejected').length,
    };

    // Calculate conversion rates as numbers (not strings)
    funnel.conversion_rate_viewed_to_saved = funnel.total_viewed > 0
      ? Number((funnel.total_saved / funnel.total_viewed * 100).toFixed(2))
      : 0;

    funnel.conversion_rate_saved_to_applied = funnel.total_saved > 0
      ? Number((funnel.total_applied / funnel.total_saved * 100).toFixed(2))
      : 0;

    funnel.conversion_rate_applied_to_interview = funnel.total_applied > 0
      ? Number((funnel.total_interviewed / funnel.total_applied * 100).toFixed(2))
      : 0;

    return funnel;
  }
}

// Export helper and singleton
const createJobStorage = (adapter) => new JobStorage(adapter);
const jobStorage = new JobStorage(storageAdapter);
