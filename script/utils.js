/**
 * Shared Utilities for LarosaWebApp
 * Centralized helper functions to reduce code duplication
 */

// ==================== DATE FORMATTING ====================

/**
 * Format date for display (DD-MM-YYYY)
 * @param {string|Date} dateValue - Date value to format
 * @returns {string} Formatted date string
 */
function formatDisplayDate(dateValue) {
  if (!dateValue) return "-";

  try {
    let date;
    if (typeof dateValue === "string") {
      if (dateValue.includes("T")) {
        date = new Date(dateValue);
      } else if (dateValue.includes("-") && dateValue.length > 10) {
        return dateValue.split("T")[0];
      } else {
        date = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return String(dateValue);
    }

    if (isNaN(date.getTime())) return String(dateValue);

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (e) {
    return String(dateValue);
  }
}

/**
 * Format date for display in table (handles ISO and DD-Mon-YYYY format)
 * Converts to DD-Mon-YYYY without using Date object to avoid timezone issues
 */
function formatDateForDisplay(dateValue) {
  if (!dateValue) return "-";

  const str = String(dateValue).trim();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // If already in DD-Mon-YYYY format, return as-is
  const ddMonYYYY = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMonYYYY) {
    return `${ddMonYYYY[1].padStart(2, "0")}-${ddMonYYYY[2]}-${ddMonYYYY[3]}`;
  }

  // If in ISO format (contains T), parse manually to avoid timezone issues
  if (str.includes("T")) {
    // Extract date part: "2026-02-03T17:00:00.002Z" -> "2026-02-03"
    const isoDate = str.split("T")[0];
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      // Add 1 day to compensate for UTC offset (Indonesia is UTC+7)
      const dayNum = parseInt(day, 10) + 1;
      return `${String(dayNum).padStart(2, "0")}-${monthNames[monthIdx]}-${year}`;
    }
  }

  // If in YYYY-MM-DD format
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const monthIdx = parseInt(ymd[2], 10) - 1;
    return `${ymd[3]}-${monthNames[monthIdx]}-${ymd[1]}`;
  }

  // Fallback: return as-is
  return str;
}

/**
 * Format date for Google Sheet (DD-Mon-YYYY)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDateForSheet(dateString) {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateString;
  }
}

// ==================== CURRENCY FORMATTING ====================

/**
 * Format number as Indonesian Rupiah currency
 * @param {number|string} value - Value to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return "Rp" + num.toLocaleString("id-ID");
}

// ==================== PHONE NUMBER ====================

/**
 * Format phone number to Indonesian format (62xxx)
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return "";
  phone = phone.toString().trim();

  // Remove any existing +62 or 62 prefix
  if (phone.startsWith("+62")) {
    phone = phone.substring(3);
  } else if (phone.startsWith("62")) {
    phone = phone.substring(2);
  }

  // Remove leading 0 if present
  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  // Add 62 prefix
  return "62" + phone;
}

// ==================== UI HELPERS ====================

/**
 * Show refresh indicator in page header
 * @param {string} indicatorId - Unique ID for the indicator element
 * @param {string} [message="Memperbarui data..."] - Optional message to display
 */
function showRefreshIndicator(indicatorId, message = "Memperbarui data...") {
  const header = document.querySelector(".header h1");
  if (header && !document.getElementById(indicatorId)) {
    header.insertAdjacentHTML(
      "afterend",
      `<span id="${indicatorId}" style="font-size: 12px; color: #888; margin-left: 10px;">${message}</span>`,
    );
  }
}

/**
 * Hide refresh indicator
 * @param {string} indicatorId - ID of the indicator element to remove
 */
function hideRefreshIndicator(indicatorId) {
  const indicator = document.getElementById(indicatorId);
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Close modal by ID
 * @param {string} modalId - ID of the modal to close
 */
function closeModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
}

// ==================== COLUMN VALUE HELPERS ====================

/**
 * Find column value by partial key match (case-insensitive)
 * Useful for handling inconsistent column names from Google Sheets
 * @param {object} obj - Object to search in
 * @param {string} searchKey - Key to search for
 * @returns {any} Found value or null
 */
function getColumnValue(obj, searchKey) {
  for (const key of Object.keys(obj)) {
    if (key.toUpperCase().includes(searchKey.toUpperCase())) {
      return obj[key];
    }
  }
  return null;
}

/**
 * Get value from object with multiple possible key names
 * @param {object} obj - Object to search in
 * @param {string[]} keys - Array of possible key names
 * @param {any} [defaultValue=""] - Default value if not found
 * @param {boolean} [treatEmptyAsDefault=false] - Whether to treat empty string as default
 * @returns {any} Found value or default
 */
function getValueFromKeys(
  obj,
  keys,
  defaultValue = "",
  treatEmptyAsDefault = false,
) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      // If treatEmptyAsDefault is true, also check for empty string
      if (treatEmptyAsDefault && obj[key] === "") {
        continue;
      }
      return obj[key];
    }
  }
  return defaultValue;
}

// ==================== TABLE HELPERS ====================

/**
 * Resolves a customer's city from the customer database if missing
 * @param {string} name - Customer name
 * @param {string} phone - Customer phone
 * @returns {string} Customer city or empty string
 */
function getCityForCustomer(name, phone) {
  if (!name && !phone) return "";

  try {
    let customers = [];
    const cacheKeys = ["larosapot_customer_cache", "kustomer_data_cache"];
    for (const key of cacheKeys) {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          customers = JSON.parse(cached);
          if (Array.isArray(customers) && customers.length > 0) break;
        } catch (e) {}
      }
    }

    if (!Array.isArray(customers) || customers.length === 0) return "";

    const searchName = (name || "").toString().toLowerCase().trim();
    const searchPhone = (phone || "").toString().trim();

    const match = customers.find((c) => {
      const cName = getValueFromKeys(
        c,
        ["NAMA PELANGGAN", "NAMA\nPELANGGAN", "Nama Pelanggan"],
        "",
      )
        .toString()
        .toLowerCase()
        .trim();
      const cPhone = getValueFromKeys(c, ["NO HP", "NO\nHP", "No HP"], "")
        .toString()
        .trim();
      return (
        (searchName && cName === searchName) ||
        (searchPhone && cPhone === searchPhone)
      );
    });

    if (match) return getValueFromKeys(match, ["KOTA", "Kota"], "");
  } catch (e) {
    console.warn("City lookup error:", e);
  }
  return "";
}

/**
 * Resolves a customer's address from the customer database if missing
 * Uses async lookup to check IDB cache (via DataServices) first, then LocalStorage
 * @param {string} name - Customer name
 * @param {string} phone - Customer phone
 * @returns {Promise<string>} Customer address or empty string
 */
async function getAddressForCustomer(name, phone) {
  if (!name && !phone) return "";

  let customers = [];

  // 1. Try DataServices / IDBCache (v2) - Preferred
  if (window.DataServices && window.DataServices.customer) {
    try {
      const cached = await window.DataServices.customer.getCached();
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        customers = cached.data;
      }
    } catch (e) {
      console.warn("Error reading IDB customer cache for address lookup:", e);
    }
  }

  // 2. Fallback to LocalStorage (v1) if IDB failed or empty
  if (customers.length === 0) {
    const cacheKeys = ["larosapot_customer_cache", "kustomer_data_cache"];
    for (const key of cacheKeys) {
      const cachedStr = localStorage.getItem(key);
      if (cachedStr) {
        try {
          const parsed = JSON.parse(cachedStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            customers = parsed;
            break;
          }
        } catch (e) {}
      }
    }
  }

  if (customers.length === 0) return "";

  const searchName = (name || "").toString().toLowerCase().trim();
  const searchPhone = (phone || "").toString().replace(/\D/g, ""); // Digits only

  const match = customers.find((c) => {
    // Name Check
    const cName = getValueFromKeys(
      c,
      ["NAMA PELANGGAN", "NAMA\nPELANGGAN", "Nama Pelanggan"],
      "",
      true,
    )
      .toString()
      .toLowerCase()
      .trim();

    // Phone Check
    const cPhoneRaw = getValueFromKeys(
      c,
      ["NO HP", "NO\nHP", "No HP"],
      "",
      true,
    ).toString();
    const cPhone = cPhoneRaw.replace(/\D/g, "");

    const nameMatch = searchName && cName === searchName;

    // Loose phone checking (includes)
    const phoneMatch =
      searchPhone &&
      cPhone &&
      (cPhone.includes(searchPhone) || searchPhone.includes(cPhone));

    return phoneMatch || nameMatch;
  });

  if (match) {
    return getValueFromKeys(match, ["ALAMAT", "Alamat"], "");
  }

  return "";
}

/**
 * Show empty table message
 * @param {HTMLElement} tbody - Table body element
 * @param {string} message - Message to display
 * @param {number} [colSpan=8] - Number of columns to span
 * @param {boolean} [isError=false] - Whether this is an error message
 */
function showTableMessage(tbody, message, colSpan = 8, isError = false) {
  const style = isError
    ? "text-align: center; color: red;"
    : "text-align: center;";
  tbody.innerHTML = `<tr><td colspan="${colSpan}" style="${style}">${message}</td></tr>`;
}

const USERS_CACHE_KEY = "larosapot_users_cache";

/**
 * Load kasir list from USERS sheet and populate a select element
 * Uses cache-first strategy for instant loading
 * @param {string} elementId - ID of the select element
 * @param {string} [defaultValue] - Optional default value to select
 */
async function loadKasirDropdown(elementId, defaultValue) {
  const select = document.getElementById(elementId);
  if (!select) return;

  // If defaultValue is not provided, try to get current user
  if (!defaultValue && typeof getCurrentUser === "function") {
    const user = getCurrentUser();
    if (user) defaultValue = user.username;
  }

  // Step 1: Populate from cache IMMEDIATELY (non-blocking)
  try {
    const cached = localStorage.getItem(USERS_CACHE_KEY);
    if (cached) {
      const users = JSON.parse(cached);
      populateKasirSelect(select, users, defaultValue);
    } else if (defaultValue) {
      // No cache, but we have a default - show it immediately
      select.innerHTML = `<option value="${defaultValue}" selected>${defaultValue}</option>`;
    }
  } catch (e) {
    console.warn("Error loading kasir cache:", e);
    if (defaultValue) {
      select.innerHTML = `<option value="${defaultValue}" selected>${defaultValue}</option>`;
    }
  }

  // Step 2: Fetch fresh data in background and update cache
  try {
    const result = await fetchSheetData("USERS");
    if (result && result.data && result.data.length > 0) {
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(result.data));
      populateKasirSelect(select, result.data, defaultValue);
    }
  } catch (error) {
    console.error("Error refreshing kasir dropdown:", error);
    // Cache already shown, so no action needed
  }
}

/**
 * Populate select element with kasir options
 */
function populateKasirSelect(select, users, defaultValue) {
  select.innerHTML = "";
  users.forEach((user) => {
    const username = user.USERNAME || user.username || user.Username;
    if (username) {
      const option = document.createElement("option");
      option.value = username;
      option.textContent = username;
      if (
        defaultValue &&
        username.toLowerCase() === defaultValue.toLowerCase()
      ) {
        option.selected = true;
      }
      select.appendChild(option);
    }
  });
}

// Export for global use
window.Utils = {
  formatDisplayDate,
  formatDateForDisplay,
  formatDateForSheet,
  formatCurrency,
  formatPhoneNumber,
  showRefreshIndicator,
  hideRefreshIndicator,
  closeModalById,
  getColumnValue,
  getValueFromKeys,
  showTableMessage,
  getCityForCustomer,
  getAddressForCustomer,
  loadKasirDropdown,
};
