/**
 * content.js – LinkedIn DOM extraction and floating trigger button.
 *
 * This content script runs on linkedin.com pages. It:
 * 1. Detects whether the user is viewing a feed post or a job listing.
 * 2. Extracts the relevant text (post content or job description).
 * 3. Injects a small floating copilot trigger button near posts/jobs.
 * 4. Communicates with the popup/background via chrome.runtime messaging.
 *
 * Human-in-the-loop: NO automated posting — all actions require manual user approval.
 */

(function () {
  "use strict";

  // Avoid injecting twice
  if (window.__linkedinCopilotInjected) return;
  window.__linkedinCopilotInjected = true;

  const COPILOT_BTN_CLASS = "li-copilot-trigger";

  // ─── Utility: Extract text content from a DOM element ─────────────────

  /**
   * Safely extract trimmed text from a DOM element.
   * @param {Element} el - DOM element
   * @returns {string} Trimmed text content
   */
  function extractText(el) {
    if (!el) return "";
    return el.innerText.trim();
  }

  // ─── Post Detection (Feed) ───────────────────────────────────────────

  /**
   * Find all feed post containers and extract their text.
   * LinkedIn uses various class names; we target common patterns.
   * @returns {Array<{element: Element, text: string}>}
   */
  function detectFeedPosts() {
    const posts = [];
    // LinkedIn feed post text containers
    const selectors = [
      ".feed-shared-update-v2 .feed-shared-text",
      ".feed-shared-update-v2 .feed-shared-inline-show-more-text",
      ".feed-shared-update-v2 .update-components-text",
      '[data-urn] .feed-shared-text',
    ];

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        const text = extractText(el);
        if (text.length > 20) {
          // Find the parent post container
          const postContainer =
            el.closest(".feed-shared-update-v2") ||
            el.closest('[data-urn]') ||
            el.parentElement;
          posts.push({ element: postContainer, text });
        }
      });
    }

    return posts;
  }

  // ─── Job Detection ───────────────────────────────────────────────────

  /**
   * Detect if the current page is a job listing and extract the description.
   * @returns {{ element: Element, text: string } | null}
   */
  function detectJobPost() {
    const selectors = [
      ".jobs-description__content",
      ".jobs-unified-top-card",
      ".job-details-jobs-unified-top-card__job-insight",
      ".jobs-description",
      "#job-details",
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = extractText(el);
        if (text.length > 30) {
          return { element: el, text };
        }
      }
    }
    return null;
  }

  // ─── Floating Trigger Button ─────────────────────────────────────────

  /**
   * Inject a small copilot trigger button near a post/job element.
   * @param {Element} container - The post or job container element
   * @param {string} type - "comment" or "job"
   * @param {string} text - The extracted text
   */
  function injectTriggerButton(container, type, text) {
    // Don't inject if already present
    if (container.querySelector(`.${COPILOT_BTN_CLASS}`)) return;

    const btn = document.createElement("button");
    btn.className = COPILOT_BTN_CLASS;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      <span>AI</span>
    `;
    btn.title =
      type === "comment"
        ? "Generate AI comment suggestions"
        : "Analyze this job with AI";

    // Style the button
    Object.assign(btn.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      zIndex: "9999",
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "4px 10px",
      backgroundColor: "#0A66C2",
      color: "#FFFFFF",
      border: "none",
      borderRadius: "16px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      transition: "all 0.2s ease",
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "#004182";
      btn.style.transform = "scale(1.05)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "#0A66C2";
      btn.style.transform = "scale(1)";
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Send extracted text to background/popup
      chrome.runtime.sendMessage({
        action: "OPEN_COPILOT",
        type: type,
        text: text,
      });
    });

    // Make container relative for absolute positioning
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    container.appendChild(btn);
  }

  // ─── Main Scanner ────────────────────────────────────────────────────

  /**
   * Scan the page for posts and jobs, inject trigger buttons.
   */
  function scanPage() {
    // Scan feed posts
    const posts = detectFeedPosts();
    posts.forEach(({ element, text }) => {
      injectTriggerButton(element, "comment", text);
    });

    // Scan job postings
    const job = detectJobPost();
    if (job) {
      injectTriggerButton(job.element, "job", job.text);
    }
  }

  // ─── Message Listener ────────────────────────────────────────────────

  /**
   * Listen for messages from popup/background requesting page content.
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "GET_PAGE_CONTENT") {
      const job = detectJobPost();
      const posts = detectFeedPosts();

      // Determine page type
      const isJobPage = window.location.href.includes("/jobs/") || !!job;

      sendResponse({
        type: isJobPage ? "job" : "comment",
        text: isJobPage
          ? job?.text || ""
          : posts.length > 0
            ? posts[0].text
            : "",
        url: window.location.href,
      });
    }

    if (message.action === "INSERT_TEXT") {
      // Find the active comment box and insert text  (human-in-the-loop)
      const commentBox = document.querySelector(
        '.comments-comment-box__form [contenteditable="true"], ' +
        '.ql-editor[contenteditable="true"]'
      );
      if (commentBox) {
        commentBox.focus();
        commentBox.textContent = message.text;
        // Trigger input event so LinkedIn detects the change
        commentBox.dispatchEvent(new Event("input", { bubbles: true }));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No comment box found. Please click on a comment field first." });
      }
    }

    if (message.action === "EXTRACT_PROFILE") {
      // Extract profile data from the current LinkedIn page
      try {
        const profileData = {};

        // Name
        const nameEl = document.querySelector(".text-heading-xlarge") ||
          document.querySelector("h1.inline") ||
          document.querySelector("h1");
        profileData.name = nameEl ? nameEl.innerText.trim() : "";

        // Headline
        const headlineEl = document.querySelector(".text-body-medium.break-words") ||
          document.querySelector(".pv-top-card--list .text-body-medium");
        profileData.headline = headlineEl ? headlineEl.innerText.trim() : "";

        // About section
        const aboutSection = document.querySelector("#about");
        let aboutText = "";
        if (aboutSection) {
          const aboutContainer = aboutSection.closest("section");
          if (aboutContainer) aboutText = aboutContainer.innerText.replace("About", "").trim();
        }
        profileData.about = aboutText;

        // Experience section
        const expSection = document.querySelector("#experience");
        let expText = "";
        if (expSection) {
          const expContainer = expSection.closest("section");
          if (expContainer) expText = expContainer.innerText.trim();
        }
        profileData.experience = expText;

        // Skills section
        const skillsSection = document.querySelector("#skills");
        let skillsText = "";
        if (skillsSection) {
          const skillsContainer = skillsSection.closest("section");
          if (skillsContainer) skillsText = skillsContainer.innerText.trim();
        }
        profileData.skills = skillsText;

        // Full page text as fallback (always included)
        const mainContent = document.querySelector("main") || document.body;
        profileData.fullText = mainContent.innerText.substring(0, 3000);

        sendResponse({ success: true, data: profileData });
      } catch (err) {
        sendResponse({ success: false, error: "Error extracting profile: " + err.message });
      }
    }

    return true; // Keep message channel open for async response
  });

  // ─── Initialization ──────────────────────────────────────────────────

  // Initial scan
  setTimeout(scanPage, 2000);

  // Re-scan on scroll (LinkedIn loads content dynamically)
  let scrollTimeout;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(scanPage, 500);
  });

  // Watch for DOM mutations (new posts loaded)
  const observer = new MutationObserver(() => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(scanPage, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("[LinkedIn AI Copilot] Content script loaded ✓");
})();
