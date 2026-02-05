/**
 * Riwayat Page - Google Sheets Integration
 * Connects to INCOME sheet
 */

const invoiceService = DataServices.invoice;

// Global variable to store grouped data for actions
let groupedInvoices = { map: {}, order: [] };

document.addEventListener("DOMContentLoaded", () => {
  loadRiwayatData();
});

async function loadRiwayatData() {
  const tableBody = document.querySelector("tbody");
  if (!tableBody) return;

  groupedInvoices = await invoiceService.loadGroupedData({
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
 * Group raw sheet data by Invoice Number
 */
function groupDataByOrder(data) {
  const groups = {};
  const orderedGroups = [];

  // Potential keys for Invoice Number in different sheet versions
  const invoiceKeys = ["NO PESANAN", "NO INVOICE", "INVOICE"];

  data.forEach((row) => {
    // Only show "FP" (Fully Paid) / Lunas in History
    if (
      row["DP/FP"] !== "FP" &&
      row["TRANSACTION"] !== "LUNAS" &&
      row["TRANSAKSI"] !== "LUNAS"
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
    tr.innerHTML = `<td colspan="5" style="text-align:center; padding: 20px;">Belum ada riwayat transaksi lunas.</td>`;
    tableBody.appendChild(tr);
    return;
  }

  order.forEach((noPesanan, index) => {
    const rows = map[noPesanan];
    const main = rows[0];

    const date = main["DATE"] || main["TANGGAL"];
    const name = main["NAME"] || main["NAMA PELANGGAN"] || "";
    const total = parseFloat(main["GRAND TOTAL"] || main["TOTAL TAGIHAN"]) || 0;
    const itemsCount = rows.length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>${noPesanan}</td>
      <td>
        <div style="font-weight:bold;">${name}</div>
        <div style="font-size: 0.85em; color: #666;">${formatDateForDisplay(date)}</div>
      </td>
      <td>
        <div style="font-weight:bold;">Rp${total.toLocaleString("id-ID")}</div>
        <div style="font-size: 0.85em; color: #666;">${itemsCount} Item</div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-lihat" onclick="viewInvoice('${noPesanan}')">Lihat</button>
          <button class="btn-edit" onclick="editInvoice('${noPesanan}')">Edit</button>
          <button class="btn-hapus" onclick="deleteInvoiceAction('${noPesanan}')">Hapus</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * View Invoice Details
 */
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
 * View Invoice Details
 */
async function viewInvoice(orderNo) {
  const rows = groupedInvoices.map[orderNo];
  if (!rows) return;

  const main = rows[0];
  const name = main["NAME"] || main["NAMA PELANGGAN"];
  const phone = main["HP"] || main["NO HP"];

  let address = main["ALAMAT"] || "NO_ADDRESS";
  if (window.Utils && window.Utils.getAddressForCustomer) {
    const found = await window.Utils.getAddressForCustomer(name, phone);
    if (found) address = found;
  }

  const data = {
    info: {
      noPesanan: orderNo,
      tanggal: main["DATE"] || main["TANGGAL"],
      kasir: main["CASHIER"] || main["KASIR"],
      transaksi: main["TRANSACTION"] || main["TRANSAKSI"] || "LUNAS",
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
        nama: produk,
        qty: parseFloat(r["QTY"] || r["JUMLAH"]) || 0,
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
      total: parseFloat(main["GRAND TOTAL"] || main["TOTAL TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("invoiceDetailData", JSON.stringify(data));
  window.location.href = "invoice.html";
}

/**
 * Edit Invoice
 */
async function editInvoice(orderNo) {
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
      transaksi: main["TRANSACTION"] || main["TRANSAKSI"] || "LUNAS",
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
    totalBayar: parseFloat(main["GRAND TOTAL"] || main["TOTAL TAGIHAN"]) || 0,
  };

  sessionStorage.setItem("editInvoiceData", JSON.stringify(editData));

  // Check transaction type for correct redirection
  if (editData.info.transaksi === "DP" || editData.info.dpFp === "DP") {
    window.location.href = "form_edit_pelunasan.html";
  } else {
    window.location.href = "form_edit_invoice.html";
  }
}

/**
 * Delete Invoice
 */
async function deleteInvoiceAction(noPesanan) {
  if (!confirm(`Yakin ingin menghapus invoice ${noPesanan}?`)) return;

  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    const result = await deleteInvoice("INCOME", noPesanan);
    if (result.success) {
      alert("Invoice berhasil dihapus.");
      await invoiceService.clearCache();
      loadRiwayatData();
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
