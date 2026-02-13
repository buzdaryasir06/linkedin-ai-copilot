/**
 * popup.js – LinkedIn AI Copilot popup logic.
 *
 * Handles:
 * - Mode switching (Comment / Job / Settings)
 * - Fetching page content from the active LinkedIn tab
 * - Calling the backend API via the background service worker
 * - Rendering results (comment suggestions, job analysis)
 * - Copy / Insert / Regenerate actions
 */

(function () {
    "use strict";

    // ─── DOM Elements ──────────────────────────────────────────────────────

    const commentModeBtn = document.getElementById("commentModeBtn");
    const jobModeBtn = document.getElementById("jobModeBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const backBtn = document.getElementById("backBtn");

    const commentPanel = document.getElementById("commentPanel");
    const jobPanel = document.getElementById("jobPanel");
    const settingsPanel = document.getElementById("settingsPanel");

    const postTextInput = document.getElementById("postText");
    const generateBtn = document.getElementById("generateBtn");
    const commentsContainer = document.getElementById("commentsContainer");

    const jobTextInput = document.getElementById("jobText");
    const userSkillsInput = document.getElementById("userSkills");
    const userExperienceInput = document.getElementById("userExperience");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const jobResultsContainer = document.getElementById("jobResultsContainer");

    const saveProfileBtn = document.getElementById("saveProfileBtn");

    const loadingOverlay = document.getElementById("loadingOverlay");
    const statusBar = document.getElementById("statusBar");
    const statusText = document.getElementById("statusText");

    let currentMode = "comment"; // "comment" | "job" | "settings"

    // ─── Initialization ────────────────────────────────────────────────────

    /**
     * Initialize the popup: check backend health, load pending text, load profile.
     */
    async function init() {
        checkBackendHealth();
        loadPendingText();
        loadProfile();
    }

    // ─── Backend Health Check ──────────────────────────────────────────────

    /**
     * Ping the backend to check if it's running.
     */
    function checkBackendHealth() {
        chrome.runtime.sendMessage({ action: "HEALTH_CHECK" }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                showStatus("⚠ Backend offline – Start the server at localhost:8000", "disconnected");
            } else {
                showStatus("✓ Connected to backend", "connected");
                setTimeout(() => hideStatus(), 3000);
            }
        });
    }

    /**
     * Show/hide the status bar.
     */
    function showStatus(text, type) {
        statusText.textContent = text;
        statusBar.className = `status-bar ${type}`;
        statusBar.classList.remove("hidden");
    }

    function hideStatus() {
        statusBar.classList.add("hidden");
    }

    // ─── Load Pending Text from Content Script ─────────────────────────────

    /**
     * Check if the content script stored extracted text (from clicking the AI button).
     */
    function loadPendingText() {
        chrome.storage.local.get(["pendingText", "pendingType"], (data) => {
            if (data.pendingText) {
                if (data.pendingType === "job") {
                    switchMode("job");
                    jobTextInput.value = data.pendingText;
                } else {
                    switchMode("comment");
                    postTextInput.value = data.pendingText;
                }
                // Clear pending data
                chrome.storage.local.set({ pendingText: "", pendingType: "comment" });
            } else {
                // Try to extract from active tab
                fetchActiveTabContent();
            }
        });
    }

    /**
     * Request the content script to extract text from the active LinkedIn tab.
     */
    function fetchActiveTabContent() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].url?.includes("linkedin.com")) return;

            chrome.tabs.sendMessage(tabs[0].id, { action: "GET_PAGE_CONTENT" }, (response) => {
                if (chrome.runtime.lastError || !response) return;

                if (response.type === "job" && response.text) {
                    jobTextInput.value = response.text;
                    if (currentMode !== "settings") switchMode("job");
                } else if (response.text) {
                    postTextInput.value = response.text;
                }
            });
        });
    }

    // ─── Mode Switching ────────────────────────────────────────────────────

    /**
     * Switch between Comment, Job, and Settings modes.
     * @param {"comment"|"job"|"settings"} mode
     */
    function switchMode(mode) {
        currentMode = mode;

        // Update toggle buttons
        commentModeBtn.classList.toggle("active", mode === "comment");
        jobModeBtn.classList.toggle("active", mode === "job");

        // Show/hide panels
        commentPanel.classList.toggle("hidden", mode !== "comment");
        jobPanel.classList.toggle("hidden", mode !== "job");
        settingsPanel.classList.toggle("hidden", mode !== "settings");
    }

    // ─── Comment Generation ────────────────────────────────────────────────

    /**
     * Generate 3 AI comment suggestions for the entered post text.
     */
    async function handleGenerateComments() {
        const postText = postTextInput.value.trim();
        if (!postText) {
            showToast("Please enter a LinkedIn post to comment on.");
            return;
        }

        showLoading(true);
        generateBtn.disabled = true;

        chrome.runtime.sendMessage(
            { action: "GENERATE_COMMENTS", postText },
            (response) => {
                showLoading(false);
                generateBtn.disabled = false;

                if (chrome.runtime.lastError) {
                    showToast("Connection error. Is the extension reloaded?");
                    return;
                }

                if (!response?.success) {
                    showToast(response?.error || "Failed to generate comments.");
                    return;
                }

                renderComments(response.data.comments);
            }
        );
    }

    /**
     * Render the 3 comment suggestion cards.
     * @param {Array} comments - Array of {style, comment}
     */
    function renderComments(comments) {
        commentsContainer.innerHTML = "";
        commentsContainer.classList.remove("hidden");

        comments.forEach((c, index) => {
            const card = document.createElement("div");
            card.className = "comment-card";
            card.innerHTML = `
        <div class="comment-card-header">
          <span class="comment-style-badge ${escapeHtml(c.style)}">${escapeHtml(c.style)}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.comment)}</p>
        <div class="comment-actions">
          <button class="action-btn copy-btn" data-index="${index}" title="Copy to clipboard">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <button class="action-btn insert-btn" data-index="${index}" title="Insert into LinkedIn comment box">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
            Insert
          </button>
        </div>
      `;
            commentsContainer.appendChild(card);
        });

        // Add regenerate button at the bottom
        const regenBtn = document.createElement("button");
        regenBtn.className = "secondary-btn";
        regenBtn.style.width = "100%";
        regenBtn.style.marginTop = "8px";
        regenBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:4px">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      Regenerate
    `;
        regenBtn.addEventListener("click", handleGenerateComments);
        commentsContainer.appendChild(regenBtn);

        // Attach copy and insert listeners
        commentsContainer.querySelectorAll(".copy-btn").forEach((btn) => {
            btn.addEventListener("click", () => handleCopy(comments[btn.dataset.index].comment, btn));
        });

        commentsContainer.querySelectorAll(".insert-btn").forEach((btn) => {
            btn.addEventListener("click", () => handleInsert(comments[btn.dataset.index].comment));
        });
    }

    // ─── Job Analysis ──────────────────────────────────────────────────────

    /**
     * Analyze a job posting with the user's skills and experience.
     */
    async function handleAnalyzeJob() {
        const jobText = jobTextInput.value.trim();
        if (!jobText) {
            showToast("Please enter a job description to analyze.");
            return;
        }

        const userSkills = userSkillsInput.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const userExperience = userExperienceInput.value.trim();

        showLoading(true);
        analyzeBtn.disabled = true;

        chrome.runtime.sendMessage(
            { action: "ANALYZE_JOB", jobText, userSkills, userExperience },
            (response) => {
                showLoading(false);
                analyzeBtn.disabled = false;

                if (chrome.runtime.lastError) {
                    showToast("Connection error. Is the extension reloaded?");
                    return;
                }

                if (!response?.success) {
                    showToast(response?.error || "Failed to analyze job posting.");
                    return;
                }

                renderJobAnalysis(response.data);
            }
        );
    }

    /**
     * Render the job analysis results.
     * @param {object} data - JobAnalysisResponse
     */
    function renderJobAnalysis(data) {
        jobResultsContainer.innerHTML = "";
        jobResultsContainer.classList.remove("hidden");

        // Determine the verdict based on match percentage
        let verdictEmoji, verdictText, verdictColor;
        if (data.match_percentage >= 80) {
            verdictEmoji = "🟢";
            verdictText = "Strong Match — You're a great fit for this role!";
            verdictColor = "var(--success)";
        } else if (data.match_percentage >= 50) {
            verdictEmoji = "🟡";
            verdictText = "Partial Match — You have a solid foundation, some skills to build.";
            verdictColor = "#F57F17";
        } else {
            verdictEmoji = "🔴";
            verdictText = "Low Match — This role needs skills you're still developing.";
            verdictColor = "var(--warning)";
        }

        const html = `
      <!-- Verdict Header -->
      <div class="job-section" style="text-align:center; padding: 16px;">
        <div style="font-size: 28px; font-weight: 700; color: ${verdictColor};">${data.match_percentage}%</div>
        <div class="match-meter" style="margin: 8px 0;">
          <div class="match-meter-fill" style="width: ${data.match_percentage}%; background: ${verdictColor};"></div>
        </div>
        <div style="font-size: 13px; color: ${verdictColor}; font-weight: 600;">${verdictEmoji} ${verdictText}</div>
      </div>

      <!-- Skills You Already Have -->
      ${data.matched_skills.length ? `
      <div class="job-section">
        <div class="job-section-title">✅ Skills You Already Have</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">These skills from your profile match what the job requires.</div>
        <div class="skill-badges">
          ${data.matched_skills.map((s) => `<span class="skill-badge matched">${escapeHtml(s)}</span>`).join("")}
        </div>
      </div>` : ""}

      <!-- Skills You Need to Learn -->
      ${data.missing_skills.length ? `
      <div class="job-section">
        <div class="job-section-title">📚 Skills You Need to Learn</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">The job requires these but they're not in your profile yet. Consider learning them!</div>
        <div class="skill-badges">
          ${data.missing_skills.map((s) => `<span class="skill-badge missing">${escapeHtml(s)}</span>`).join("")}
        </div>
      </div>` : ""}

      <!-- Cover Letter / Application Note -->
      ${data.personalized_note ? `
      <div class="job-section">
        <div class="job-section-title">✍️ Ready-to-Use Application Note</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Copy this and use it when applying — it highlights your strengths for this specific job.</div>
        <div class="ai-note">${escapeHtml(data.personalized_note)}</div>
        <div style="margin-top:8px">
          <button class="action-btn copy-note-btn" title="Copy note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Note
          </button>
        </div>
      </div>` : ""}

      <!-- Resume Tips -->
      ${data.resume_tips.length ? `
      <div class="job-section">
        <div class="job-section-title">📝 How to Improve Your Resume for This Job</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Make these changes to your resume before applying.</div>
        <ul class="tip-list">
          ${data.resume_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>` : ""}

      <!-- Similar Roles -->
      ${data.similar_roles.length ? `
      <div class="job-section">
        <div class="job-section-title">🔗 Other Jobs You Could Apply For</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Based on your skills, you might also be a good fit for these roles.</div>
        <div class="role-chips">
          ${data.similar_roles.map((r) => `<span class="role-chip">${escapeHtml(r)}</span>`).join("")}
        </div>
      </div>` : ""}
    `;

        jobResultsContainer.innerHTML = html;

        // Copy note button
        const copyNoteBtn = jobResultsContainer.querySelector(".copy-note-btn");
        if (copyNoteBtn) {
            copyNoteBtn.addEventListener("click", () => handleCopy(data.personalized_note, copyNoteBtn));
        }
    }

    // ─── Profile / Settings ────────────────────────────────────────────────

    /**
     * Load the user profile from the backend.
     */
    function loadProfile() {
        chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (response) => {
            if (chrome.runtime.lastError || !response?.success || !response.data) return;

            const p = response.data;
            document.getElementById("profileName").value = p.name || "";
            document.getElementById("profileSkills").value = (p.skills || []).join(", ");
            document.getElementById("profileExperience").value = p.experience || "";
            document.getElementById("profileSummary").value = p.summary || "";

            // Pre-fill job mode skills if available
            if (p.skills?.length && !userSkillsInput.value) {
                userSkillsInput.value = p.skills.join(", ");
            }
            if (p.experience && !userExperienceInput.value) {
                userExperienceInput.value = p.experience;
            }
        });
    }

    /**
     * Save the user profile to the backend.
     */
    function handleSaveProfile() {
        const profile = {
            name: document.getElementById("profileName").value.trim(),
            skills: document.getElementById("profileSkills").value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            experience: document.getElementById("profileExperience").value.trim(),
            summary: document.getElementById("profileSummary").value.trim(),
        };

        chrome.runtime.sendMessage({ action: "SAVE_PROFILE", profile }, (response) => {
            if (chrome.runtime.lastError) {
                showToast("Failed to save profile. Check backend connection.");
                return;
            }
            if (response?.success) {
                showToast("Profile saved ✓");
                // Update job mode inputs
                userSkillsInput.value = profile.skills.join(", ");
                userExperienceInput.value = profile.experience;
            } else {
                showToast(response?.error || "Failed to save profile.");
            }
        });
    }

    // ─── Actions: Copy & Insert ────────────────────────────────────────────

    /**
     * Copy text to clipboard and show feedback on the button.
     * @param {string} text - Text to copy
     * @param {HTMLElement} btn - The clicked button element
     */
    function handleCopy(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = btn.innerHTML;
            btn.classList.add("copied");
            btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
            setTimeout(() => {
                btn.classList.remove("copied");
                btn.innerHTML = originalHTML;
            }, 2000);
        });
    }

    /**
     * Insert text into the LinkedIn comment box on the active tab.
     * @param {string} text
     */
    function handleInsert(text) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;

            chrome.tabs.sendMessage(
                tabs[0].id,
                { action: "INSERT_TEXT", text },
                (response) => {
                    if (chrome.runtime.lastError || !response?.success) {
                        showToast(response?.error || "Could not insert. Click on a comment box first.");
                    } else {
                        showToast("Inserted into comment box ✓");
                    }
                }
            );
        });
    }

    // ─── Utilities ─────────────────────────────────────────────────────────

    /**
     * Show / hide the loading overlay.
     * @param {boolean} visible
     */
    function showLoading(visible) {
        loadingOverlay.classList.toggle("hidden", !visible);
    }

    /**
     * Show a toast notification.
     * @param {string} message
     */
    function showToast(message) {
        // Remove existing toast
        const existing = document.querySelector(".toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    /**
     * Escape HTML to prevent XSS in rendered content.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Event Listeners ──────────────────────────────────────────────────

    commentModeBtn.addEventListener("click", () => switchMode("comment"));
    jobModeBtn.addEventListener("click", () => switchMode("job"));
    settingsBtn.addEventListener("click", () => switchMode("settings"));
    backBtn.addEventListener("click", () => switchMode(currentMode === "settings" ? "comment" : currentMode));

    generateBtn.addEventListener("click", handleGenerateComments);
    analyzeBtn.addEventListener("click", handleAnalyzeJob);
    saveProfileBtn.addEventListener("click", handleSaveProfile);

    // Auto-detect profile from LinkedIn
    const autoDetectBtn = document.getElementById("autoDetectBtn");
    const autoDetectStatus = document.getElementById("autoDetectStatus");

    autoDetectBtn.addEventListener("click", () => {
        // Directly message the active tab's content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                showToast("No active tab found.");
                return;
            }

            autoDetectStatus.textContent = "🔍 Extracting profile from LinkedIn...";
            autoDetectStatus.style.display = "block";
            autoDetectStatus.style.color = "var(--linkedin-blue)";
            autoDetectBtn.disabled = true;

            chrome.tabs.sendMessage(tabs[0].id, { action: "EXTRACT_PROFILE" }, (response) => {
                if (chrome.runtime.lastError) {
                    autoDetectStatus.textContent = "❌ Could not connect. Please refresh your LinkedIn page and try again.";
                    autoDetectStatus.style.color = "var(--warning)";
                    autoDetectBtn.disabled = false;
                    return;
                }

                if (!response?.success) {
                    autoDetectStatus.textContent = "❌ " + (response?.error || "Could not extract profile. Refresh your LinkedIn profile page and try again.");
                    autoDetectStatus.style.color = "var(--warning)";
                    autoDetectBtn.disabled = false;
                    return;
                }

                const profileData = response.data;
                autoDetectStatus.textContent = "🤖 AI is analyzing your profile...";

                // Combine extracted data
                let rawText = "";
                if (profileData.name) rawText += "Name: " + profileData.name + "\n";
                if (profileData.headline) rawText += "Headline: " + profileData.headline + "\n";
                if (profileData.about) rawText += "About: " + profileData.about + "\n";
                if (profileData.experience) rawText += "Experience: " + profileData.experience + "\n";
                if (profileData.skills) rawText += "Skills: " + profileData.skills + "\n";
                if (!rawText && profileData.fullText) rawText = profileData.fullText;

                // Send to AI for analysis
                chrome.runtime.sendMessage(
                    { action: "ANALYZE_PROFILE", rawText },
                    (aiResponse) => {
                        autoDetectBtn.disabled = false;

                        if (chrome.runtime.lastError || !aiResponse?.success) {
                            autoDetectStatus.textContent = "❌ " + (aiResponse?.error || "AI analysis failed. Try again.");
                            autoDetectStatus.style.color = "var(--warning)";
                            return;
                        }

                        const ai = aiResponse.data;
                        // Fill in the fields for user review
                        document.getElementById("profileName").value = ai.name || profileData.name || "";
                        document.getElementById("profileSkills").value = (ai.skills || []).join(", ");
                        document.getElementById("profileExperience").value = ai.experience || "";
                        document.getElementById("profileSummary").value = ai.summary || "";

                        autoDetectStatus.textContent = "✅ Profile detected! Review the fields above and click Save Profile to confirm.";
                        autoDetectStatus.style.color = "var(--success)";
                        showToast("Profile auto-detected! Review & save.");
                    }
                );
            });
        });
    });

    // ─── Enhance Profile ──────────────────────────────────────────────────

    const enhanceProfileBtn = document.getElementById("enhanceProfileBtn");
    const enhanceStatus = document.getElementById("enhanceStatus");
    const enhanceResultsContainer = document.getElementById("enhanceResultsContainer");

    enhanceProfileBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                showToast("No active tab found.");
                return;
            }

            enhanceStatus.textContent = "🔍 Scanning your LinkedIn profile...";
            enhanceStatus.style.display = "block";
            enhanceStatus.style.color = "var(--linkedin-blue)";
            enhanceProfileBtn.disabled = true;
            enhanceResultsContainer.classList.add("hidden");

            chrome.tabs.sendMessage(tabs[0].id, { action: "EXTRACT_PROFILE" }, (response) => {
                if (chrome.runtime.lastError) {
                    enhanceStatus.textContent = "❌ Could not connect. Refresh your LinkedIn page and try again.";
                    enhanceStatus.style.color = "var(--warning)";
                    enhanceProfileBtn.disabled = false;
                    return;
                }

                if (!response?.success) {
                    enhanceStatus.textContent = "❌ " + (response?.error || "Could not read profile. Refresh LinkedIn and try again.");
                    enhanceStatus.style.color = "var(--warning)";
                    enhanceProfileBtn.disabled = false;
                    return;
                }

                const profileData = response.data;
                enhanceStatus.textContent = "🤖 AI is analyzing your profile for improvements...";

                // Build raw text from extracted data
                let rawText = "";
                if (profileData.name) rawText += "Name: " + profileData.name + "\n";
                if (profileData.headline) rawText += "Headline: " + profileData.headline + "\n";
                if (profileData.about) rawText += "About: " + profileData.about + "\n";
                if (profileData.experience) rawText += "Experience: " + profileData.experience + "\n";
                if (profileData.skills) rawText += "Skills: " + profileData.skills + "\n";
                if (!rawText && profileData.fullText) rawText = profileData.fullText;

                chrome.runtime.sendMessage(
                    { action: "ENHANCE_PROFILE", rawText },
                    (aiResponse) => {
                        enhanceProfileBtn.disabled = false;

                        if (chrome.runtime.lastError || !aiResponse?.success) {
                            enhanceStatus.textContent = "❌ " + (aiResponse?.error || "Enhancement failed. Try again.");
                            enhanceStatus.style.color = "var(--warning)";
                            return;
                        }

                        enhanceStatus.textContent = "✅ Here are your AI-powered profile improvement suggestions:";
                        enhanceStatus.style.color = "var(--success)";
                        renderEnhanceResults(aiResponse.data);
                    }
                );
            });
        });
    });

    function renderEnhanceResults(data) {
        enhanceResultsContainer.innerHTML = "";
        enhanceResultsContainer.classList.remove("hidden");

        // Score color
        let scoreColor, scoreEmoji, scoreVerdict;
        const score = data.profile_score || 0;
        if (score >= 80) {
            scoreColor = "var(--success)";
            scoreEmoji = "🟢";
            scoreVerdict = "Excellent! Your profile is strong.";
        } else if (score >= 60) {
            scoreColor = "#F57F17";
            scoreEmoji = "🟡";
            scoreVerdict = "Good foundation — a few tweaks will make it shine.";
        } else {
            scoreColor = "var(--warning)";
            scoreEmoji = "🔴";
            scoreVerdict = "Needs work — follow these suggestions to stand out.";
        }

        const html = `
      <!-- Profile Score -->
      <div class="job-section" style="text-align:center; padding: 16px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-light); margin-bottom: 4px;">Profile Score</div>
        <div style="font-size: 32px; font-weight: 700; color: ${scoreColor};">${score}/100</div>
        <div class="match-meter" style="margin: 8px 0;">
          <div class="match-meter-fill" style="width: ${score}%; background: ${scoreColor};"></div>
        </div>
        <div style="font-size: 13px; color: ${scoreColor}; font-weight: 600;">${scoreEmoji} ${scoreVerdict}</div>
      </div>

      <!-- Headline Suggestion -->
      ${data.headline_suggestion ? `
      <div class="job-section">
        <div class="job-section-title">💼 Suggested Headline</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Replace your current headline with this to grab more attention.</div>
        <div class="ai-note" style="font-weight: 600; font-size: 14px;">${escapeHtml(data.headline_suggestion)}</div>
        <div style="margin-top: 8px;">
          <button class="action-btn copy-headline-btn" title="Copy headline">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Headline
          </button>
        </div>
      </div>` : ""}

      <!-- About Section Rewrite -->
      ${data.about_rewrite ? `
      <div class="job-section">
        <div class="job-section-title">📝 Improved About Section</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Copy this and paste it in your LinkedIn About section for a stronger first impression.</div>
        <div class="ai-note" style="white-space: pre-line; font-size: 12px; line-height: 1.6;">${escapeHtml(data.about_rewrite)}</div>
        <div style="margin-top: 8px;">
          <button class="action-btn copy-about-btn" title="Copy about section">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy About Section
          </button>
        </div>
      </div>` : ""}

      <!-- Skills to Add -->
      ${data.skills_to_add?.length ? `
      <div class="job-section">
        <div class="job-section-title">🎯 Skills to Add to Your Profile</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Adding these skills makes you more discoverable by recruiters.</div>
        <div class="skill-badges">
          ${data.skills_to_add.map((s) => `<span class="skill-badge matched">${escapeHtml(s)}</span>`).join("")}
        </div>
      </div>` : ""}

      <!-- Tips -->
      ${data.tips?.length ? `
      <div class="job-section">
        <div class="job-section-title">🚀 Action Plan to Level Up</div>
        <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">Follow these steps to boost your LinkedIn visibility and credibility.</div>
        <ul class="tip-list">
          ${data.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>` : ""}
    `;

        enhanceResultsContainer.innerHTML = html;

        // Copy handlers
        const copyHeadlineBtn = enhanceResultsContainer.querySelector(".copy-headline-btn");
        if (copyHeadlineBtn) {
            copyHeadlineBtn.addEventListener("click", () => handleCopy(data.headline_suggestion, copyHeadlineBtn));
        }

        const copyAboutBtn = enhanceResultsContainer.querySelector(".copy-about-btn");
        if (copyAboutBtn) {
            copyAboutBtn.addEventListener("click", () => handleCopy(data.about_rewrite, copyAboutBtn));
        }
    }

    // ─── Start ─────────────────────────────────────────────────────────────

    init();
})();
