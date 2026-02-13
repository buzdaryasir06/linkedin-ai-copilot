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
   * Listen for messages from popup requesting profile extraction.
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
    }

    return true; // Keep message channel open for async response
  });

  console.log("[LinkedIn AI Copilot] Content script loaded ✓");
  console.log("[LinkedIn AI Copilot] Auto-detect ready - Copy-paste content for analysis");
})();
