/**
 * popup.js - Extension popup (updated for Dashboard v2.0)
 *
 * Add these sections to your existing popup.js file
 * to support the new Dashboard tab.
 */

// ─── Global State ───────────────────────────────────────────────────────

let dashboardUI = null;

// ─── Mode Tab Switching ──────────────────────────────────────────────────

function setupModeToggle() {
  const commentBtn = document.getElementById('commentModeBtn');
  const jobBtn = document.getElementById('jobModeBtn');
  const dashboardBtn = document.getElementById('dashboardModeBtn');

  // Existing mode buttons
  commentBtn?.addEventListener('click', () => switchMode('comment'));
  jobBtn?.addEventListener('click', () => switchMode('job'));

  // New dashboard button
  dashboardBtn?.addEventListener('click', () => switchMode('dashboard'));
}

function switchMode(mode) {
  // Hide all panels
  document.getElementById('commentPanel').classList.add('hidden');
  document.getElementById('jobPanel').classList.add('hidden');
  document.getElementById('dashboardPanel')?.classList.add('hidden');
  document.getElementById('settingsPanel').classList.add('hidden');

  // Remove active class from all buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected panel and button
  if (mode === 'comment') {
    document.getElementById('commentPanel').classList.remove('hidden');
    document.getElementById('commentModeBtn').classList.add('active');
  } else if (mode === 'job') {
    document.getElementById('jobPanel').classList.remove('hidden');
    document.getElementById('jobModeBtn').classList.add('active');
  } else if (mode === 'dashboard') {
    document.getElementById('dashboardPanel')?.classList.remove('hidden');
    document.getElementById('dashboardModeBtn')?.classList.add('active');
    initializeDashboard();  // Lazy load dashboard
  }
}

// ─── Dashboard Initialization ────────────────────────────────────────────

async function initializeDashboard() {
  if (dashboardUI) {
    return;  // Already initialized
  }

  try {
    const container = document.getElementById('dashboardContainer');
    if (!container) {
      console.error('[Popup] Dashboard container not found');
      return;
    }

    // Initialize storage adapter
    await storageAdapter.initialize();

    // Create dashboard UI
    dashboardUI = new DashboardUI({
      container: container,
      storage: storageAdapter,
      jobStorage: createJobStorage(storageAdapter),
    });

    // Initialize and render
    await dashboardUI.initialize();

  } catch (error) {
    console.error('[Popup] Failed to initialize dashboard:', error);
    showError('Failed to load dashboard: ' + error.message);
  }
}

// ─── Integration with Existing Code ─────────────────────────────────────

/**
 * Hook into existing analyze job flow to auto-save to dashboard
 */
async function analyzeJobAndTrack(jobText, userSkills, userExperience) {
  try {
    // Analyze job (existing function)
    const analysis = await analyzeJob(jobText, userSkills, userExperience);

    if (!analysis) {
      showError('Failed to analyze job');
      return;
    }

    // Auto-save to dashboard
    await saveJobToDashboard({
      job_title: extractJobTitle(jobText),
      company_name: extractCompanyName(jobText),
      location: extractLocation(jobText) || '',
      description: jobText,
      job_url: '',
      job_id: generateJobId(jobText),
      match_percentage: analysis.match_percentage,
      matched_skills: analysis.matched_skills || [],
      missing_skills: analysis.missing_skills || [],
      ranking_level: getRankingLevel(analysis.match_percentage),
      status: 'new',
      source: 'manual',
    });

    showSuccess('Job saved to Dashboard! 📊');
  } catch (error) {
    console.error('[Popup] Error analyzing and tracking:', error);
    showError(error.message);
  }
}

/**
 * Save job to dashboard
 */
async function saveJobToDashboard(jobData) {
  const validated = {
    ...jobData,
    id: jobData.id || generateUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await storageAdapter.saveJob(validated);

  // Refresh dashboard if open
  if (dashboardUI) {
    await dashboardUI.loadJobs();
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────

function getRankingLevel(percentage) {
  if (percentage >= 70) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}

function generateJobId(jobText) {
  // Simple hash for job ID
  const hash = btoa(jobText.substring(0, 100))
    .replace(/[+/=/]/g, '')
    .substring(0, 16);
  return `job_${Date.now()}_${hash}`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extractJobTitle(jobText) {
  // Look for common patterns
  const match = jobText.match(/(?:title|position|job):\s*(\w+.*?)(?:\n|company|$)/i);
  return match ? match[1].trim() : 'Position Title';
}

function extractCompanyName(jobText) {
  const match = jobText.match(/(?:company|employer):\s*(\w+.*?)(?:\n|location|$)/i);
  return match ? match[1].trim() : 'Unknown Company';
}

function extractLocation(jobText) {
  const match = jobText.match(/(?:location|city|based):\s*(\w+.*?)(?:\n|$)/i);
  return match ? match[1].trim() : '';
}

// ─── UI Feedback ────────────────────────────────────────────────────────

function showSuccess(message) {
  showStatus(message, 'success');
}

function showError(message) {
  showStatus(message, 'error');
}

function showStatus(message, type = 'info') {
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');

  if (!statusBar || !statusText) return;

  statusText.textContent = message;
  statusBar.className = `status-bar status-${type}`;
  statusBar.classList.remove('hidden');

  setTimeout(() => {
    statusBar.classList.add('hidden');
  }, 3000);
}

// ─── Initialization ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Set up mode toggle (including new dashboard button)
  setupModeToggle();

  // Your existing initialization code here...
  // (comment generation, job analysis, settings, etc.)
});
