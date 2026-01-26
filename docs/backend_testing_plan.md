# Backend Testing Plan - LarosaWebApp (Google Apps Script API)

## Overview

This document provides detailed test cases for the Google Apps Script backend API. Tests can be executed using:

1. **Browser Console** - Using `fetch()` directly
2. **Postman/Insomnia** - For manual API testing
3. **Google Apps Script Editor** - Using the built-in debugger

**API URL:** `https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec`

---

## 1. READ Operations (doGet)

### 1.1 Read Sheet Data

| ID     | Test Case               | Request                                      | Expected Response                              |
| ------ | ----------------------- | -------------------------------------------- | ---------------------------------------------- |
| BE-R01 | Read KOSTUMER sheet     | `GET ?sheet=KOSTUMER&action=read`            | `{success: true, headers: [...], data: [...]}` |
| BE-R02 | Read PERSEDIAAN BARANG  | `GET ?sheet=PERSEDIAAN%20BARANG&action=read` | Returns product list with correct headers      |
| BE-R03 | Read non-existent sheet | `GET ?sheet=INVALID_SHEET`                   | `{error: "Sheet not found: INVALID_SHEET"}`    |
| BE-R04 | Read with empty sheet   | `GET ?sheet=EMPTY_SHEET`                     | `{success: true, headers: [...], data: []}`    |
| BE-R05 | Read INVOICE sheet      | `GET ?sheet=INVOICE`                         | Returns invoice data starting from row 49      |
| BE-R06 | Read VENDOR sheet       | `GET ?sheet=VENDOR`                          | Returns vendor list                            |

---

## 2. WRITE Operations (doPost - action: "add")

### 2.1 Add Row - Standard

| ID     | Test Case        | Request Body                                            | Expected Response                                    |
| ------ | ---------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| BE-A01 | Add new customer | `{action:"add", sheet:"KOSTUMER", data:{...}}`          | `{success: true, message: "Row inserted at top..."}` |
| BE-A02 | Add new product  | `{action:"add", sheet:"PERSEDIAAN BARANG", data:{...}}` | Row added at bottom of data                          |
| BE-A03 | Add new vendor   | `{action:"add", sheet:"VENDOR", data:{...}}`            | `{success: true}`                                    |

### 2.2 Add Row - With Unique Constraint

| ID     | Test Case                      | Request Body                                                                         | Expected Response               |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------- |
| BE-A04 | Add user - unique username     | `{action:"add", sheet:"USERS", data:{USERNAME:"new"}, uniqueColumn:"USERNAME"}`      | `{success: true}`               |
| BE-A05 | Add user - duplicate username  | `{action:"add", sheet:"USERS", data:{USERNAME:"existing"}, uniqueColumn:"USERNAME"}` | `{error: "Duplicate entry..."}` |
| BE-A06 | Add customer - duplicate phone | `{action:"add", sheet:"KOSTUMER", data:{"NO HP":"existing"}, uniqueColumn:"NO HP"}`  | `{error: "Duplicate entry..."}` |

### 2.3 Add Row - Edge Cases

| ID     | Test Case             | Request Body                                             | Expected Response                        |
| ------ | --------------------- | -------------------------------------------------------- | ---------------------------------------- |
| BE-A07 | Add with empty data   | `{action:"add", sheet:"KOSTUMER", data:{}}`              | Row added with empty values              |
| BE-A08 | Add with extra fields | `{action:"add", sheet:"VENDOR", data:{EXTRA_FIELD:"x"}}` | Extra fields ignored, valid fields saved |
| BE-A09 | Add to invalid sheet  | `{action:"add", sheet:"INVALID"}`                        | `{error: "Sheet not found..."}`          |

---

## 3. UPDATE Operations (doPost - action: "update")

| ID     | Test Case               | Request Body                                                                          | Expected Response                              |
| ------ | ----------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| BE-U01 | Update customer name    | `{action:"update", sheet:"KOSTUMER", rowIndex:6, data:{"NAMA PELANGGAN":"New Name"}}` | `{success: true}`                              |
| BE-U02 | Update product price    | `{action:"update", sheet:"PERSEDIAAN BARANG", rowIndex:7, data:{"HARGA JUAL":50000}}` | Price updated in sheet                         |
| BE-U03 | Update with invalid row | `{action:"update", sheet:"KOSTUMER", rowIndex:99999, data:{...}}`                     | Error or no change                             |
| BE-U04 | Partial update          | `{action:"update", sheet:"VENDOR", rowIndex:6, data:{"ALAMAT":"New Address"}}`        | Only specified field changes, others preserved |

---

## 4. DELETE Operations

### 4.1 Single Row Delete (doPost - action: "delete")

| ID     | Test Case           | Request Body                                               | Expected Response              |
| ------ | ------------------- | ---------------------------------------------------------- | ------------------------------ |
| BE-D01 | Delete customer row | `{action:"delete", sheet:"KOSTUMER", rowIndex:6}`          | `{success: true}`              |
| BE-D02 | Delete product row  | `{action:"delete", sheet:"PERSEDIAAN BARANG", rowIndex:7}` | Row removed from sheet         |
| BE-D03 | Delete invalid row  | `{action:"delete", sheet:"VENDOR", rowIndex:1}`            | May delete header (edge case!) |

### 4.2 Invoice Delete (doPost - action: "delete-invoice")

| ID     | Test Case                   | Request Body                                                                      | Expected Response                               |
| ------ | --------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| BE-D04 | Delete invoice with 1 item  | `{action:"delete-invoice", sheet:"INVOICE", data:{noPesanan:"LR/INV/01/220126"}}` | 1 row deleted                                   |
| BE-D05 | Delete invoice with 5 items | `{action:"delete-invoice", sheet:"INVOICE", data:{noPesanan:"LR/INV/02/220126"}}` | `{success: true, message: "Deleted 5 rows..."}` |
| BE-D06 | Delete non-existent invoice | `{action:"delete-invoice", sheet:"INVOICE", data:{noPesanan:"INVALID"}}`          | `{success: true, message: "Deleted 0 rows..."}` |
| BE-D07 | Delete quotation            | `{action:"delete-invoice", sheet:"QUOTATION", data:{noPesanan:"LR/QT/01/..."}}`   | Works with QUOTATION sheet too                  |

---

## 5. AUTHENTICATION (doPost - action: "login")

| ID     | Test Case               | Request Body                                             | Expected Response                                           |
| ------ | ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| BE-L01 | Login valid credentials | `{action:"login", username:"admin", password:"correct"}` | `{success: true, user: "admin"}`                            |
| BE-L02 | Login wrong password    | `{action:"login", username:"admin", password:"wrong"}`   | `{success: false, message: "Username atau password salah"}` |
| BE-L03 | Login non-existent user | `{action:"login", username:"nobody", password:"x"}`      | `{success: false, message: "Username atau password salah"}` |
| BE-L04 | Login empty credentials | `{action:"login", username:"", password:""}`             | `{success: false}`                                          |
| BE-L05 | Login case sensitivity  | `{action:"login", username:"ADMIN", password:"..."}`     | Check if case-sensitive                                     |

---

## 6. SPECIAL ACTIONS

### 6.1 Increment Transaction (doPost - action: "increment-transaction")

| ID     | Test Case                       | Request Body                                                    | Expected Response                              |
| ------ | ------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| BE-T01 | Increment existing customer     | `{action:"increment-transaction", phoneNumber:"6281234567890"}` | `{success: true, newCount: N+1}`               |
| BE-T02 | Increment non-existent phone    | `{action:"increment-transaction", phoneNumber:"0000000000"}`    | `{error: "Customer with phone ... not found"}` |
| BE-T03 | Increment with different format | `{action:"increment-transaction", phoneNumber:"081234567890"}`  | Should normalize and find customer             |

---

## 7. ERROR HANDLING & EDGE CASES

| ID     | Test Case                | Request                     | Expected Response              |
| ------ | ------------------------ | --------------------------- | ------------------------------ |
| BE-E01 | Invalid JSON body        | POST with `{invalid json}`  | `{error: "Invalid JSON data"}` |
| BE-E02 | Missing action parameter | `{sheet:"KOSTUMER"}`        | `{error: "Invalid action"}`    |
| BE-E03 | Empty POST body          | POST with empty body        | `{error: "Invalid JSON data"}` |
| BE-E04 | Invalid action name      | `{action:"invalid_action"}` | `{error: "Invalid action"}`    |

---

## 8. DATA INTEGRITY CHECKS

| ID     | Test Case                   | Verification Method                                  |
| ------ | --------------------------- | ---------------------------------------------------- |
| BE-I01 | Row formatting after add    | Open Sheet → Check font size = 12, alignment correct |
| BE-I02 | Header row protection       | Add row should not overwrite header                  |
| BE-I03 | Data ordering (insertAtTop) | New customer appears at top, new product at bottom   |
| BE-I04 | Column mapping              | All fields map to correct columns                    |
| BE-I05 | Empty row filtering         | Read should skip empty rows                          |

---

## Test Execution Commands

### Using Browser Console (F12)

```javascript
// Example: Read customers
fetch("https://script.google.com/macros/s/[ID]/exec?sheet=KOSTUMER&action=read")
  .then((r) => r.json())
  .then(console.log);

// Example: Add customer
fetch("https://script.google.com/macros/s/[ID]/exec", {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: JSON.stringify({
    action: "add",
    sheet: "KOSTUMER",
    data: {
      TANGGAL: "2026-01-23",
      "NAMA PELANGGAN": "Test",
      "NO HP": "0812345",
    },
  }),
})
  .then((r) => r.json())
  .then(console.log);
```

### Using Google Apps Script Editor

1. Open Apps Script Editor
2. Add test function:

```javascript
function testAddCustomer() {
  const result = addRow("KOSTUMER", { "NAMA PELANGGAN": "Test" });
  Logger.log(result);
}
```

3. Run and check Logs (View → Logs)
