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
      `<span id="${indicatorId}" style="font-size: 12px; color: #888; margin-left: 10px;">${message}</span>`
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
  treatEmptyAsDefault = false
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

// Export for global use
window.Utils = {
  formatDisplayDate,
  formatDateForSheet,
  formatCurrency,
  formatPhoneNumber,
  showRefreshIndicator,
  hideRefreshIndicator,
  closeModalById,
  getColumnValue,
  getValueFromKeys,
  showTableMessage,
};
