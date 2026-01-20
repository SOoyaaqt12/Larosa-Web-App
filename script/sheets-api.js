/**
 * Google Sheets API Client
 * Handles communication with Google Apps Script Web App
 */

// Use centralized API URL from config.js
const SHEETS_API_URL = API_URL;

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
 * @param {string} uniqueColumn - Optional: Column name to enforce uniqueness (e.g., 'NO HP')
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function addSheetRow(sheetName, rowData, uniqueColumn = null) {
  try {
    const payload = {
      sheet: sheetName,
      action: "add",
      data: rowData,
    };

    if (uniqueColumn) {
      payload.uniqueColumn = uniqueColumn;
    }

    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain", // Important for CORS with Apps Script
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.error) {
      // Don't throw for duplicate entry, just return result so frontend handles it
      if (result.error.includes("Duplicate entry")) {
        // This allows frontend to see the error message without catching strictly generic error
        // But throwing is also fine if caught.
        // Let's stick to throwing, but ensure message is clear
        throw new Error(result.error);
      }
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

/**
 * Delete an entire invoice group by Order Number
 * @param {string} sheetName - Name of the sheet
 * @param {string} noPesanan - The invoice number to delete
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function deleteInvoice(sheetName, noPesanan) {
  try {
    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        sheet: sheetName,
        action: "delete-invoice",
        data: {
          noPesanan: noPesanan,
        },
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("Error deleting invoice:", result.error);
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    throw error;
  }
}

/**
 * Increment customer transaction count by phone number
 * @param {string} phoneNumber - Customer phone number
 * @returns {Promise<{success: boolean, message: string, newCount?: number}>}
 */
async function incrementCustomerTransaction(phoneNumber) {
  try {
    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        action: "increment-transaction",
        phoneNumber: phoneNumber,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("Error incrementing transaction:", result.error);
      // Don't throw - this is a secondary operation, shouldn't block invoice save
      return result;
    }

    return result;
  } catch (error) {
    console.error("Failed to increment customer transaction:", error);
    // Don't throw - invoice save should still succeed even if this fails
    return { error: error.message };
  }
}
