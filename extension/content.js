/**
 * content.js – LinkedIn content script (minimal version).
 *
 * This script extracts profile data when the user clicks "Auto-detect from LinkedIn".
 * Users manually copy-paste post captions and job descriptions into the popup.
 */

(function () {
  "use strict";

  // Avoid injecting twice
  if (window.__linkedinCopilotInjected) return;
  window.__linkedinCopilotInjected = true;

  // ─── Message Listener ──────────────────────────────────────────

  /**
   * Listen for messages from popup requesting profile/job extraction.
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

        console.log("[LinkedIn AI Copilot] Profile extracted successfully");
        sendResponse({ success: true, data: profileData });
      } catch (err) {
        console.error("[LinkedIn AI Copilot] Error extracting profile:", err);
        sendResponse({ success: false, error: "Error extracting profile: " + err.message });
      }
    } else if (message.action === "EXTRACT_JOB") {
      // Extract job description from the current LinkedIn job page
      try {
        const jobData = {};

        // Job title - prefer title-specific elements first
        const titleEl = document.querySelector("h1") ||
          document.querySelector(".jobs-details-top-card__job-title") ||
          document.querySelector(".show-more-less-html__markup span");
        jobData.job_title = titleEl ? titleEl.innerText.trim() : "";

        // Company name
        const companyEl = document.querySelector(".org-top-card-summary__org-name") ||
          document.querySelector("[data-test-id='job-details-header-company-name']") ||
          document.querySelector(".show-more-less-html h2");
        jobData.company_name = companyEl ? companyEl.innerText.trim() : "";

        // Location - prefer full innerText from dedicated location element
        const locationEl = document.querySelector("[data-test-id='job-details-location']");
        if (locationEl) {
          jobData.location = locationEl.innerText.trim();
        } else {
          // Fallback: extract with flexible regex for multi-word regions
          const fallbackEl = document.querySelector(".show-more-less-html__markup");
          if (fallbackEl) {
            const text = fallbackEl.innerText;
            const match = text.match(/[A-Za-z\s\u00C0-\u024F-]+,\s*[A-Za-z\s\u00C0-\u024F]+/);
            jobData.location = match ? match[0] : "";
          } else {
            jobData.location = "";
          }
        }

        // Job description - Test multiple selectors in order
        let description = "";
        const selectors = [
          ".show-more-less-html__markup",
          "[data-test-id='job-details-full-description']",
          ".jobs-details__main-content",
          ".show-more-less-element__text"
        ];
        
        for (let selector of selectors) {
          const elem = document.querySelector(selector);
          if (elem) {
            const text = elem.innerText || elem.textContent;
            if (text && text.length > 100) {
              description = text;
              break;
            }
          }
        }
        jobData.description = description.substring(0, 5000); // Limit to 5000 chars

        // Job URL
        jobData.job_url = window.location.href;

        console.log("[LinkedIn AI Copilot] Job description extracted successfully");
        sendResponse({ success: true, data: jobData });
      } catch (err) {
        console.error("[LinkedIn AI Copilot] Error extracting job:", err);
        sendResponse({ success: false, error: "Error extracting job: " + err.message });
      }
    }

    return true; // Keep message channel open for async response
  });

  console.log("[LinkedIn AI Copilot] Content script loaded ✓");
  console.log("[LinkedIn AI Copilot] Auto-detect ready - Copy-paste content for analysis");
})();
