/**
 * Pelunasan Page - Google Sheets Integration
 * Connects to INCOME sheet (Filtered for DP)
 */

const pelunasanService = DataServices.pelunasan;

let groupedInvoices = { map: {}, order: [] };

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

  return str;
}

document.addEventListener("DOMContentLoaded", () => {
  loadPelunasanData();
});

async function loadPelunasanData() {
  const tableBody = document.querySelector("tbody");
  if (!tableBody) return;

  groupedInvoices = await pelunasanService.loadGroupedData({
    tbody: tableBody,
    onRender: renderTable,
    groupFn: groupDataByOrder,
  });

  setupSearch();
}

/**
 * Filter Management
 */
function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (!searchTerm) {
      renderTable({ map: groupedInvoices.map, order: groupedInvoices.order });
      return;
    }

    const keywords = searchTerm.split(/\s+/);
    const filteredOrder = groupedInvoices.order.filter((noPesanan) => {
      const rows = groupedInvoices.map[noPesanan];
      if (!rows || rows.length === 0) return false;
      const mainRow = rows[0];

      const nama = (
        mainRow["NAME"] ||
        mainRow["NAMA PELANGGAN"] ||
        ""
      ).toLowerCase();
      const city = (
        mainRow["CITY"] ||
        mainRow["Kota"] ||
        mainRow["KOTA"] ||
        ""
      ).toLowerCase();
      const searchSource = `${noPesanan.toLowerCase()} ${nama} ${city}`;

      return keywords.every((kw) => searchSource.includes(kw));
    });

    renderTable({ map: groupedInvoices.map, order: filteredOrder });
  });
}

/**
 * Group raw sheet data by Invoice Number (Only DP)
 */
function groupDataByOrder(data) {
  const groups = {};
  const orderedGroups = [];

  const invoiceKeys = ["NO PESANAN", "NO INVOICE", "INVOICE"];

  data.forEach((row) => {
    // Only show "DP" (Down Payment) in Pelunasan
    if (
      row["DP/FP"] !== "DP" &&
      row["TRANSACTION"] !== "DP" &&
      row["TRANSAKSI"] !== "DP"
    )
      return;

    let noPesanan = null;
    for (const key of invoiceKeys) {
      if (row[key]) {
        noPesanan = row[key];
        break;
      }
    }

    if (noPesanan) {
      if (!groups[noPesanan]) {
        groups[noPesanan] = [];
        orderedGroups.push(noPesanan);
      }
      groups[noPesanan].push(row);
    }
  });

  return { map: groups, order: orderedGroups };
}

/**
 * Render the table rows
 */
function renderTable(groupedData) {
  const tableBody = document.querySelector("tbody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const { map, order } = groupedData;

  if (order.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" style="text-align:center; padding: 20px;">Tidak ada transaksi yang perlu dilunasi.</td>`;
    tableBody.appendChild(tr);
    return;
  }

  order.forEach((noPesanan, index) => {
    const rows = map[noPesanan];
    const main = rows[0];

    const date = main["DATE"] || main["TANGGAL"];
    const name = main["NAME"] || main["NAMA PELANGGAN"] || "";
    const sisa =
      parseFloat(main["REMAINING BALANCE"] || main["SISA TAGIHAN"]) || 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>${noPesanan}</td>
      <td>
        <div style="font-weight:bold;">${name}</div>
        <div style="font-size: 0.85em; color: #666;">${formatDateForDisplay(date)}</div>
      </td>
      <td>
         <div style="font-weight:bold;">Rp${sisa.toLocaleString("id-ID")}</div>
         <div style="margin-top: 4px;"><span class="badge status-dp">DP</span></div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-lihat" onclick="viewInvoicePelunasan('${noPesanan}')">Lihat</button>
          <button class="btn-edit" onclick="editInvoicePelunasan('${noPesanan}')" style="background-color: #ff9800;">Edit</button>
          <button class="btn-delete" onclick="deleteInvoiceAction('${noPesanan}')">Hapus</button>
          <button class="btn-lihat" style="background-color: #4CAF50;" onclick="bayarInvoice('${noPesanan}')">Pelunasan</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Helper to parse SKU and Product Name from row data
 * Handles cases where SKU is merged into Product Name like "[SKU] Product Name"
 */
function parseItemRow(r) {
  let sku = r["SKU"] || "";
  let produk = r["PRODUK"] || r["ITEM PRODUCT"] || "";

  // If SKU is empty, try to extract from Product Name
  if (!sku && produk.startsWith("[")) {
    const match = produk.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      sku = match[1];
      produk = match[2];
    }
  }

  // If Product Name still has [SKU] prefix even if SKU col exists, clean it
  if (produk.startsWith("[")) {
    const match = produk.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      produk = match[2];
    }
  }

  return { sku, produk };
}

/**
 * Bayar / Pelunasan
 */
async function bayarInvoice(orderNo) {
  const rows = groupedInvoices.map[orderNo];
  if (!rows) return;

  const main = rows[0];
  const name = main["NAME"] || main["NAMA PELANGGAN"];
  const phone = main["HP"] || main["NO HP"];

  let address = main["ALAMAT"] || "";
  if (window.Utils && window.Utils.getAddressForCustomer) {
    const found = await window.Utils.getAddressForCustomer(name, phone);
    if (found) address = found;
  }

  const data = {
    info: {
      noPesanan: orderNo,
      tanggal: main["DATE"] || main["TANGGAL"],
      kasir: main["CASHIER"] || main["KASIR"],
      transaksi: main["TRANSACTION"] || main["TRANSAKSI"] || "DP",
      payment: main["PAYMENT"],
      roPo: main["RO/PO"] || "",
    },
    customer: {
      nama: name,
      noHp: phone,
      alamat: address,
      city: main["CITY"] || main["Kota"] || main.KOTA,
    },
    items: rows.map((r) => {
      const { sku, produk } = parseItemRow(r);
      return {
        sku: sku,
        produk: produk, // form_pelunasan.js uses .produk
        jumlah: parseFloat(r["QTY"] || r["JUMLAH"]) || 0, // form_pelunasan.js uses .jumlah
        satuan: r["SATUAN"] || "Pcs",
        harga: parseFloat(r["PRICE/ITEM"] || r["HARGA"]) || 0,
        total: parseFloat(r["ITEM*QTY"] || r["TOTAL"]) || 0,
        kategori: r["CATEGORY"] || r["KATEGORI"] || "",
      };
    }),
    summary: {
      subtotal: parseFloat(main["SUBTOTAL ITEM"] || main["SUB TOTAL"]) || 0,
      ongkir: parseFloat(main["DELIVERY"] || main["ONGKIR"]) || 0,
      packing: parseFloat(main["PACKING"]) || 0,
      diskon: parseFloat(main["DISCOUNT"] || main["DISKON"]) || 0,
      totalTagihan:
        parseFloat(main["GRAND TOTAL"] || main["TOTAL TAGIHAN"]) || 0,
      dp1: parseFloat(main["DP 1"] || main["TOTAL DP/FP"]) || 0,
      dp2: parseFloat(main["DP 2"]) || 0,
      sisaTagihan:
        parseFloat(main["REMAINING BALANCE"] || main["SISA TAGIHAN"]) || 0,
    },
    totalBayar:
      (parseFloat(main["DP 1"] || main["TOTAL DP/FP"]) || 0) +
      (parseFloat(main["DP 2"]) || 0),
  };

  sessionStorage.setItem("pelunasanInvoiceData", JSON.stringify(data));
  window.location.href = "form_pelunasan.html";
}

/**
 * View Invoice Detail (DP)
 */
async function viewInvoicePelunasan(orderNo) {
  const rows = groupedInvoices.map[orderNo];
  if (!rows) return;

  const main = rows[0];
  const name = main["NAME"] || main["NAMA PELANGGAN"];
  const phone = main["HP"] || main["NO HP"];

  let address = main["ALAMAT"] || "";
  if (window.Utils && window.Utils.getAddressForCustomer) {
    const found = await window.Utils.getAddressForCustomer(name, phone);
    if (found) address = found;
  }

  const data = {
    info: {
      noPesanan: orderNo,
      tanggal: main["DATE"] || main["TANGGAL"],
      kasir: main["CASHIER"] || main["KASIR"],
      transaksi: main["TRANSACTION"] || main["TRANSAKSI"] || "DP",
      payment: main["PAYMENT"],
      roPo: main["RO/PO"] || "",
    },
    customer: {
      nama: name,
      noHp: phone,
      alamat: address,
      city: main["CITY"] || main["Kota"] || main.KOTA,
    },
    items: rows.map((r) => {
      const { sku, produk } = parseItemRow(r);
      return {
        sku: sku,
        produk: produk,
        qty: parseFloat(r["QTY"] || r["JUMLAH"]) || 0,
        jumlah: parseFloat(r["QTY"] || r["JUMLAH"]) || 0, // invoice_dp.js might check jumlah
        satuan: r["SATUAN"] || "Pcs",
        harga: parseFloat(r["PRICE/ITEM"] || r["HARGA"]) || 0,
        total: parseFloat(r["ITEM*QTY"] || r["TOTAL"]) || 0,
      };
    }),
    summary: {
      subtotal: parseFloat(main["SUBTOTAL ITEM"] || main["SUB TOTAL"]) || 0,
      ongkir: parseFloat(main["DELIVERY"] || main["ONGKIR"]) || 0,
      packing: parseFloat(main["PACKING"]) || 0,
      diskon: parseFloat(main["DISCOUNT"] || main["DISKON"]) || 0,
      totalTagihan:
        parseFloat(main["GRAND TOTAL"] || main["TOTAL TAGIHAN"]) || 0,
      dp1: parseFloat(main["DP 1"] || main["TOTAL DP/FP"]) || 0,
      dp2: parseFloat(main["DP 2"]) || 0,
      sisaTagihan:
        parseFloat(main["REMAINING BALANCE"] || main["SISA TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("invoiceData", JSON.stringify(data));
  window.location.href = "invoice_dp.html";
}

/**
 * Edit Invoice (DP)
 */
async function editInvoicePelunasan(orderNo) {
  const rows = groupedInvoices.map[orderNo];
  if (!rows) return;

  const main = rows[0];
  const name = main["NAME"] || main["NAMA PELANGGAN"];
  const phone = main["HP"] || main["NO HP"];

  let address = main["ALAMAT"] || "";
  if (window.Utils && window.Utils.getAddressForCustomer) {
    const found = await window.Utils.getAddressForCustomer(name, phone);
    if (found) address = found;
  }

  const editData = {
    info: {
      noPesanan: orderNo,
      tanggal: main["DATE"] || main["TANGGAL"],
      kasir: main["CASHIER"] || main["KASIR"],
      transaksi: main["TRANSACTION"] || main["TRANSAKSI"] || "DP",
      payment: main["PAYMENT"],
      roPo: main["RO/PO"] || "",
    },
    customer: {
      nama: name,
      noHp: phone,
      alamat: address,
      city: main["CITY"] || main["Kota"] || main.KOTA,
      channel: main["CHANNEL"],
    },
    items: rows.map((r) => {
      const { sku, produk } = parseItemRow(r);
      return {
        sku: sku,
        produk: produk,
        jumlah: parseFloat(r["QTY"] || r["JUMLAH"]) || 0,
        satuan: r["SATUAN"] || "Pcs",
        harga: parseFloat(r["PRICE/ITEM"] || r["HARGA"]) || 0,
        total: parseFloat(r["ITEM*QTY"] || r["TOTAL"]) || 0,
        kategori: r["CATEGORY"] || r["KATEGORI"],
      };
    }),
    summary: {
      subtotal: parseFloat(main["SUBTOTAL ITEM"] || main["SUB TOTAL"]) || 0,
      ongkir: parseFloat(main["DELIVERY"] || main["ONGKIR"]) || 0,
      packing: parseFloat(main["PACKING"]) || 0,
      diskon: parseFloat(main["DISCOUNT"] || main["DISKON"]) || 0,
    },
    totalBayar:
      parseFloat(
        main["TOTAL DP/FP"] ||
          (parseFloat(main["DP 1"]) || 0) + (parseFloat(main["DP 2"]) || 0),
      ) || 0,
  };

  sessionStorage.setItem("editInvoiceData", JSON.stringify(editData));
  window.location.href = "form_edit_pelunasan.html";
}

/**
 * Delete Invoice
 */
async function deleteInvoiceAction(noPesanan) {
  if (!confirm(`Yakin ingin menghapus invoice ${noPesanan}?`)) return;

  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    const result = await deleteInvoice(pelunasanService.sheetName, noPesanan);
    if (result.success) {
      alert("Invoice berhasil dihapus.");
      await pelunasanService.clearCache();
      loadPelunasanData();
    } else {
      throw new Error(result.error || "Gagal menghapus.");
    }
  } catch (error) {
    console.error("Delete Error:", error);
    alert("Gagal menghapus: " + error.message);
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}
