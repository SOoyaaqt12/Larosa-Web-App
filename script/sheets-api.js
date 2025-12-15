/**
 * Sheets API Client for LarosaWebApp
 * This file handles all communication with the Google Apps Script Web App
 */

// IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL
const SHEETS_API_URL =
  "https://script.google.com/macros/s/AKfycbxnTuRKmf7IhNxkZO4UCPWYT7GLcFDgPLAvvv39bzk77xuY9S7oKecMDMpGgqV4iVk7/exec";

/**
 * Fetch data from a Google Sheet
 * @param {string} sheetName - Name of the sheet (e.g., 'PERSEDIAAN BARANG', 'KOSTUMER')
 * @returns {Promise<{headers: string[], data: object[]}>}
 */
async function fetchSheetData(sheetName) {
  try {
    const response = await fetch(
      `${SHEETS_API_URL}?sheet=${encodeURIComponent(sheetName)}&action=read`
    );
    const result = await response.json();

    if (result.error) {
      console.error("Error fetching data:", result.error);
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error("Failed to fetch sheet data:", error);
    throw error;
  }
}

/**
 * Add a new row to a Google Sheet
 * @param {string} sheetName - Name of the sheet
 * @param {object} rowData - Object with column headers as keys
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function addSheetRow(sheetName, rowData) {
  try {
    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain", // Important for CORS with Apps Script
      },
      body: JSON.stringify({
        sheet: sheetName,
        action: "add",
        data: rowData,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("Error adding row:", result.error);
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error("Failed to add row:", error);
    throw error;
  }
}

/**
 * Update a row in a Google Sheet
 * @param {string} sheetName - Name of the sheet
 * @param {number} rowIndex - The row number to update (1-indexed, including header)
 * @param {object} rowData - Object with column headers as keys
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateSheetRow(sheetName, rowIndex, rowData) {
  try {
    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        sheet: sheetName,
        action: "update",
        rowIndex: rowIndex,
        data: rowData,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("Error updating row:", result.error);
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error("Failed to update row:", error);
    throw error;
  }
}

/**
 * Delete a row from a Google Sheet
 * @param {string} sheetName - Name of the sheet
 * @param {number} rowIndex - The row number to delete (1-indexed, including header)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function deleteSheetRow(sheetName, rowIndex) {
  try {
    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        sheet: sheetName,
        action: "delete",
        rowIndex: rowIndex,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("Error deleting row:", result.error);
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error("Failed to delete row:", error);
    throw error;
  }
}
