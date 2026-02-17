/**
 * scanner/job-card-parser.js
 *
 * Extracts structured job data from LinkedIn job card DOM elements.
 * Handles different LinkedIn HTML structures with fallbacks.
 */

class JobCardParser {
  /**
   * Parse a single job card element
   * @param {Element} cardElement - The job card DOM element
   * @returns {Object} Structured job data
   */
  static parseJobCard(cardElement) {
    if (!cardElement) return null;

    try {
      const jobData = {
        // Identifiers
        job_id: this.extractJobId(cardElement),
        job_url: this.extractJobUrl(cardElement),
        
        // Core info
        job_title: this.extractJobTitle(cardElement),
        company_name: this.extractCompanyName(cardElement),
        location: this.extractLocation(cardElement),
        description: this.extractDescription(cardElement),
        posting_date: this.extractPostingDate(cardElement),
        
        // Metadata
        dom_selector: this.cssSelector(cardElement),
        extracted_at: new Date().toISOString(),
      };

      // Validate minimum required fields
      if (!jobData.job_id || !jobData.job_title || !jobData.company_name) {
        console.warn('[JobCardParser] Incomplete job data, skipping', jobData);
        return null;
      }

      return jobData;
    } catch (error) {
      console.error('[JobCardParser] Error parsing job card:', error);
      return null;
    }
  }

  /**
   * Parse multiple job cards
   * @param {NodeList|Array} cardElements - Collection of job card elements
   * @returns {Array} Array of structured job data
   */
  static parseJobCards(cardElements) {
    const jobs = [];

    for (const element of cardElements) {
      const job = this.parseJobCard(element);
      if (job) {
        jobs.push(job);
      }
    }

    // Deduplicate by job_id
    const seen = new Set();
    return jobs.filter(job => {
      if (seen.has(job.job_id)) return false;
      seen.add(job.job_id);
      return true;
    });
  }

  /**
   * Extract job ID from card
   */
  static extractJobId(element) {
    // Try data attribute first
    let jobId = element.getAttribute('data-job-id');
    if (jobId) return jobId;

    // Try nested attribute
    const jobLink = element.querySelector('[data-job-id]');
    if (jobLink) {
      jobId = jobLink.getAttribute('data-job-id');
      if (jobId) return jobId;
    }

    // Try parsing from URL
    const link = element.querySelector('a[href*="/jobs/view/"]');
    if (link) {
      const match = link.href.match(/\/jobs\/view\/(\d+)/);
      if (match) return match[1];
    }

    // Fallback: generate from title and company
    const title = this.extractJobTitle(element);
    const company = this.extractCompanyName(element);
    return `job_${btoa(title + company).substring(0, 12)}`;
  }

  /**
   * Extract job posting URL
   */
  static extractJobUrl(element) {
    // Try main link
    let link = element.querySelector('a[href*="/jobs/view/"]');
    if (link?.href) return link.href;

    // Try any link with job id
    link = element.querySelector('[data-job-id]');
    if (link?.href) return link.href;

    // Try finding by text pattern
    const links = element.querySelectorAll('a[href*="/jobs/"]');
    for (const a of links) {
      if (a.href.includes('/view/')) return a.href;
    }

    return null;
  }

  /**
   * Extract job title
   */
  static extractJobTitle(element) {
    // Try common selectors
    const selectors = [
      'h3.base-search-card__title',
      'h3[role="button"]',
      'a[data-job-id] strong',
      '.job-card-title',
      'h3',
      'a[href*="/jobs/view/"]',
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 2) return text;
      }
    }

    return 'Unknown Position';
  }

  /**
   * Extract company name
   */
  static extractCompanyName(element) {
    const selectors = [
      '.base-search-card__subtitle',
      '.job-card-container__company-name',
      'h4.base-search-card__subtitle',
      'span[class*="company"]',
      'a[href*="/company/"]',
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el) {
        let text = el.textContent?.trim() || '';
        // Remove common noise
        text = text.replace(/\n.*/, '').trim();
        if (text && text.length > 2 && !text.includes('reviews')) {
          return text;
        }
      }
    }

    return 'Unknown Company';
  }

  /**
   * Extract location
   */
  static extractLocation(element) {
    const selectors = [
      '.job-search-card__location',
      'span[class*="location"]',
      '.base-search-card__bottom-row span',
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        // Check if looks like location (not salary, not date)
        if (text && !text.includes('$') && !text.match(/\d+\s(minute|hour|day|week|month)s?\s(ago|old)/)) {
          return text;
        }
      }
    }

    return '';
  }

  /**
   * Extract job description snippet
   */
  static extractDescription(element) {
    const selectors = [
      '.base-search-card__snippet',
      '.job-card-description',
      '.job-card-snippet',
      'p[class*="snippet"]',
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 20) {
          return text.substring(0, 500); // Limit to 500 chars
        }
      }
    }

    return '';
  }

  /**
   * Extract posting date
   */
  static extractPostingDate(element) {
    const selectors = [
      'time',
      'span[class*="posted"]',
      'span[aria-label*="posted"]',
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || el.getAttribute('aria-label') || '';
        if (text) {
          try {
            // Parse relative dates like "1 week ago"
            const date = this.parseRelativeDate(text);
            if (date) return date;
          } catch (e) {
            // Fall through
          }
        }
      }
    }

    return null;
  }

  /**
   * Parse relative date strings like "2 days ago"
   */
  static parseRelativeDate(dateString) {
    const now = new Date();
    const match = dateString.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i);

    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const date = new Date(now);
    if (unit === 'minute') date.setMinutes(date.getMinutes() - amount);
    else if (unit === 'hour') date.setHours(date.getHours() - amount);
    else if (unit === 'day') date.setDate(date.getDate() - amount);
    else if (unit === 'week') date.setDate(date.getDate() - amount * 7);
    else if (unit === 'month') date.setMonth(date.getMonth() - amount);

    return date.toISOString().split('T')[0];
  }

  /**
   * Get CSS selector for DOM element (for later re-finding)
   */
  static cssSelector(element) {
    if (element.id) return `#${element.id}`;

    const path = [];
    let el = element;

    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();

      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      }

      if (el.className) {
        const classes = el.className
          .split(' ')
          .filter(c => c && !c.match(/^__/) && c.length < 20)
          .slice(0, 2);
        if (classes.length) {
          selector += `.${classes.join('.')}`;
        }
      }

      // Count siblings to add position hint
      let index = 0;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === selector.split(/[.#]/)[0]) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      if (index > 0) {
        selector += `:nth-child(${index + 1})`;
      }

      path.unshift(selector);
      el = el.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * Validate extracted job data
   */
  static validateJob(job) {
    const errors = [];

    if (!job.job_id || job.job_id.length < 2) {
      errors.push('Invalid job_id');
    }

    if (!job.job_title || job.job_title.length < 3) {
      errors.push('Invalid job_title');
    }

    if (!job.company_name || job.company_name.length < 2) {
      errors.push('Invalid company_name');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Make parser available globally
window.JobCardParser = JobCardParser;
