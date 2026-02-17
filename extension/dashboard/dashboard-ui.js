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
    const html = `
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
              Delete Selected
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="dashboard-stats" id="statsContainer">
          <!-- Stats rendered here -->
        </div>

        <!-- Filters -->
        <div class="dashboard-filters" id="filterContainer">
          <!-- Filter panel rendered here -->
        </div>

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

        <!-- Table -->
        <div class="dashboard-table-wrapper" id="tableContainer">
          <!-- Table rendered here -->
        </div>

        <!-- Pagination -->
        <div class="dashboard-pagination" id="paginationContainer">
          <!-- Pagination rendered here -->
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Render statistics cards
   */
  async renderStats() {
    const stats = await this.storage.getDashboardStats();
    
    const statsHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.total_jobs}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">${stats.avg_match_percentage}%</div>
        <div class="stat-label">Avg Match</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-badge high">${stats.high_count}</div>
        <div class="stat-label">High Match</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-badge medium">${stats.medium_count}</div>
        <div class="stat-label">Medium Match</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-badge low">${stats.low_count}</div>
        <div class="stat-label">Low Match</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">${stats.applied_count}</div>
        <div class="stat-label">Applied</div>
      </div>
    `;

    document.getElementById('statsContainer').innerHTML = statsHTML;
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

      this.state.jobs = result.jobs;
      this.state.totalRecords = result.total;

      await this.renderStats();
      this.renderFilterPanel();
      this.renderTable();
      this.renderPagination();
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
    const filterHTML = `
      <div class="filter-panel">
        <div class="filter-group">
          <label>Status</label>
          <div class="filter-checkboxes">
            <label>
              <input type="checkbox" class="status-filter" value="new" 
                ${this.state.filters.status?.includes('new') ? 'checked' : ''} />
              New (${this.state.jobs.filter(j => j.status === 'new').length})
            </label>
            <label>
              <input type="checkbox" class="status-filter" value="saved" 
                ${this.state.filters.status?.includes('saved') ? 'checked' : ''} />
              Saved (${this.state.jobs.filter(j => j.status === 'saved').length})
            </label>
            <label>
              <input type="checkbox" class="status-filter" value="applied" 
                ${this.state.filters.status?.includes('applied') ? 'checked' : ''} />
              Applied (${this.state.jobs.filter(j => j.status === 'applied').length})
            </label>
            <label>
              <input type="checkbox" class="status-filter" value="rejected" 
                ${this.state.filters.status?.includes('rejected') ? 'checked' : ''} />
              Rejected (${this.state.jobs.filter(j => j.status === 'rejected').length})
            </label>
          </div>
        </div>

        <div class="filter-group">
          <label>Minimum Match %</label>
          <div class="filter-slider-container">
            <input 
              type="range" 
              class="filter-slider" 
              min="0" 
              max="100" 
              value="${this.state.filters.minMatchPercentage}"
              id="minMatchSlider"
            />
            <span class="filter-value" id="minMatchValue">${this.state.filters.minMatchPercentage}%</span>
          </div>
        </div>

        <div class="filter-group">
          <label>Ranking Level</label>
          <div class="filter-checkboxes">
            <label>
              <input type="checkbox" class="ranking-filter" value="high" 
                ${this.state.filters.rankingLevel?.includes('high') ? 'checked' : ''} />
              High
            </label>
            <label>
              <input type="checkbox" class="ranking-filter" value="medium" 
                ${this.state.filters.rankingLevel?.includes('medium') ? 'checked' : ''} />
              Medium
            </label>
            <label>
              <input type="checkbox" class="ranking-filter" value="low" 
                ${this.state.filters.rankingLevel?.includes('low') ? 'checked' : ''} />
              Low
            </label>
          </div>
        </div>

        <div class="filter-actions">
          <button class="btn btn-secondary" id="clearFiltersBtn">Clear Filters</button>
        </div>
      </div>
    `;

    document.getElementById('filterContainer').innerHTML = filterHTML;
  }

  /**
   * Render job table
   */
  renderTable() {
    if (this.state.jobs.length === 0) {
      document.getElementById('tableContainer').innerHTML = `
        <div class="empty-state">
          <p>📭 No jobs found. Try adjusting your filters or search.</p>
        </div>
      `;
      return;
    }

    const tableHTML = `
      <table class="jobs-table">
        <thead>
          <tr>
            <th width="40">
              <input type="checkbox" id="selectAllCheckbox" />
            </th>
            <th class="sortable" data-sort="job_title">Job Title ${this.getSortIcon('job_title')}</th>
            <th class="sortable" data-sort="company_name">Company ${this.getSortIcon('company_name')}</th>
            <th class="sortable" data-sort="location">Location ${this.getSortIcon('location')}</th>
            <th class="sortable" data-sort="match_percentage">Match % ${this.getSortIcon('match_percentage')}</th>
            <th>Level</th>
            <th class="sortable" data-sort="status">Status ${this.getSortIcon('status')}</th>
            <th class="sortable" data-sort="created_at">Date ${this.getSortIcon('created_at')}</th>
            <th width="80">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.state.jobs.map(job => this.renderTableRow(job)).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('tableContainer').innerHTML = tableHTML;
  }

  /**
   * Render single table row
   */
  renderTableRow(job) {
    const levelClass = `badge badge-${job.ranking_level}`;
    const statusClass = `status status-${job.status}`;
    const date = new Date(job.created_at).toLocaleDateString();

    return `
      <tr data-job-id="${job.id}">
        <td>
          <input type="checkbox" class="job-checkbox" value="${job.id}" />
        </td>
        <td>
          <div class="job-title-cell">
            <strong>${this.escapeHtml(job.job_title)}</strong>
            ${job.missing_skills?.length > 0 ? `
              <div class="missing-skills">
                ${job.missing_skills.slice(0, 2).map(s => `<span class="skill-tag">${this.escapeHtml(s)}</span>`).join('')}
                ${job.missing_skills.length > 2 ? `<span class="skill-tag">+${job.missing_skills.length - 2}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </td>
        <td>${this.escapeHtml(job.company_name)}</td>
        <td>${job.location ? this.escapeHtml(job.location) : '—'}</td>
        <td>
          <div class="match-bar">
            <div class="match-fill" style="width: ${job.match_percentage}%"></div>
            <span class="match-text">${job.match_percentage}%</span>
          </div>
        </td>
        <td>
          <span class="${levelClass}">${job.ranking_level?.toUpperCase()}</span>
        </td>
        <td>
          <span class="${statusClass}">${job.status}</span>
        </td>
        <td>${date}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon view-btn" title="View details" data-job-id="${job.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button class="btn-icon edit-btn" title="Edit notes" data-job-id="${job.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="btn-icon delete-btn" title="Delete" data-job-id="${job.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize);
    
    if (totalPages <= 1) {
      document.getElementById('paginationContainer').innerHTML = '';
      return;
    }

    const pageButtons = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= this.state.page - 2 && i <= this.state.page + 2)
      ) {
        pageButtons.push(`
          <button class="page-btn ${i === this.state.page ? 'active' : ''}" data-page="${i}">
            ${i}
          </button>
        `);
      } else if (pageButtons[pageButtons.length - 1] !== '...') {
        pageButtons.push('<span>...</span>');
      }
    }

    const paginationHTML = `
      <div class="pagination-info">
        Showing ${(this.state.page - 1) * this.state.pageSize + 1}-${Math.min(this.state.page * this.state.pageSize, this.state.totalRecords)} 
        of ${this.state.totalRecords} jobs
      </div>
      <div class="pagination-controls">
        <button class="page-nav" id="prevBtn" ${this.state.page === 1 ? 'disabled' : ''}>← Previous</button>
        <div class="page-numbers">
          ${pageButtons.join('')}
        </div>
        <button class="page-nav" id="nextBtn" ${this.state.page === totalPages ? 'disabled' : ''}>Next →</button>
      </div>
    `;

    document.getElementById('paginationContainer').innerHTML = paginationHTML;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounce);
        this.searchDebounce = setTimeout(() => {
          this.state.searchQuery = e.target.value;
          this.state.page = 1;
          this.loadJobs();
        }, 300);
      });
    }

    // Status filters
    document.querySelectorAll('.status-filter').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.state.filters.status = Array.from(
          document.querySelectorAll('.status-filter:checked')
        ).map(c => c.value);
        this.state.page = 1;
        this.loadJobs();
      });
    });

    // Ranking level filters
    document.querySelectorAll('.ranking-filter').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.state.filters.rankingLevel = Array.from(
          document.querySelectorAll('.ranking-filter:checked')
        ).map(c => c.value);
        this.state.page = 1;
        this.loadJobs();
      });
    });

    // Min match slider
    const minMatchSlider = document.getElementById('minMatchSlider');
    if (minMatchSlider) {
      minMatchSlider.addEventListener('change', (e) => {
        this.state.filters.minMatchPercentage = parseInt(e.target.value, 10);
        document.getElementById('minMatchValue').textContent = e.target.value + '%';
        this.state.page = 1;
        this.loadJobs();
      });
    }

    // Clear filters
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.state.filters = {
          status: [],
          minMatchPercentage: 0,
          rankingLevel: [],
        };
        this.state.searchQuery = '';
        document.getElementById('searchInput').value = '';
        this.state.page = 1;
        this.loadJobs();
      });
    }

    // Sorting
    document.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', () => {
        const field = header.dataset.sort;
        if (this.state.sortBy === field) {
          this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortBy = field;
          this.state.sortOrder = 'desc';
        }
        this.state.page = 1;
        this.loadJobs();
      });
    });

    // Pagination
    document.getElementById('prevBtn')?.addEventListener('click', () => {
      if (this.state.page > 1) {
        this.state.page--;
        this.loadJobs();
        window.scrollTo(0, 0);
      }
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => {
      const totalPages = Math.ceil(this.state.totalRecords / this.state.pageSize);
      if (this.state.page < totalPages) {
        this.state.page++;
        this.loadJobs();
        window.scrollTo(0, 0);
      }
    });

    document.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.page = parseInt(btn.dataset.page, 10);
        this.loadJobs();
        window.scrollTo(0, 0);
      });
    });

    // Row interactions
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const jobId = e.currentTarget.dataset.jobId;
        this.showJobDetails(jobId);
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const jobId = e.currentTarget.dataset.jobId;
        this.showEditNotesModal(jobId);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const jobId = e.currentTarget.dataset.jobId;
        this.deleteJob(jobId);
      });
    });

    // Checkbox selection
    document.getElementById('selectAllCheckbox')?.addEventListener('change', (e) => {
      document.querySelectorAll('.job-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
      });
      this.updateSelectionUI();
    });

    document.querySelectorAll('.job-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        this.updateSelectionUI();
      });
    });

    // Bulk operations
    document.getElementById('deleteSelectedBtn')?.addEventListener('click', () => {
      this.deleteSelectedJobs();
    });

    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportToCSV();
    });
  }

  /**
   * Update selection UI
   */
  updateSelectionUI() {
    const selected = Array.from(
      document.querySelectorAll('.job-checkbox:checked')
    ).map(cb => cb.value);

    this.state.selectedJobIds = new Set(selected);

    const deleteBtn = document.getElementById('deleteSelectedBtn');
    if (deleteBtn) {
      deleteBtn.disabled = selected.length === 0;
      if (selected.length > 0) {
        deleteBtn.textContent = `Delete Selected (${selected.length})`;
      }
    }
  }

  /**
   * Show job details modal
   */
  async showJobDetails(jobId) {
    const job = await this.storage.getJob(jobId);
    if (!job) return;

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
        <h3>${this.escapeHtml(job.job_title)} at ${this.escapeHtml(job.company_name)}</h3>
        <span class="badge badge-${job.ranking_level}">${job.match_percentage}% Match</span>
      </div>

      <div class="modal-body">
        <div class="modal-section">
          <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
          <p><strong>Status:</strong> <span class="status status-${job.status}">${job.status}</span></p>
          <p><strong>Posted:</strong> ${new Date(job.created_at).toLocaleDateString()}</p>
        </div>

        ${skillsHTML}

        ${job.notes ? `
          <div class="modal-section">
            <h4>Notes</h4>
            <p>${this.escapeHtml(job.notes)}</p>
          </div>
        ` : ''}

        ${job.salary_min ? `
          <div class="modal-section">
            <h4>Compensation</h4>
            <p>$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()} ${job.salary_currency}</p>
          </div>
        ` : ''}
      </div>
    `);
  }

  /**
   * Show edit notes modal
   */
  showEditNotesModal(jobId) {
    const job = this.state.jobs.find(j => j.id === jobId);
    if (!job) return;

    const statusOptions = ['new', 'saved', 'applied', 'rejected'].map(s => 
      `<option value="${s}" ${job.status === s ? 'selected' : ''}>${s}</option>`
    ).join('');

    this.showModal(`
      <div class="modal-header">
        <h3>Edit ${this.escapeHtml(job.job_title)}</h3>
      </div>

      <div class="modal-body">
        <div class="modal-section">
          <label>Status</label>
          <select id="statusSelect" class="form-control">
            ${statusOptions}
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

    // Attach handlers
    document.getElementById('saveBtn').addEventListener('click', async () => {
      const status = document.getElementById('statusSelect').value;
      const notes = document.getElementById('notesTextarea').value;

      try {
        await this.storage.updateJob(jobId, { status, notes });
        this.closeModal();
        await this.loadJobs();
      } catch (error) {
        this.showError('Failed to update job: ' + error.message);
      }
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.closeModal();
    });
  }

  /**
   * Delete single job
   */
  async deleteJob(jobId) {
    if (!confirm('Delete this job record?')) return;

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
    if (this.state.selectedJobIds.size === 0) return;
    if (!confirm(`Delete ${this.state.selectedJobIds.size} jobs?`)) return;

    try {
      const promises = Array.from(this.state.selectedJobIds).map(jobId =>
        this.storage.deleteJob(jobId)
      );
      await Promise.all(promises);
      await this.loadJobs();
    } catch (error) {
      this.showError('Failed to delete jobs: ' + error.message);
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
      a.download = `job-dashboard-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.showError('Failed to export: ' + error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────

  getSortIcon(field) {
    if (this.state.sortBy !== field) return '';
    return this.state.sortOrder === 'asc' ? ' ↑' : ' ↓';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading() {
    document.getElementById('tableContainer').innerHTML = '<div class="loading">Loading...</div>';
  }

  showError(message) {
    alert('❌ ' + message);
  }

  showModal(content) {
    const modalHTML = `
      <div class="modal-overlay" id="modal">
        <div class="modal">
          <button class="modal-close" id="closeModal">&times;</button>
          ${content}
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') {
        this.closeModal();
      }
    });
  }

  closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
      modal.remove();
    }
  }
}
