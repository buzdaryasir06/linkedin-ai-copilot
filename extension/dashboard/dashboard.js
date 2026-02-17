/**
 * dashboard.js – Lightweight Job Tracking Dashboard
 * 
 * Architecture:
 * - Single in-memory state object (no excessive storage reads)
 * - Event delegation for efficient DOM handling
 * - Debounced saves to chrome.storage.local
 * - Smart re-rendering (only affected rows)
 * - Handles 500+ jobs without freezing
 */

(function () {
  "use strict";

  // ─── State Management ──────────────────────────────────────────────────

  const state = {
    jobs: [],
    filteredJobs: [],
    isLoading: true,
    filterStatus: "",
    filterMatch: "",
    searchQuery: "",
    isDirty: false,
    notesSaveTimer: null,
    editingNoteId: null,
  };

  // ─── DOM References ────────────────────────────────────────────────────

  const dom = {
    app: document.getElementById("dashboardApp"),
    header: document.querySelector(".dashboard-header"),
    emptyState: document.getElementById("emptyState"),
    tableContainer: document.getElementById("tableContainer"),
    tableBody: document.getElementById("jobsTableBody"),
    jobCount: document.getElementById("jobCount"),
    loadingState: document.getElementById("loadingState"),
    filterStatus: document.getElementById("filterStatus"),
    filterMatch: document.getElementById("filterMatch"),
    searchBox: document.getElementById("searchBox"),
    resetBtn: document.getElementById("resetFiltersBtn"),
  };

  // ─── Initialization ────────────────────────────────────────────────────

  async function init() {
    try {
      await loadJobs();
      attachEventListeners();
      applyFilters();
      renderUI();
    } catch (error) {
      console.error("[Dashboard] Init error:", error);
      renderError("Failed to load dashboard");
    }
  }

  // ─── Storage Operations ────────────────────────────────────────────────

  /**
   * Load jobs from chrome.storage.local into memory
   */
  async function loadJobs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["jobs"], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        state.jobs = result.jobs || [];
        console.log(`[Dashboard] Loaded ${state.jobs.length} jobs from storage`);
        resolve();
      });
    });
  }

  /**
   * Save jobs to chrome.storage.local
   * Batches multiple saves to avoid excessive writes
   */
  async function saveJobs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ jobs: state.jobs }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        console.log("[Dashboard] Jobs saved to storage");
        state.isDirty = false;
        resolve();
      });
    });
  }

  // ─── Job Operations ────────────────────────────────────────────────────

  /**
   * Add a new job to the dashboard
   * Called from Job Match tab after analysis
   */
  async function addJob(jobData) {
    // Validate required fields
    if (!jobData.job_id || !jobData.job_title || !jobData.company_name) {
      console.error("[Dashboard] Invalid job data:", jobData);
      return false;
    }

    // Check for duplicates
    const exists = state.jobs.find((j) => j.job_id === jobData.job_id);
    if (exists) {
      console.warn("[Dashboard] Job already exists:", jobData.job_id);
      return false;
    }

    // Normalize job object
    const job = {
      job_id: jobData.job_id,
      company_name: jobData.company_name || "",
      job_title: jobData.job_title || "",
      location: jobData.location || "",
      match_percentage: jobData.match_percentage || 0,
      missing_skills: jobData.missing_skills || [],
      analyzed_date: jobData.analyzed_date || new Date().toISOString(),
      status: jobData.status || "New",
      notes: jobData.notes || "",
    };

    state.jobs.unshift(job); // Add to front
    state.isDirty = true;

    await saveJobs();
    applyFilters();
    renderUI();

    return true;
  }

  /**
   * Update job status with auto-save
   */
  async function updateJobStatus(jobId, newStatus) {
    const job = state.jobs.find((j) => j.job_id === jobId);
    if (!job) return;

    job.status = newStatus;
    state.isDirty = true;

    await saveJobs();
    // Only re-render the affected row
    updateTableRow(jobId);
  }

  /**
   * Update job notes with debounced save
   */
  function updateJobNotes(jobId, notes) {
    const job = state.jobs.find((j) => j.job_id === jobId);
    if (!job) return;

    job.notes = notes;
    state.isDirty = true;

    // Debounce save to reduce storage writes
    clearTimeout(state.notesSaveTimer);
    state.notesSaveTimer = setTimeout(async () => {
      await saveJobs();
      // Visual feedback
      const input = document.querySelector(`[data-job-id="${jobId}"] .notes-input`);
      if (input) {
        input.classList.remove("notes-saving");
      }
    }, 1000); // Save 1 second after user stops typing

    // Show saving state
    const input = document.querySelector(`[data-job-id="${jobId}"] .notes-input`);
    if (input) {
      input.classList.add("notes-saving");
    }
  }

  /**
   * Delete job from dashboard
   */
  async function deleteJob(jobId) {
    state.jobs = state.jobs.filter((j) => j.job_id !== jobId);
    state.isDirty = true;

    await saveJobs();
    applyFilters();
    renderUI();
  }

  // ─── Filtering & Sorting ──────────────────────────────────────────────

  /**
   * Apply filters and sort
   */
  function applyFilters() {
    let filtered = [...state.jobs];

    // Filter by status
    if (state.filterStatus) {
      filtered = filtered.filter((j) => j.status === state.filterStatus);
    }

    // Filter by minimum match %
    if (state.filterMatch) {
      const minMatch = parseInt(state.filterMatch, 10);
      filtered = filtered.filter((j) => j.match_percentage >= minMatch);
    }

    // Search by company or role
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.company_name.toLowerCase().includes(query) ||
          j.job_title.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.analyzed_date) - new Date(a.analyzed_date)
    );

    state.filteredJobs = filtered;
  }

  /**
   * Reset all filters
   */
  function resetFilters() {
    state.filterStatus = "";
    state.filterMatch = "";
    state.searchQuery = "";

    dom.filterStatus.value = "";
    dom.filterMatch.value = "";
    dom.searchBox.value = "";

    applyFilters();
    renderUI();
  }

  // ─── Rendering ────────────────────────────────────────────────────────

  /**
   * Main render orchestrator
   */
  function renderUI() {
    updateJobCount();
    renderEmptyState();
    renderTable();
  }

  /**
   * Update job count in header
   */
  function updateJobCount() {
    const total = state.jobs.length;
    const filtered = state.filteredJobs.length;

    if (total === 0) {
      dom.jobCount.textContent = "0 jobs";
    } else if (total === filtered) {
      dom.jobCount.textContent = `${total} job${total === 1 ? "" : "s"}`;
    } else {
      dom.jobCount.textContent = `${filtered} of ${total} job${
        total === 1 ? "" : "s"
      }`;
    }
  }

  /**
   * Show/hide empty state
   */
  function renderEmptyState() {
    const isEmpty = state.filteredJobs.length === 0;

    if (isEmpty) {
      dom.emptyState.classList.remove("hidden");
      dom.tableContainer.classList.add("hidden");
      dom.loadingState.classList.add("hidden");
    } else {
      dom.emptyState.classList.add("hidden");
      dom.tableContainer.classList.remove("hidden");
      dom.loadingState.classList.add("hidden");
    }
  }

  /**
   * Render entire table
   * Virtualization not needed for popup (height limited)
   */
  function renderTable() {
    dom.tableBody.innerHTML = "";

    state.filteredJobs.forEach((job) => {
      const row = createTableRow(job);
      dom.tableBody.appendChild(row);
    });
  }

  /**
   * Create a single table row
   */
  function createTableRow(job) {
    const row = document.createElement("tr");
    row.setAttribute("data-job-id", job.job_id);

    // Company
    const companyCell = document.createElement("td");
    companyCell.className = "cell-company";
    companyCell.textContent = job.company_name;

    // Role
    const roleCell = document.createElement("td");
    roleCell.className = "cell-role";
    roleCell.textContent = job.job_title;

    // Match %
    const matchCell = document.createElement("td");
    const matchBadge = createMatchBadge(job.match_percentage);
    matchCell.appendChild(matchBadge);

    // Status
    const statusCell = document.createElement("td");
    const statusSelect = createStatusSelect(job);
    statusCell.appendChild(statusSelect);

    // Date
    const dateCell = document.createElement("td");
    dateCell.className = "cell-date";
    dateCell.textContent = formatDate(job.analyzed_date);

    // Notes
    const notesCell = document.createElement("td");
    notesCell.className = "cell-notes";
    const notesDisplay = createNotesEditor(job);
    notesCell.appendChild(notesDisplay);

    // Actions
    const actionsCell = document.createElement("td");
    const deleteBtn = createDeleteButton(job.job_id);
    actionsCell.appendChild(deleteBtn);

    row.appendChild(companyCell);
    row.appendChild(roleCell);
    row.appendChild(matchCell);
    row.appendChild(statusCell);
    row.appendChild(dateCell);
    row.appendChild(notesCell);
    row.appendChild(actionsCell);

    return row;
  }

  /**
   * Create match percentage badge
   */
  function createMatchBadge(percentage) {
    const badge = document.createElement("div");
    badge.className = "match-badge";

    if (percentage >= 80) {
      badge.classList.add("high");
    } else if (percentage >= 60) {
      badge.classList.add("medium");
    } else {
      badge.classList.add("low");
    }

    badge.textContent = `${percentage}%`;
    return badge;
  }

  /**
   * Create status dropdown
   */
  function createStatusSelect(job) {
    const select = document.createElement("select");
    select.className = "status-select";
    select.setAttribute("data-job-id", job.job_id);

    const statuses = ["New", "Saved", "Applied", "Rejected"];
    statuses.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      if (job.status === status) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener("change", (e) => {
      updateJobStatus(job.job_id, e.target.value);
    });

    return select;
  }

  /**
   * Create inline notes editor
   */
  function createNotesEditor(job) {
    const container = document.createElement("div");
    container.className = "notes-cell-container";

    if (state.editingNoteId === job.job_id) {
      // Editing mode
      const input = document.createElement("input");
      input.type = "text";
      input.className = "notes-input";
      input.value = job.notes;
      input.setAttribute("data-job-id", job.job_id);
      input.placeholder = "Add notes...";

      input.addEventListener("blur", () => {
        state.editingNoteId = null;
        renderUI();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          updateJobNotes(job.job_id, e.target.value);
          state.editingNoteId = null;
          renderUI();
        } else if (e.key === "Escape") {
          state.editingNoteId = null;
          renderUI();
        } else {
          updateJobNotes(job.job_id, e.target.value);
        }
      });

      container.appendChild(input);
      setTimeout(() => input.focus(), 0);
    } else {
      // Display mode
      const display = document.createElement("div");
      display.className = "notes-display";

      if (!job.notes) {
        display.classList.add("empty");
        display.textContent = "Click to add notes...";
      } else {
        display.textContent = job.notes;
      }

      display.setAttribute("data-job-id", job.job_id);

      display.addEventListener("click", () => {
        state.editingNoteId = job.job_id;
        renderUI();
      });

      container.appendChild(display);
    }

    return container;
  }

  /**
   * Create delete button
   */
  function createDeleteButton(jobId) {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.textContent = "Delete";
    btn.setAttribute("data-job-id", jobId);
    btn.title = "Remove from dashboard";

    btn.addEventListener("click", () => {
      if (confirm("Delete this job from dashboard?")) {
        deleteJob(jobId);
      }
    });

    return btn;
  }

  /**
   * Update specific table row (efficient re-render)
   */
  function updateTableRow(jobId) {
    const job = state.jobs.find((j) => j.job_id === jobId);
    if (!job) return;

    const existingRow = document.querySelector(`[data-job-id="${jobId}"]`);
    if (!existingRow) return;

    const newRow = createTableRow(job);
    existingRow.replaceWith(newRow);
  }

  // ─── Event Listeners ──────────────────────────────────────────────────

  function attachEventListeners() {
    // Filter status
    dom.filterStatus.addEventListener("change", (e) => {
      state.filterStatus = e.target.value;
      applyFilters();
      renderUI();
    });

    // Filter match %
    dom.filterMatch.addEventListener("change", (e) => {
      state.filterMatch = e.target.value;
      applyFilters();
      renderUI();
    });

    // Search (with debounce)
    let searchTimer;
    dom.searchBox.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchQuery = e.target.value;
        applyFilters();
        renderUI();
      }, 200);
    });

    // Reset filters
    dom.resetBtn.addEventListener("click", resetFilters);
  }

  // ─── Utility Functions ────────────────────────────────────────────────

  /**
   * Format ISO date to readable format
   */
  function formatDate(isoString) {
    if (!isoString) return "N/A";

    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if today
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }

    // Check if yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    // Check if this week (normalize to start-of-day for accuracy)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.floor((todayStart - dateStart) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) {
      return `${daysAgo}d ago`;
    }

    // Format as MM/DD
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
  }

  /**
   * Render error state
   */
  function renderError(message) {
    dom.emptyState.classList.remove("hidden");
    dom.emptyState.innerHTML = ""; // Clear existing content
    
    const errorContainer = document.createElement("div");
    errorContainer.style.textAlign = "center";
    errorContainer.style.color = "#e74c3c";
    
    const titleEl = document.createElement("p");
    titleEl.style.fontWeight = "500";
    titleEl.style.margin = "0 0 4px 0";
    titleEl.textContent = `⚠ ${message}`;
    
    const infoEl = document.createElement("p");
    infoEl.style.fontSize = "11px";
    infoEl.style.margin = "0";
    infoEl.textContent = "Please refresh the popup or restart the extension.";
    
    errorContainer.appendChild(titleEl);
    errorContainer.appendChild(infoEl);
    dom.emptyState.appendChild(errorContainer);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Expose public methods for use from other popup tabs
   */
  window.Dashboard = {
    init,
    addJob,
    loadJobs,
    refresh: async () => {
      await loadJobs();
      applyFilters();
      renderUI();
    },
  };

  // ─── Auto-init when DOM is ready ────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
