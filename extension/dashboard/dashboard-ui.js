/**
 * dashboard/dashboard-ui.js
 *
 * Main controller for the Job Dashboard tab.
 * Manages state, filters, sorting, pagination, and coordination between UI components.
 */

class DashboardUI {
  constructor(options = {}) {
    this.container = options.container;
    this.storage = options.storage;
    this.jobStorage = options.jobStorage;

    // State
    this.state = {
      jobs: [],
      stats: {},
      totalRecords: 0,
      page: 1,
      pageSize: 10,
      sortBy: 'created_at',
      sortOrder: 'desc',
      filters: {
        status: [],
        minMatchPercentage: 0,
        rankingLevel: [],
      },
      searchQuery: '',
      isLoading: false,
      selectedJobIds: new Set(),
    };

    // Sub-components
    this.tableComponent = null;
    this.filterComponent = null;
    this.paginationComponent = null;
    this.statsComponent = null;

    // Debounce timers
    this.searchDebounce = null;
    this.filterDebounce = null;
  }

  /**
   * Initialize dashboard UI
   */
  async initialize() {
    this.render();
    await this.loadJobs();
    this.attachEventListeners();
  }

  /**
   * Main render method
   */
  render() {
    this.container.innerHTML = `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <h2>📊 Job Dashboard</h2>
          <div class="dashboard-controls">
            <button class="btn btn-secondary" id="exportBtn" title="Export to CSV">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button class="btn btn-danger" id="deleteSelectedBtn" title="Delete selected jobs" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span class="delete-label">Delete Selected</span>
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="dashboard-stats" id="statsContainer"></div>

        <!-- Filters -->
        <div class="dashboard-filters" id="filterContainer"></div>

        <!-- Search -->
        <div class="dashboard-search">
          <input 
            type="text" 
            id="searchInput" 
            placeholder="Search jobs by title, company, location, or notes..."
            class="search-input"
          />
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        <div id="tableContainer"></div>
        <div id="paginationContainer"></div>
      </div>
    `;
  }

  /**
   * Load dashboard stats
   */
  async renderStats() {
    try {
      this.state.stats = await this.storage.getDashboardStats();
    } catch (error) {
      console.error('[DashboardUI] Failed to fetch stats:', error);
      this.state.stats = {};
    }

    const s = {
      total_jobs: this.state.stats?.total_jobs ?? 0,
      avg_match_percentage: this.state.stats?.avg_match_percentage ?? 0,
      high_count: this.state.stats?.high_count ?? 0,
      medium_count: this.state.stats?.medium_count ?? 0,
      low_count: this.state.stats?.low_count ?? 0,
      applied_count: this.state.stats?.applied_count ?? 0,
    };

    const statsHTML = `
      <div class="stat-card">
        <div class="stat-value">${s.total_jobs}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.avg_match_percentage}%</div>
        <div class="stat-label">Avg Match</div>
      </div>
      <div class="stat-card">
        <div class="stat-badge high">${s.high_count}</div>
        <div class="stat-label">High Match</div>
      </div>
      <div class="stat-card">
        <div class="stat-badge medium">${s.medium_count}</div>
        <div class="stat-label">Medium Match</div>
      </div>
      <div class="stat-card">
        <div class="stat-badge low">${s.low_count}</div>
        <div class="stat-label">Low Match</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.applied_count}</div>
        <div class="stat-label">Applied</div>
      </div>
    `;

    const statsContainer = document.getElementById('statsContainer');
    if (statsContainer) statsContainer.innerHTML = statsHTML;
  }

  /**
   * Load jobs based on current filters and pagination
   */
  async loadJobs() {
    this.state.isLoading = true;
    this.showLoading();

    try {
      const result = await this.storage.queryJobs({
        filters: this.state.filters,
        search: this.state.searchQuery,
        sortBy: this.state.sortBy,
        sortOrder: this.state.sortOrder,
        page: this.state.page,
        pageSize: this.state.pageSize,
      });

      this.state.jobs = Array.isArray(result?.jobs) ? result.jobs : [];
      this.state.totalRecords = result?.total ?? this.state.jobs.length;

      await this.renderStats();
      this.renderFilterPanel();
      this.renderTable();
      this.renderPagination();
      this.updateSelectionUI();
    } catch (error) {
      console.error('Error loading jobs:', error);
      this.showError('Failed to load jobs: ' + error.message);
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Render filter panel
   */
  renderFilterPanel() {
    const statusBreakdown = this.state.stats?.status_breakdown ?? {};

    const filterHTML = `
      <div class="filter-panel">
        <div class="filter-group">
          <label>Status</label>
          <div class="filter-checkboxes">
            ${['new', 'saved', 'applied', 'rejected'].map(status => `
              <label>
                <input type="checkbox" class="status-filter" value="${status}" 
                  ${this.state.filters.status?.includes(status) ? 'checked' : ''} />
                ${status.charAt(0).toUpperCase() + status.slice(1)} (${statusBreakdown[status] ?? 0})
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-group">
          <label>Minimum Match %</label>
          <div class="filter-slider-container">
            <input type="range" class="filter-slider" min="0" max="100" 
              value="${this.state.filters.minMatchPercentage}" id="minMatchSlider" />
            <span class="filter-value" id="minMatchValue">${this.state.filters.minMatchPercentage}%</span>
          </div>
        </div>

        <div class="filter-group">
          <label>Ranking Level</label>
          <div class="filter-checkboxes">
            ${['high', 'medium', 'low'].map(level => `
              <label>
                <input type="checkbox" class="ranking-filter" value="${level}" 
                  ${this.state.filters.rankingLevel?.includes(level) ? 'checked' : ''} />
                ${level.charAt(0).toUpperCase() + level.slice(1)}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-actions">
          <button class="btn btn-secondary" id="clearFiltersBtn">Clear Filters</button>
        </div>
      </div>
    `;

    const container = document.getElementById('filterContainer');
    if (container) container.innerHTML = filterHTML;
  }

  /**
   * Render job table
   */
  renderTable() {
    const jobs = Array.isArray(this.state.jobs) ? this.state.jobs : [];
    const container = document.getElementById('tableContainer');
    if (!container) return;

    if (jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 No jobs found. Try adjusting your filters or search.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="jobs-table">
        <thead>
          <tr>
            <th width="40"><input type="checkbox" id="selectAllBtn" /></th>
            <th class="sortHeader" data-sort="job_title">Job Title ${this.getSortIcon('job_title')}</th>
            <th class="sortHeader" data-sort="company_name">Company ${this.getSortIcon('company_name')}</th>
            <th class="sortHeader" data-sort="match_percentage">Match % ${this.getSortIcon('match_percentage')}</th>
            <th class="sortHeader" data-sort="status">Status ${this.getSortIcon('status')}</th>
            <th class="sortHeader" data-sort="created_at">Date ${this.getSortIcon('created_at')}</th>
            <th width="100">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map(job => this.renderTableRow(job)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Render single table row with safe fallbacks
   */
  renderTableRow(job) {
    const ranking = (job.ranking_level || 'unknown').toLowerCase();
    const pct = Math.min(100, Math.max(0, Number(job.match_percentage) || 0));

    return `
      <tr class="job-row" data-job-id="${job.id}">
        <td>
          <input type="checkbox" class="job-checkbox" data-job-id="${job.id}" 
            ${this.state.selectedJobIds.has(job.id) ? 'checked' : ''} />
        </td>
        <td>
          <div class="job-title-row">
            <span class="job-title" title="${this.escapeHtml(job.job_title || '')}">${this.escapeHtml(job.job_title || 'Untitled Job')}</span>
            <span class="badge badge-${ranking}">${ranking.toUpperCase()}</span>
          </div>
        </td>
        <td>${this.escapeHtml(job.company_name || 'Unknown Company')}</td>
        <td>
          <div class="match-score-cell">
            <div class="match-percentage">${pct}%</div>
            <div class="match-meter"><div class="match-meter-fill" style="width: ${pct}%"></div></div>
          </div>
        </td>
        <td><span class="status status-${(job.status || 'new').toLowerCase()}">${job.status || 'New'}</span></td>
        <td><div class="job-date">${job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}</div></td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon view-btn" title="View details" data-job-id="${job.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button class="btn-icon edit-btn" title="Edit notes" data-job-id="${job.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="btn-icon delete-btn" title="Delete" data-job-id="${job.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render pagination controls with fixed ellipsis check
   */
  renderPagination() {
    const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize);
    if (totalPages <= 1) {
      const container = document.getElementById('paginationContainer');
      if (container) container.innerHTML = '';
      return;
    }

    const pageButtons = [];
    const ELLIPSIS = '<span class="ellipsis">...</span>';

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.state.page - 1 && i <= this.state.page + 1)) {
        pageButtons.push(`<button class="page-btn ${i === this.state.page ? 'active' : ''}" data-page="${i}">${i}</button>`);
      } else if (pageButtons[pageButtons.length - 1] !== ELLIPSIS) {
        pageButtons.push(ELLIPSIS);
      }
    }

    const paginationHTML = `
      <div class="pagination-info">
        Showing ${(this.state.page - 1) * this.state.pageSize + 1}-${Math.min(this.state.page * this.state.pageSize, this.state.totalRecords)} of ${this.state.totalRecords}
      </div>
      <div class="pagination-controls">
        <button class="page-nav" id="prevBtn" ${this.state.page === 1 ? 'disabled' : ''}>← Previous</button>
        <div class="page-numbers">${pageButtons.join('')}</div>
        <button class="page-nav" id="nextBtn" ${this.state.page === totalPages ? 'disabled' : ''}>Next →</button>
      </div>
    `;

    const container = document.getElementById('paginationContainer');
    if (container) container.innerHTML = paginationHTML;
  }

  /**
   * Attach event listeners using event delegation
   */
  attachEventListeners() {
    // Event delegation on container
    this.container.addEventListener('click', (e) => {
      const target = e.target;

      // Header sorting
      const sortHeader = target.closest('th[data-sort]');
      if (sortHeader) {
        const sortBy = sortHeader.dataset.sort;
        this.handleSort(sortBy);
        return;
      }

      // Page buttons
      const pageBtn = target.closest('.page-btn');
      if (pageBtn) {
        this.state.page = parseInt(pageBtn.dataset.page);
        this.loadJobs();
        return;
      }

      // Nav buttons (Prev/Next)
      if (target.id === 'prevBtn') {
        if (this.state.page > 1) {
          this.state.page--;
          this.loadJobs();
        }
        return;
      }
      if (target.id === 'nextBtn') {
        const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize);
        if (this.state.page < totalPages) {
          this.state.page++;
          this.loadJobs();
        }
        return;
      }

      // Actions
      // Row actions
      const viewBtn = target.closest('.view-btn');
      if (viewBtn) {
        this.showJobDetails(viewBtn.dataset.jobId);
        return;
      }
      const editBtn = target.closest('.edit-btn');
      if (editBtn) {
        this.showEditNotesModal(editBtn.dataset.jobId);
        return;
      }
      const deleteBtn = target.closest('.delete-btn');
      if (deleteBtn) {
        this.deleteJob(deleteBtn.dataset.jobId);
        return;
      }

      // Bulk actions
      if (target.id === 'clearFiltersBtn') {
        this.clearFilters();
        return;
      }
      if (target.id === 'deleteSelectedBtn') {
        this.deleteSelectedJobs();
        return;
      }
      if (target.id === 'exportBtn') {
        this.exportToCSV();
        return;
      }
    });

    // Change delegation on container
    this.container.addEventListener('change', (e) => {
      const target = e.target;

      if (target.classList.contains('status-filter')) {
        this.state.filters.status = Array.from(this.container.querySelectorAll('.status-filter:checked')).map(cb => cb.value);
        this.state.page = 1;
        this.loadJobs();
        return;
      }

      if (target.classList.contains('ranking-filter')) {
        this.state.filters.rankingLevel = Array.from(this.container.querySelectorAll('.ranking-filter:checked')).map(cb => cb.value);
        this.state.page = 1;
        this.loadJobs();
        return;
      }

      if (target.classList.contains('job-checkbox')) {
        const jobId = target.dataset.jobId;
        if (target.checked) this.state.selectedJobIds.add(jobId);
        else this.state.selectedJobIds.delete(jobId);
        this.updateSelectionUI();
        return;
      }

      if (target.id === 'selectAllBtn') {
        const checkboxes = this.container.querySelectorAll('.job-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = target.checked;
          if (target.checked) this.state.selectedJobIds.add(cb.dataset.jobId);
          else this.state.selectedJobIds.delete(cb.dataset.jobId);
        });
        this.updateSelectionUI();
        return;
      }
    });

    // Input delegation for slider/search
    this.container.addEventListener('input', (e) => {
      const target = e.target;

      if (target.id === 'minMatchSlider') {
        this.state.filters.minMatchPercentage = parseInt(target.value, 10);
        const valueDisplay = document.getElementById('minMatchValue');
        if (valueDisplay) valueDisplay.textContent = target.value + '%';

        clearTimeout(this.filterDebounce);
        this.filterDebounce = setTimeout(() => {
          this.state.page = 1;
          this.loadJobs();
        }, 300);
        return;
      }

      if (target.id === 'searchInput') {
        this.state.searchQuery = target.value;
        this.state.page = 1;

        clearTimeout(this.searchDebounce);
        this.searchDebounce = setTimeout(() => {
          this.loadJobs();
        }, 300);
      }
    });
  }

  /**
   * Handle table sorting
   */
  handleSort(field) {
    if (this.state.sortBy === field) {
      this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortBy = field;
      this.state.sortOrder = 'desc';
    }
    this.state.page = 1;
    this.loadJobs();
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.state.filters = {
      status: [],
      minMatchPercentage: 0,
      rankingLevel: [],
    };
    this.state.searchQuery = '';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    this.state.page = 1;
    this.loadJobs();
  }

  /**
   * Update selection UI
   */
  updateSelectionUI() {
    const totalSelected = this.state.selectedJobIds.size;
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    if (deleteBtn) {
      deleteBtn.disabled = totalSelected === 0;
      const label = deleteBtn.querySelector('.delete-label');
      if (label) {
        label.textContent = totalSelected > 0 ? `Delete Selected (${totalSelected})` : 'Delete Selected';
      }
    }

    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      const pageCheckboxes = this.container.querySelectorAll('.job-checkbox');
      const allPageChecked = pageCheckboxes.length > 0 && Array.from(pageCheckboxes).every(cb => cb.checked);
      selectAllBtn.checked = allPageChecked;
    }
  }

  /**
   * Show job details modal with safe fallbacks and improved salary logic
   */
  async showJobDetails(jobId) {
    try {
      const job = await this.storage.getJob(jobId);
      if (!job) return;

      const ranking = (job.ranking_level || 'unknown').toLowerCase();
      const pct = Math.min(100, Math.max(0, Number(job.match_percentage) || 0));

      let salaryHTML = '';
      if (job.salary_min || job.salary_max) {
        let range;
        if (job.salary_min && job.salary_max) {
          range = `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`;
        } else if (job.salary_min) {
          range = `$${job.salary_min.toLocaleString()}+`;
        } else {
          range = `Up to $${job.salary_max.toLocaleString()}`;
        }
        salaryHTML = `<div class="modal-section"><h4>Compensation</h4><p>${range} ${job.salary_currency || ''}</p></div>`;
      }

      const skillsHTML = `
        <div class="modal-section">
          <div class="modal-subsection">
            <h4>✓ Matched Skills (${job.matched_skills?.length || 0})</h4>
            <div class="skills-list">
              ${job.matched_skills?.map(s => `<span class="skill-matched">${this.escapeHtml(s)}</span>`).join('') || '<em>None</em>'}
            </div>
          </div>
          <div class="modal-subsection">
            <h4>✗ Missing Skills (${job.missing_skills?.length || 0})</h4>
            <div class="skills-list">
              ${job.missing_skills?.map(s => `<span class="skill-missing">${this.escapeHtml(s)}</span>`).join('') || '<em>None</em>'}
            </div>
          </div>
        </div>
      `;

      this.showModal(`
        <div class="modal-header">
          <h3>${this.escapeHtml(job.job_title || 'Untitled Job')} at ${this.escapeHtml(job.company_name || 'Unknown')}</h3>
          <span class="badge badge-${ranking}">${pct}% Match</span>
        </div>
        <div class="modal-body">
          <div class="modal-section">
            <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
            <p><strong>Status:</strong> <span class="status status-${(job.status || 'new').toLowerCase()}">${job.status || 'New'}</span></p>
            <p><strong>Posted:</strong> ${job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}</p>
          </div>
          ${skillsHTML}
          ${job.notes ? `<div class="modal-section"><h4>Notes</h4><p>${this.escapeHtml(job.notes)}</p></div>` : ''}
          ${salaryHTML}
        </div>
      `);
    } catch (error) {
      this.showError('Failed to load job details: ' + error.message);
    }
  }

  /**
   * Show edit notes modal
   */
  async showEditNotesModal(jobId) {
    const job = this.state.jobs.find(j => String(j.id) === String(jobId));
    if (!job) return;

    this.showModal(`
      <div class="modal-header"><h3>Edit ${this.escapeHtml(job.job_title || 'Job')}</h3></div>
      <div class="modal-body">
        <div class="modal-section">
          <label>Status</label>
          <select id="statusSelect" class="form-control">
            ${['new', 'saved', 'applied', 'rejected'].map(s =>
      `<option value="${s}" ${job.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
    ).join('')}
          </select>
        </div>
        <div class="modal-section">
          <label>Notes</label>
          <textarea id="notesTextarea" class="form-control" rows="4">${this.escapeHtml(job.notes || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBtn">Save Changes</button>
      </div>
    `);

    document.getElementById('saveBtn').addEventListener('click', async () => {
      const status = document.getElementById('statusSelect').value;
      const notes = document.getElementById('notesTextarea').value;
      try {
        const btn = document.getElementById('saveBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        await this.storage.updateJob(jobId, { status, notes });
        this.closeModal();
        await this.loadJobs();
      } catch (error) {
        this.showError('Failed to update job: ' + error.message);
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('saveBtn').textContent = 'Save Changes';
      }
    });

    document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
  }

  /**
   * Delete single job
   */
  async deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job record?')) return;
    try {
      await this.storage.deleteJob(jobId);
      await this.loadJobs();
    } catch (error) {
      this.showError('Failed to delete job: ' + error.message);
    }
  }

  /**
   * Delete selected jobs
   */
  async deleteSelectedJobs() {
    const idsToDelete = Array.from(this.state.selectedJobIds);
    const count = idsToDelete.length;
    if (count === 0) return;
    if (!confirm(`Delete ${count} selected jobs?`)) return;

    try {
      const promises = idsToDelete.map(id => this.storage.deleteJob(id));
      const results = await Promise.allSettled(promises);

      const failures = [];
      results.forEach((result, index) => {
        const id = idsToDelete[index];
        if (result.status === 'fulfilled') {
          this.state.selectedJobIds.delete(id);
        } else {
          failures.push(`Job ${id}: ${result.reason?.message || 'Unknown error'}`);
        }
      });

      if (failures.length > 0) {
        this.showError(`Failed to delete some jobs:\n${failures.join('\n')}`);
      }

      await this.loadJobs();
    } catch (error) {
      this.showError('An unexpected error occurred during deletion: ' + error.message);
    }
  }

  /**
   * Export jobs to CSV
   */
  async exportToCSV() {
    try {
      const csv = await this.jobStorage.exportToCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.showError('Failed to export CSV: ' + error.message);
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────

  getSortIcon(field) {
    if (this.state.sortBy !== field) return '↕';
    return this.state.sortOrder === 'asc' ? '↑' : '↓';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading() {
    const container = document.getElementById('tableContainer');
    if (container) container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching jobs...</p></div>';
  }

  showError(message) {
    console.error('[DashboardUI] Error:', message);
    const container = document.getElementById('tableContainer');
    if (container) container.innerHTML = `<div class="error-state"><p>⚠ ${this.escapeHtml(message)}</p></div>`;
  }

  showModal(content) {
    const modalHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal-content">
          <button class="modal-close" id="closeModalBtn">&times;</button>
          ${content}
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') this.closeModal();
    });
  }

  closeModal() {
    const modal = document.getElementById('modalOverlay');
    if (modal) modal.remove();
  }
}
