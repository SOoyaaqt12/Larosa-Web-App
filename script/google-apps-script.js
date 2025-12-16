/**
 * Google Apps Script - LarosaWebApp API
 *
 * INSTRUKSI DEPLOYMENT:
 * 1. Buka Google Sheet Anda
 * 2. Pergi ke Extensions > Apps Script
 * 3. Buat file baru (jangan hapus kode lama)
 * 4. Paste kode ini ke file baru tersebut
 * 5. Klik Deploy > New deployment
 * 6. Pilih type: Web app
 * 7. Execute as: Me
 * 8. Who has access: Anyone
 * 9. Klik Deploy dan copy URL-nya
 */

const SHEET_ID = "1YQk8azd5gUXdQE9ZvD4hFsdqdG6UUrg2ZNf951dLfyY";

// Konfigurasi baris header untuk setiap sheet
// Sesuaikan angka ini dengan baris dimana header tabel Anda berada
const SHEET_CONFIG = {
  KOSTUMER: { headerRow: 5 },
  "PERSEDIAAN BARANG": { headerRow: 6 },
  USERS: { headerRow: 1 },
};

function doGet(e) {
  const sheet = e.parameter.sheet;
  const action = e.parameter.action || "read";

  if (action === "read") {
    return readSheet(sheet);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ error: "Invalid action" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = data.sheet;
  const action = data.action;
  const rowData = data.data;
  const rowIndex = data.rowIndex;

  let result;

  switch (action) {
    case "add":
      result = addRow(sheet, rowData);
      break;
    case "update":
      result = updateRow(sheet, rowIndex, rowData);
      break;
    case "delete":
      result = deleteRow(sheet, rowIndex);
      break;
    case "login":
      result = authenticateUser(data.username, data.password);
      break;
    default:
      result = { error: "Invalid action" };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Authenticate user against USERS sheet
 * @param {string} username
 * @param {string} password
 * @returns {object} - {success: boolean, message: string, user?: string}
 */
function authenticateUser(username, password) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName("USERS");

    if (!sheet) {
      return { success: false, message: "Sheet USERS tidak ditemukan" };
    }

    const config = SHEET_CONFIG["USERS"];
    const headerRow = config.headerRow;
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= headerRow) {
      return { success: false, message: "Tidak ada data user" };
    }

    // Get headers
    const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
    const usernameCol = headers.indexOf("USERNAME") + 1;
    const passwordCol = headers.indexOf("PASSWORD") + 1;

    if (usernameCol === 0 || passwordCol === 0) {
      return {
        success: false,
        message: "Kolom USERNAME atau PASSWORD tidak ditemukan",
      };
    }

    // Get all user data
    const dataStartRow = headerRow + 1;
    const numDataRows = lastRow - headerRow;
    const dataRange = sheet.getRange(dataStartRow, 1, numDataRows, lastCol);
    const dataValues = dataRange.getValues();

    // Find matching user
    for (let i = 0; i < dataValues.length; i++) {
      const row = dataValues[i];
      const rowUsername = String(row[usernameCol - 1]).trim();
      const rowPassword = String(row[passwordCol - 1]).trim();

      if (rowUsername === username.trim() && rowPassword === password) {
        return {
          success: true,
          message: "Login berhasil",
          user: rowUsername,
        };
      }
    }

    return { success: false, message: "Username atau password salah" };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function readSheet(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Sheet not found: " + sheetName })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Get configuration for this sheet
    const config = SHEET_CONFIG[sheetName] || { headerRow: 1 };
    const headerRow = config.headerRow;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < headerRow) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, headers: [], data: [] })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Get headers from the specified row
    const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];

    // Get data starting from the row after headers
    const dataStartRow = headerRow + 1;
    const numDataRows = lastRow - headerRow;

    if (numDataRows <= 0) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, headers: headers, data: [] })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const dataRange = sheet.getRange(dataStartRow, 1, numDataRows, lastCol);
    const dataValues = dataRange.getValues();

    const rows = dataValues
      .map((row, index) => {
        const obj = { _rowIndex: dataStartRow + index }; // Actual row number in sheet
        headers.forEach((header, i) => {
          if (header) {
            // Only include non-empty headers
            obj[header] = row[i];
          }
        });
        return obj;
      })
      .filter((row) => {
        // Filter out empty rows (rows where all data columns are empty)
        return Object.keys(row).some(
          (key) => key !== "_rowIndex" && row[key] !== "" && row[key] !== null
        );
      });

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        headers: headers.filter((h) => h),
        data: rows,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function addRow(sheetName, rowData) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: "Sheet not found: " + sheetName };
    }

    const config = SHEET_CONFIG[sheetName] || { headerRow: 1 };
    const headerRow = config.headerRow;

    const headers = sheet
      .getRange(headerRow, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // Build the new row based on headers
    const newRow = headers.map((header) => rowData[header] || "");

    // Find the last row with data in the data area (after header)
    const dataStartRow = headerRow + 1;
    const lastRow = sheet.getLastRow();

    // If there's no data yet, insert after header
    if (lastRow < dataStartRow) {
      sheet.insertRowAfter(headerRow);
      sheet.getRange(dataStartRow, 1, 1, newRow.length).setValues([newRow]);
      return { success: true, message: "Row added at row " + dataStartRow };
    }

    // Find last row with data by checking column A
    const dataRange = sheet.getRange(dataStartRow, 1, lastRow - headerRow, 1);
    const dataValues = dataRange.getValues();

    let lastDataRow = headerRow;
    for (let i = 0; i < dataValues.length; i++) {
      if (dataValues[i][0] !== "" && dataValues[i][0] !== null) {
        lastDataRow = dataStartRow + i;
      }
    }

    // Insert a NEW row after the last data row
    sheet.insertRowAfter(lastDataRow);
    const insertRow = lastDataRow + 1;

    // Now set the values in the newly inserted row
    sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

    return {
      success: true,
      message: "Row added successfully at row " + insertRow,
    };
  } catch (error) {
    return { error: error.toString() };
  }
}

function updateRow(sheetName, rowIndex, rowData) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: "Sheet not found: " + sheetName };
    }

    const config = SHEET_CONFIG[sheetName] || { headerRow: 1 };
    const headerRow = config.headerRow;

    const headers = sheet
      .getRange(headerRow, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // Get current row data first
    const currentRow = sheet
      .getRange(rowIndex, 1, 1, headers.length)
      .getValues()[0];

    // Update only the fields that are provided
    const updatedRow = headers.map((header, i) => {
      if (rowData.hasOwnProperty(header)) {
        return rowData[header];
      }
      return currentRow[i];
    });

    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);

    return { success: true, message: "Row updated successfully" };
  } catch (error) {
    return { error: error.toString() };
  }
}

function deleteRow(sheetName, rowIndex) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: "Sheet not found: " + sheetName };
    }

    sheet.deleteRow(rowIndex);

    return { success: true, message: "Row deleted successfully" };
  } catch (error) {
    return { error: error.toString() };
  }
}
