/**
 * background.js – Service worker for the Chrome extension.
 *
 * Proxies API requests between the popup/content scripts and the
 * FastAPI backend running at localhost:8000.
 *
 * Handles:
 * - Comment generation requests
 * - Job analysis requests
 * - User profile retrieval/updates
 */

const API_BASE = "http://localhost:8000";

// ─── Side Panel ─────────────────────────────────────────────────────────────

// Open side panel when extension icon is clicked (stays open unlike popups)
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// ─── API Helper ─────────────────────────────────────────────────────────────

/**
 * Make a fetch request to the backend API.
 * @param {string} endpoint - API endpoint path (e.g. "/generate-comment")
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body (JSON-serializable)
 * @returns {Promise<object>} Parsed JSON response
 */
async function apiRequest(endpoint, method = "POST", body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };

    if (body && method !== "GET") {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
}

// ─── Message Listener ───────────────────────────────────────────────────────

/**
 * Listen for messages from popup and content scripts.
 * Routes requests to the appropriate backend endpoint.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle message asynchronously
    handleMessage(message)
        .then((result) => {
            sendResponse(result);
        })
        .catch((error) => {
            console.error("[LinkedIn AI Copilot] Background error:", error);
            sendResponse({
                success: false,
                error: error.message || "Failed to connect to backend. Is the server running?",
            });
        });

    // Return true to indicate async response
    return true;
});

/**
 * Handle incoming messages from popup and content scripts.
 * Routes requests to the appropriate backend endpoint.
 */
async function handleMessage(message) {
    try {
        switch (message.action) {
            // ── Comment Mode ────────────────────────────────────────────
            case "GENERATE_COMMENTS": {
                const data = await apiRequest("/generate-comment", "POST", {
                    post_text: message.postText,
                    tone: message.tone || null,
                });
                return { success: true, data };
            }

            // ── Job Mode ────────────────────────────────────────────────
            case "ANALYZE_JOB": {
                const data = await apiRequest("/analyze-job", "POST", {
                    job_text: message.jobText,
                    user_skills: message.userSkills || [],
                    user_experience: message.userExperience || "",
                });
                return { success: true, data };
            }

            // ── User Profile ────────────────────────────────────────────
            case "GET_PROFILE": {
                const data = await apiRequest("/profile", "GET");
                return { success: true, data };
            }

            case "SAVE_PROFILE": {
                const data = await apiRequest("/profile", "PUT", message.profile);
                return { success: true, data };
            }

            // ── Profile Analysis ────────────────────────────────────────
            case "ANALYZE_PROFILE": {
                const data = await apiRequest("/analyze-profile", "POST", {
                    raw_text: message.rawText,
                });
                return { success: true, data };
            }

            // ── Profile Enhancement ─────────────────────────────────────
            case "ENHANCE_PROFILE": {
                const data = await apiRequest("/enhance-profile", "POST", {
                    raw_text: message.rawText,
                });
                return { success: true, data };
            }

            // ── Health Check ────────────────────────────────────────────
            case "HEALTH_CHECK": {
                const data = await apiRequest("/health", "GET");
                return { success: true, data };
            }

            default:
                return { success: false, error: "Unknown action: " + message.action };
        }
    } catch (error) {
        throw error;
    }
}

// ─── Installation Event ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    console.log("[LinkedIn AI Copilot] Extension installed ✓");
    // Initialize default storage values
    chrome.storage.local.set({
        pendingText: "",
        pendingType: "comment",
    });
});
