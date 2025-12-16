/**
 * Authentication Module for LarosaWebApp
 * Handles login, logout, and session management using sessionStorage
 */

// IMMEDIATELY check auth and hide page to prevent flash of content
(function () {
  // Add CSS to hide body immediately
  const style = document.createElement("style");
  style.id = "auth-hide-style";
  style.textContent = "body { visibility: hidden !important; }";
  document.head.appendChild(style);
})();

// Use the same API URL from sheets-api.js
const AUTH_API_URL =
  "https://script.google.com/macros/s/AKfycbxnTuRKmf7IhNxkZO4UCPWYT7GLcFDgPLAvvv39bzk77xuY9S7oKecMDMpGgqV4iVk7/exec";

const SESSION_KEY = "larosapot_user";

/**
 * Login user with username and password
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string, user?: string}>}
 */
async function login(username, password) {
  try {
    const response = await fetch(AUTH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        action: "login",
        username: username,
        password: password,
      }),
    });

    const result = await response.json();

    if (result.success) {
      // Store user in sessionStorage
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          username: result.user,
          loginTime: new Date().toISOString(),
        })
      );
    }

    return result;
  } catch (error) {
    console.error("Login failed:", error);
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

/**
 * Logout current user
 */
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

/**
 * Check if user is logged in
 * @returns {boolean}
 */
function isLoggedIn() {
  const session = sessionStorage.getItem(SESSION_KEY);
  return session !== null;
}

/**
 * Get current logged in user
 * @returns {object|null} - {username: string, loginTime: string} or null
 */
function getCurrentUser() {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) {
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Show the page by removing the hide style
 */
function showPage() {
  const hideStyle = document.getElementById("auth-hide-style");
  if (hideStyle) {
    hideStyle.remove();
  }
}

/**
 * Require authentication - redirect to login if not authenticated
 * Call this at the top of protected pages
 */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.replace("index.html"); // Use replace to prevent back button
    return;
  }
  // Auth passed, show the page
  showPage();
}

/**
 * Redirect to dashboard if already logged in
 * Call this on login page
 */
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.replace("dashboard.html"); // Use replace to prevent back button
    return;
  }
  // Not logged in, show login page
  showPage();
}
