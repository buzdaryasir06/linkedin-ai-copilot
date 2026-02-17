/**
 * scanner/badge-overlay.js
 *
 * Injects match score badges into LinkedIn job cards.
 * Supports: high (green), medium (yellow), low (red) rankings.
 */

class BadgeOverlay {
  /**
   * Inject match badges for jobs
   * @param {Object} scoreMap - Map of job_id to score/ranking
   * @param {Array} jobs - Job data array with dom_selector
   */
  static injectBadges(scoreMap, jobs) {
    const injected = [];
    const failed = [];

    for (const job of jobs) {
      if (!scoreMap[job.job_id]) {
        failed.push(job.job_id);
        continue;
      }

      const score = scoreMap[job.job_id];
      const element = this.findJobElement(job.dom_selector, job.job_id);

      if (!element) {
        failed.push(job.job_id);
        continue;
      }

      try {
        this.injectBadge(element, score);
        injected.push(job.job_id);
      } catch (error) {
        console.error('[BadgeOverlay] Failed to inject badge:', error);
        failed.push(job.job_id);
      }
    }

    console.log(`[BadgeOverlay] Injected ${injected.length} badges, ${failed.length} failed`);
    return { injected, failed };
  }

  /**
   * Inject badge into a single job card
   */
  static injectBadge(cardElement, scoreData) {
    // Remove existing badge if present
    const existing = cardElement.querySelector('.copilot-match-badge');
    if (existing) {
      existing.remove();
    }

    const { match_score, ranking_level, missing_skills } = scoreData;

    // Create badge element
    const badge = this.createBadgeElement(match_score, ranking_level, missing_skills);

    // Insert at top-right of card
    const insertPoint = cardElement.querySelector('h3') || cardElement.firstChild;
    if (insertPoint?.parentElement) {
      const container = insertPoint.parentElement;
      container.style.position = 'relative';
      container.insertBefore(badge, container.firstChild);
    } else {
      cardElement.insertBefore(badge, cardElement.firstChild);
    }
  }

  /**
   * Create badge HTML element
   */
  static createBadgeElement(matchScore, rankingLevel, missingSkills) {
    const badges = {
      high: '#10b981',
      medium: '#f59e0b',
      low: '#ef4444',
    };

    const color = badges[rankingLevel] || '#9ca3af';
    const emoji = {
      high: '✓',
      medium: '◆',
      low: '✗',
    }[rankingLevel] || '•';

    const tooltipText = missingSkills && missingSkills.length > 0
      ? `Missing: ${missingSkills.slice(0, 2).join(', ')}${missingSkills.length > 2 ? `... +${missingSkills.length - 2}` : ''}`
      : 'Strong match!';

    const badge = document.createElement('div');
    badge.className = 'copilot-match-badge';
    badge.setAttribute('title', tooltipText);
    badge.innerHTML = `
      <div class="copilot-badge-inner" style="
        position: absolute;
        top: 8px;
        right: 8px;
        background: ${color};
        color: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 100;
        cursor: pointer;
        transition: all 0.2s ease;
      ">
        <span style="font-size: 13px;">${emoji}</span>
        <span>${matchScore}%</span>
      </div>
    `;

    // Add hover effects
    const innerDiv = badge.querySelector('.copilot-badge-inner');
    if (innerDiv) {
      innerDiv.addEventListener('mouseenter', () => {
        innerDiv.style.transform = 'scale(1.1)';
        innerDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      });
      innerDiv.addEventListener('mouseleave', () => {
        innerDiv.style.transform = 'scale(1)';
        innerDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      });

      // Click to show details
      innerDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showJobDetails(matchScore, rankingLevel, missingSkills);
      });
    }

    return badge;
  }

  /**
   * Find job card element by selector or job ID
   */
  static findJobElement(selector, jobId) {
    // Try CSS selector first
    if (selector) {
      try {
        const el = document.querySelector(selector);
        if (el) return el;
      } catch (e) {
        // Invalid selector
      }
    }

    // Fallback: find by data attribute with safe selector
    if (jobId) {
      const safeSelectorId = CSS.escape ? CSS.escape(jobId) : jobId.replace(/[^\w-]/g, '');
      const el = document.querySelector(`[data-job-id="${safeSelectorId}"]`);
      if (el) return el;
    }

    return null;
  }

  /**
   * Show job details popup (optional)
   */
  static showJobDetails(score, level, missingSkills) {
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      max-width: 300px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    `;

    // Build content safely without innerHTML
    const scoreDiv = document.createElement('div');
    scoreDiv.style.marginBottom = '12px';
    const scoreStrong = document.createElement('strong');
    scoreStrong.textContent = `Match Score: ${score}%`;
    scoreDiv.appendChild(scoreStrong);
    popup.appendChild(scoreDiv);

    // Add skills or success message
    const skillsP = document.createElement('p');
    if (missingSkills && missingSkills.length > 0) {
      skillsP.innerHTML = '<strong>To improve:</strong> ';
      const skillText = document.createTextNode(missingSkills.join(', '));
      skillsP.appendChild(skillText);
    } else {
      skillsP.textContent = 'Great match! No major skill gaps.';
    }
    popup.appendChild(skillsP);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      margin-top: 12px;
      padding: 6px 12px;
      background: #0a66c2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    closeBtn.addEventListener('click', () => popup.remove());
    popup.appendChild(closeBtn);

    document.body.appendChild(popup);

    // Auto-close after 5 seconds
    setTimeout(() => popup.remove(), 5000);
  }

  /**
   * Remove all badges (cleanup)
   */
  static removeAllBadges() {
    document.querySelectorAll('.copilot-match-badge').forEach(badge => {
      badge.remove();
    });
  }

  /**
   * Create floating notification badge
   */
  static showNotification(message, type = 'info') {
    const colors = {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 10001;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    `;

    notification.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  /**
   * Highlight matching jobs (by ranking)
   */
  static highlightByRanking(scoreMap) {
    for (const [jobId, score] of Object.entries(scoreMap)) {
      const element = document.querySelector(`[data-job-id="${jobId}"]`);
      if (!element) continue;

      const rankings = {
        high: 'rgba(16, 185, 129, 0.1)',
        medium: 'rgba(245, 158, 11, 0.1)',
        low: 'rgba(239, 68, 68, 0.05)',
      };

      const bgColor = rankings[score.ranking_level] || 'transparent';
      element.style.backgroundColor = bgColor;
      element.style.transition = 'background-color 0.3s ease';
    }
  }

  /**
   * Remove highlights
   */
  static clearHighlights() {
    document.querySelectorAll('[data-job-id][style*="background-color"]').forEach(el => {
      el.style.backgroundColor = '';
    });
  }
}

// Make overlay available globally
window.BadgeOverlay = BadgeOverlay;
