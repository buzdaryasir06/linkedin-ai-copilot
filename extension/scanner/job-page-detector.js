/**
 * scanner/job-page-detector.js
 *
 * Detects if we're on a LinkedIn job-related page and extracts page metadata.
 * Used to determine if job scanning should be activated.
 */

class JobPageDetector {
  /**
   * Check if current page is a LinkedIn job search/listing page
   */
  static isJobPage() {
    const url = window.location.href;
    return (
      url.includes('/jobs/search') ||
      url.includes('/jobs/view/') ||
      url.includes('/jobs/?') ||
      this.isJobSearchResults()
    );
  }

  /**
   * Check if we're viewing job search results
   */
  static isJobSearchResults() {
    // Look for job search container in the DOM
    return (
      document.querySelector('[data-jobs-search-list]') !== null ||
      document.querySelector('[role="region"][aria-label*="Job"]') !== null ||
      document.querySelectorAll('[data-job-id]').length > 0
    );
  }

  /**
   * Check if we're viewing a single job posting
   */
  static isSingleJobPage() {
    return window.location.href.includes('/jobs/view/');
  }

  /**
   * Get search query from page (if on search results)
   */
  static getSearchQuery() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('keywords') || '';
    } catch {
      return '';
    }
  }

  /**
   * Get current location filter (if any)
   */
  static getLocationFilter() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('location') || '';
    } catch {
      return '';
    }
  }

  /**
   * Get page context information
   */
  static getPageContext() {
    return {
      url: window.location.href,
      isJobPage: this.isJobPage(),
      isSearchResults: this.isJobSearchResults(),
      isSingleJob: this.isSingleJobPage(),
      searchQuery: this.getSearchQuery(),
      locationFilter: this.getLocationFilter(),
      timestamp: new Date().toISOString(),
      visibleJobCount: document.querySelectorAll('[data-job-id]').length,
    };
  }

  /**
   * Watch for dynamic content changes (infinite scroll)
   * Returns a promise that resolves when new jobs are detected
   */
  static watchForNewJobs(callback, options = {}) {
    const debounceMs = options.debounceMs || 1000;
    const maxWatchTime = options.maxWatchTime || 60000; // 1 minute
    
    let debounceTimer = null;
    let watchStartTime = Date.now();
    let previousCount = document.querySelectorAll('[data-job-id]').length;

    const handleMutation = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const currentCount = document.querySelectorAll('[data-job-id]').length;
        
        if (currentCount > previousCount) {
          const newJobElements = document.querySelectorAll('[data-job-id]');
          callback(newJobElements);
          previousCount = currentCount;
        }

        // Stop watching after max time
        if (Date.now() - watchStartTime > maxWatchTime) {
          observer.disconnect();
        }
      }, debounceMs);
    };

    const observer = new MutationObserver(handleMutation);

    // Observe the list container
    const container = document.querySelector('[data-jobs-search-list]') ||
                      document.querySelector('main') ||
                      document.body;

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // Clean up after max time
    setTimeout(() => {
      observer.disconnect();
    }, maxWatchTime);

    return observer;
  }

  /**
   * Scroll to load more jobs (safely, no auto-click)
   * Returns true if scrolled, false if already at bottom
   */
  static requestScrollToLoad() {
    const scrollContainer = document.querySelector('[data-jobs-search-list]') ||
                            window;

    const scrollTop = scrollContainer.scrollTop || window.scrollY;
    const scrollHeight = scrollContainer.scrollHeight || document.documentElement.scrollHeight;
    const clientHeight = scrollContainer.clientHeight || window.innerHeight;

    const atBottom = scrollHeight - scrollTop - clientHeight < 500;

    if (!atBottom) {
      // Scroll near bottom to trigger lazy loading
      if (scrollContainer === window) {
        window.scrollBy({ top: 300, behavior: 'smooth' });
      } else {
        scrollContainer.scrollBy({ top: 300, behavior: 'smooth' });
      }
      return true;
    }

    return false;
  }

  /**
   * Check if page is still loading jobs
   */
  static isPageLoading() {
    // Look for common loading indicators
    return (
      document.querySelector('[aria-label*="loading"]') !== null ||
      document.querySelector('.jobs-search__loading') !== null ||
      document.querySelector('[role="progressbar"]') !== null ||
      document.querySelector('.spinner') !== null
    );
  }

  /**
   * Wait for initial jobs to load
   */
  static async waitForJobsToLoad(timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (document.querySelectorAll('[data-job-id]').length > 0) {
        return true;
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return false;
  }
}

// Make detector available globally
window.JobPageDetector = JobPageDetector;
