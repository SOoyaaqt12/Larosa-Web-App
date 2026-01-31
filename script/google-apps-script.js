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

const SHEET_ID = "1Cvvc4tIIcSoC7Q8f5Agau3OgYOIo0sdgUOZ0vsKVL6g";

// Konfigurasi baris header untuk setiap sheet
// Sesuaikan angka ini dengan baris dimana header tabel Anda berada
const SHEET_CONFIG = {
  KOSTUMER: { headerRow: 1, startColumn: 1 },
  "PERSEDIAAN BARANG": { headerRow: 1, startColumn: 1 },
  USERS: { headerRow: 1 },
  INCOME: { headerRow: 6, startColumn: 2, insertAtTop: true }, // Row 6, Col B
  VENDOR: { headerRow: 1, startColumn: 1 },
  "PO VENDOR": { headerRow: 1, startColumn: 1 },
  "KAS & BANK": { headerRow: 1, startColumn: 1 },
  OUTCOME: { headerRow: 1, startColumn: 1 },
  QUOTATION: { headerRow: 1, startColumn: 1 },
  RESTOCK: { headerRow: 1, startColumn: 1 },
  COUNTERS: { headerRow: 1 },
};

function doGet(e) {
  try {
    // Basic parameter check
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "No parameters provided" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = e.parameter.sheet;
    const action = e.parameter.action || "read";

    if (action === "read") {
      return readSheet(sheet);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ error: "Invalid action" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        error: "Server Error",
        detail: error.toString(),
        stack: error.stack,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // Parsing handling yang lebih aman
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Invalid JSON data", detail: err.toString() }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = data.sheet;
    const action = data.action;
    const rowData = data.data;
    const rowIndex = data.rowIndex;
    const uniqueColumn = data.uniqueColumn; // For unique constraint check

    let result;

    switch (action) {
      case "add":
        result = addRow(sheet, rowData, uniqueColumn);
        break;
      case "update":
        result = updateRow(sheet, rowIndex, rowData);
        break;
      case "delete":
        result = deleteRow(sheet, rowIndex);
        break;
      case "delete-invoice":
        result = deleteInvoice(sheet, rowData.noPesanan);
        break;
      case "increment-transaction":
        result = incrementCustomerTransaction(data.phoneNumber);
        break;
      case "login":
        result = authenticateUser(data.username, data.password);
        break;
      case "get-next-id":
        result = getNextIncrementalId(data.type, data.date);
        break;
      case "peek-next-id":
        result = peekNextId(data.type, data.date);
        break;
      default:
        result = { error: "Invalid action" };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    // This closing brace matches the 'try' at the start of doPost
    return ContentService.createTextOutput(
      JSON.stringify({
        error: "Server Process Error",
        detail: error.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
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
        JSON.stringify({ error: "Sheet not found: " + sheetName }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Get configuration for this sheet
    const config = SHEET_CONFIG[sheetName] || { headerRow: 1 };
    const headerRow = config.headerRow;
    const startColumn = config.startColumn || 1; // Default to column A

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const numDataCols = lastCol - startColumn + 1;

    if (lastRow < headerRow) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, headers: [], data: [] }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Get headers from the specified row and starting column
    const headers = sheet
      .getRange(headerRow, startColumn, 1, numDataCols)
      .getValues()[0]
      .filter((h) => h !== "");

    // Get data starting from the row after headers
    const dataStartRow = headerRow + 1;
    const numDataRows = lastRow - headerRow;

    if (numDataRows <= 0) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, headers: headers, data: [] }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const dataRange = sheet.getRange(
      dataStartRow,
      startColumn,
      numDataRows,
      numDataCols,
    );
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
          (key) => key !== "_rowIndex" && row[key] !== "" && row[key] !== null,
        );
      });

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        headers: headers.filter((h) => h),
        data: rows,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Apply formatting to a newly inserted row
 * Background: transparent, Font: black, Size: 12, Alignment based on column type
 */
function applyRowFormatting(sheet, rowNum, startColumn, headers) {
  const numCols = headers.length;
  const rowRange = sheet.getRange(rowNum, startColumn, 1, numCols);

  // Reset formatting
  rowRange.setBackground(null);
  rowRange.setFontWeight("normal");
  rowRange.setFontColor("#000000");
  rowRange.setFontSize(12);

  // Center alignment for specific columns
  const centerAlignColumns = ["JUMLAH TRANSAKSI", "JUMLAH\nTRANSAKSI"];
  centerAlignColumns.forEach(function (colName) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet
        .getRange(rowNum, colIndex + startColumn)
        .setHorizontalAlignment("center");
    }
  });

  // Right alignment for numeric columns
  const rightAlignColumns = [
    "JUMLAH",
    "HARGA",
    "TOTAL",
    "SUB TOTAL",
    "ONGKIR",
    "PACKING",
    "DISKON",
    "TOTAL TAGIHAN",
    "DP 1",
    "DP 2",
    "SISA TAGIHAN",
    "STOK SISTEM",
    "RESTOCK",
    "TERJUAL",
    "STOK AKTUAL",
    "HPP",
    "HARGA JUAL",
  ];
  rightAlignColumns.forEach(function (colName) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet
        .getRange(rowNum, colIndex + startColumn)
        .setHorizontalAlignment("right");
    }
  });

  // Left alignment for text columns
  const leftAlignColumns = [
    "TANGGAL",
    "NAMA PELANGGAN",
    "NAMA\nPELANGGAN",
    "NO HP",
    "NO\nHP",
    "ALAMAT",
    "KOTA",
    "CHANNEL",
    "KATEGORI",
    "SKU",
    "PRODUK",
    "Pelunasan",
    "NAMA PRODUK",
  ];
  leftAlignColumns.forEach(function (colName) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet
        .getRange(rowNum, colIndex + startColumn)
        .setHorizontalAlignment("left");
    }
  });
}

function addRow(sheetName, rowData, uniqueColumn = null) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: "Sheet not found: " + sheetName };
    }

    const config = SHEET_CONFIG[sheetName] || { headerRow: 1 };
    const headerRow = config.headerRow;
    const insertAtTop = config.insertAtTop || false;
    const startColumn = config.startColumn || 1; // Default to column A

    const headers = sheet
      .getRange(
        headerRow,
        startColumn,
        1,
        sheet.getLastColumn() - startColumn + 1,
      )
      .getValues()[0]
      .filter((h) => h !== ""); // Remove empty headers

    // Check uniqueness if requested
    if (uniqueColumn) {
      // Find header case-insensitively
      const uniqueColIndex = headers.findIndex(
        (h) => h && h.toString().toUpperCase() === uniqueColumn.toUpperCase(),
      );

      if (uniqueColIndex === -1) {
        return {
          error: "Unique column '" + uniqueColumn + "' not found in headers",
        };
      }

      const lastRow = sheet.getLastRow();
      const dataStartRow = headerRow + 1;

      if (lastRow >= dataStartRow) {
        const columnValues = sheet
          .getRange(dataStartRow, uniqueColIndex + 1, lastRow - headerRow, 1)
          .getValues();
        const newValue = rowData[uniqueColumn];

        const exists = columnValues.some((row) => {
          let val = row[0];
          if (val === null || val === undefined) val = "";
          val = String(val).trim().toLowerCase();

          let checkVal = newValue;
          if (checkVal === null || checkVal === undefined) checkVal = "";
          checkVal = String(checkVal).trim().toLowerCase();

          return val === checkVal && val !== "";
        });

        if (exists) {
          return {
            error:
              "Duplicate entry: " +
              uniqueColumn +
              " '" +
              newValue +
              "' already exists.",
          };
        }
      }
    }

    // Build the new row based on headers
    const newRow = headers.map((header) => rowData[header] || "");

    // Data starts right after header
    const dataStartRow = headerRow + 1;

    if (insertAtTop) {
      // Insert at TOP: right after header row
      sheet.insertRowAfter(headerRow);
      const newRowRange = sheet.getRange(
        dataStartRow,
        startColumn,
        1,
        newRow.length,
      );
      newRowRange.setValues([newRow]);

      // Apply formatting using helper function
      applyRowFormatting(sheet, dataStartRow, startColumn, headers);

      return {
        success: true,
        message: "Row inserted at top (row " + dataStartRow + ")",
      };
    } else {
      // Original behavior: append at bottom
      const lastRow = sheet.getLastRow();

      // If there's no data yet, insert after header
      if (lastRow < dataStartRow) {
        sheet.insertRowAfter(headerRow);
        const newRowRange = sheet.getRange(
          dataStartRow,
          startColumn,
          1,
          newRow.length,
        );
        newRowRange.setValues([newRow]);
        applyRowFormatting(sheet, dataStartRow, startColumn, headers);
        return { success: true, message: "Row added at row " + dataStartRow };
      }

      // Find last row with data by checking first column
      const dataRange = sheet.getRange(
        dataStartRow,
        startColumn,
        lastRow - headerRow,
        1,
      );
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
      const newRowRange = sheet.getRange(
        insertRow,
        startColumn,
        1,
        newRow.length,
      );
      newRowRange.setValues([newRow]);

      // Apply formatting
      applyRowFormatting(sheet, insertRow, startColumn, headers);

      return {
        success: true,
        message: "Row added successfully at row " + insertRow,
      };
    }
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

function deleteInvoice(sheetName, noPesanan) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { error: "Sheet not found: " + sheetName };
    }

    const config = SHEET_CONFIG[sheetName] || { headerRow: 1 };
    const headerRow = config.headerRow;

    // Find invoice/order number column - different sheets use different column names
    const headers = sheet
      .getRange(headerRow, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // Try multiple possible column names for invoice/order number
    const possibleColumnNames = ["INVOICE", "NO'PESANAN", "NO PESANAN"];
    let noPesananCol = -1;
    let foundColumnName = "";

    for (const colName of possibleColumnNames) {
      const colIndex = headers.indexOf(colName);
      if (colIndex !== -1) {
        noPesananCol = colIndex;
        foundColumnName = colName;
        break;
      }
    }

    if (noPesananCol === -1) {
      return {
        error:
          "Column for order number not found. Tried: " +
          possibleColumnNames.join(", "),
      };
    }

    const lastRow = sheet.getLastRow();
    const dataStartRow = headerRow + 1;

    if (lastRow < dataStartRow) {
      return { success: true, message: "No data to delete" };
    }

    // Get all data
    const dataRange = sheet.getRange(
      dataStartRow,
      1,
      lastRow - headerRow,
      sheet.getLastColumn(),
    );
    const dataValues = dataRange.getValues();

    // Find rows belonging to this invoice
    // Logic: Find the row with matching NO PESANAN, then include all subsequent rows
    // that have EMPTY NO PESANAN (until we hit a row with a different NO PESANAN)
    const rowsToDelete = [];
    let isInTargetInvoice = false;

    for (let i = 0; i < dataValues.length; i++) {
      const rowNoPesanan = String(dataValues[i][noPesananCol]).trim();

      if (rowNoPesanan === String(noPesanan).trim()) {
        // Found the start of target invoice
        isInTargetInvoice = true;
        rowsToDelete.push(dataStartRow + i);
      } else if (isInTargetInvoice) {
        // We're in the target invoice - check if this row belongs to it
        if (rowNoPesanan === "" || rowNoPesanan === "undefined") {
          // Empty NO PESANAN means it's a continuation of the previous invoice
          rowsToDelete.push(dataStartRow + i);
        } else {
          // New invoice started, stop collecting
          isInTargetInvoice = false;
        }
      }
    }

    // Delete rows from bottom to top to avoid index shifting issues
    rowsToDelete.sort((a, b) => b - a);

    for (const rowIndex of rowsToDelete) {
      sheet.deleteRow(rowIndex);
    }

    return {
      success: true,
      message: `Deleted ${rowsToDelete.length} rows for invoice ${noPesanan}`,
    };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Increment customer transaction count by phone number
 * @param {string} phoneNumber - Customer phone number
 * @returns {object} - {success: boolean, message: string} or {error: string}
 */
function incrementCustomerTransaction(phoneNumber) {
  try {
    const sheetName = "KOSTUMER";
    const config = SHEET_CONFIG[sheetName];
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      return { error: "KOSTUMER sheet not found" };
    }

    const headerRow = config.headerRow;
    const headers = sheet
      .getRange(headerRow, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // Find NO HP column (case-insensitive)
    const phoneColIndex = headers.findIndex(
      (h) =>
        h && h.toString().toUpperCase().replace(/\n/g, " ").includes("NO HP"),
    );

    if (phoneColIndex === -1) {
      return { error: "NO HP column not found in KOSTUMER sheet" };
    }

    // Find JUMLAH TRANSAKSI column (case-insensitive)
    const txColIndex = headers.findIndex(
      (h) =>
        h &&
        h.toString().toUpperCase().replace(/\n/g, " ").includes("JUMLAH") &&
        h.toString().toUpperCase().replace(/\n/g, " ").includes("TRANSAKSI"),
    );

    if (txColIndex === -1) {
      return { error: "JUMLAH TRANSAKSI column not found in KOSTUMER sheet" };
    }

    // Find customer row by phone number
    const lastRow = sheet.getLastRow();
    const dataStartRow = headerRow + 1;

    if (lastRow < dataStartRow) {
      return { error: "No customer data found" };
    }

    const phoneData = sheet
      .getRange(dataStartRow, phoneColIndex + 1, lastRow - headerRow, 1)
      .getValues();
    const normalizedInput = String(phoneNumber).trim().toLowerCase();

    let customerRowIndex = -1;
    for (let i = 0; i < phoneData.length; i++) {
      const cellValue = String(phoneData[i][0]).trim().toLowerCase();
      if (cellValue === normalizedInput) {
        customerRowIndex = dataStartRow + i;
        break;
      }
    }

    if (customerRowIndex === -1) {
      return { error: "Customer with phone " + phoneNumber + " not found" };
    }

    // Get current transaction count and increment
    const currentValue = sheet
      .getRange(customerRowIndex, txColIndex + 1)
      .getValue();
    const currentCount = parseInt(currentValue) || 0;
    const newCount = currentCount + 1;

    // Update the cell
    sheet.getRange(customerRowIndex, txColIndex + 1).setValue(newCount);

    return {
      success: true,
      message: `Customer transaction count updated to ${newCount}`,
      newCount: newCount,
    };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Get the next sequential ID for a specific date and type
 * Uses LockService to prevent collisions in multi-user environment
 * @param {string} type - 'INV' or 'QT'
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {object} - {success: true, id: "LR/INV/01/300126", count: 1}
 */
function getNextIncrementalId(type, dateStr) {
  const lock = LockService.getScriptLock();
  try {
    // Wait for up to 30 seconds for the lock
    lock.waitLock(30000);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName("COUNTERS");

    // Create COUNTERS sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet("COUNTERS");
      sheet.appendRow(["DATE", "TYPE", "COUNT"]);
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Search for existing counter for this date and type
    for (let i = 1; i < data.length; i++) {
      let cellDate = data[i][0];
      if (cellDate instanceof Date) {
        // Convert to YYYY-MM-DD string to match input
        const y = cellDate.getFullYear();
        const m = String(cellDate.getMonth() + 1).padStart(2, "0");
        const d = String(cellDate.getDate()).padStart(2, "0");
        cellDate = `${y}-${m}-${d}`;
      }

      if (String(cellDate) === String(dateStr) && data[i][1] === type) {
        rowIndex = i + 1;
        break;
      }
    }

    let count = 1;
    if (rowIndex !== -1) {
      count = parseInt(data[rowIndex - 1][2]) + 1;
      sheet.getRange(rowIndex, 3).setValue(count);
    } else {
      sheet.appendRow([dateStr, type, count]);
    }

    // Format ID: LR / TYPE / PADDED_COUNT / DDMMYY
    const dateParts = dateStr.split("-"); // YYYY, MM, DD
    const year = dateParts[0].slice(-2);
    const month = dateParts[1];
    const day = dateParts[2];
    const orderNumPadded = String(count).padStart(2, "0");

    // Standardize prefixes: INV -> LR/INV, QT -> LR/QT
    const prefix = type === "INV" ? "LR/INV" : "LR/QT";
    const formattedId = `${prefix}/${orderNumPadded}/${day}${month}${year}`;

    return {
      success: true,
      id: formattedId,
      count: count,
    };
  } catch (error) {
    return { error: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Peek at the next sequential ID without incrementing (for preview)
 * @param {string} type - 'INV' or 'QT'
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {object} - {success: true, id: "LR/INV/01/300126", count: 1}
 */
function peekNextId(type, dateStr) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName("COUNTERS");

    // Default to 1 if sheet doesn't exist
    if (!sheet) {
      const dateParts = dateStr.split("-");
      const year = dateParts[0].slice(-2);
      const month = dateParts[1];
      const day = dateParts[2];
      const prefix = type === "INV" ? "LR/INV" : "LR/QT";
      return {
        success: true,
        id: `${prefix}/01/${day}${month}${year}`,
        count: 1,
      };
    }

    const data = sheet.getDataRange().getValues();
    let currentCount = 0;

    // Search for existing counter for this date and type
    for (let i = 1; i < data.length; i++) {
      let cellDate = data[i][0];
      if (cellDate instanceof Date) {
        const y = cellDate.getFullYear();
        const m = String(cellDate.getMonth() + 1).padStart(2, "0");
        const d = String(cellDate.getDate()).padStart(2, "0");
        cellDate = `${y}-${m}-${d}`;
      }

      if (String(cellDate) === String(dateStr) && data[i][1] === type) {
        currentCount = parseInt(data[i][2]) || 0;
        break;
      }
    }

    const nextCount = currentCount + 1;

    // Format ID
    const dateParts = dateStr.split("-");
    const year = dateParts[0].slice(-2);
    const month = dateParts[1];
    const day = dateParts[2];
    const orderNumPadded = String(nextCount).padStart(2, "0");
    const prefix = type === "INV" ? "LR/INV" : "LR/QT";
    const formattedId = `${prefix}/${orderNumPadded}/${day}${month}${year}`;

    return {
      success: true,
      id: formattedId,
      count: nextCount,
    };
  } catch (error) {
    return { error: error.toString() };
  }
}
