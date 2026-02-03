/**
 * Riwayat Page - Google Sheets Integration
 * Connects to INVOICE sheet
 *
 * Refactored to use shared utilities (utils.js, data-service.js)
 */

const invoiceService = DataServices.invoice;

// Global variable to store grouped data for actions
let groupedInvoices = {};

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
      const mainRow = rows[0];
      const nama = getValueFromKeys(
        mainRow,
        ["NAMA PELANGGAN", "Nama Pelanggan"],
        "",
      ).toLowerCase();
      const kota = getValueFromKeys(
        mainRow,
        ["Kota", "KOTA"],
        "",
      ).toLowerCase();
      const searchSource = `${noPesanan.toLowerCase()} ${nama} ${kota}`;

      // All keywords must be found in the combined source string (AND logic)
      return keywords.every((kw) => searchSource.includes(kw));
    });

    renderTable({ map: groupedInvoices.map, order: filteredOrder });
  });
}

function groupDataByOrder(data) {
  const groups = {};
  const orderedGroups = [];
  let currentOrderNo = null;

  const invoiceKeys = [
    "NO INVOICE",
    "NO'PESANAN",
    "NO PESANAN",
    "INVOICE",
    "NO\nPESANAN",
    "INVOICE\n",
    "invoice",
  ];

  data.forEach((row) => {
    // Filter for FP (Lunas) only
    if (row["DP/FP"] !== "FP") return;

    let noPesanan = null;

    // Try known keys
    for (const key of invoiceKeys) {
      if (row[key]) {
        noPesanan = row[key];
        break;
      }
    }

    // Fallback: fuzzy search
    if (!noPesanan) {
      const keys = Object.keys(row);
      for (const key of keys) {
        const upperKey = key.toUpperCase();
        if (
          (upperKey.includes("INVOICE") || upperKey.includes("PESANAN")) &&
          row[key]
        ) {
          noPesanan = row[key];
          break;
        }
      }
    }

    if (noPesanan) {
      currentOrderNo = noPesanan;
      if (!groups[currentOrderNo]) {
        groups[currentOrderNo] = [];
        orderedGroups.push(currentOrderNo);
      }
    }

    if (currentOrderNo) {
      groups[currentOrderNo].push(row);
    }
  });

  return { map: groups, order: orderedGroups };
}

function renderTable(groupedData) {
  const tableBody = document.querySelector("tbody");
  tableBody.innerHTML = "";

  const { map, order } = groupedData;

  order.forEach((noPesanan, index) => {
    const invoiceRows = map[noPesanan];
    const mainRow = invoiceRows[0];

    // New Keys: DATE, NAME, GRAND TOTAL
    const tanggal = mainRow["DATE"];
    const nama = mainRow["NAME"] || "";
    const itemsCount = invoiceRows.length;
    let totalTagihan = mainRow["GRAND TOTAL"] || 0;

    const formattedTotal = parseFloat(totalTagihan).toLocaleString("id-ID");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>${noPesanan}</td>
      <td>
        <div style="font-weight:bold;">${nama}</div>
        <div style="font-size: 0.8em; color: gray;">${formatDisplayDate(
          tanggal,
        )}</div>
      </td>
      <td>
         <div style="font-weight:bold;">Rp${formattedTotal}</div>
         <div style="font-size: 0.8em; color: gray;">${itemsCount} Items</div>
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

function viewInvoice(noPesanan) {
  const invoiceRows = groupedInvoices.map[noPesanan];
  if (!invoiceRows) return;

  const mainRow = invoiceRows[0];

  const invoiceData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["DATE"],
      kasir: mainRow["CASHIER"],
      transaksi: mainRow["TRANSACTION"],
      payment: mainRow["PAYMENT"],
      roPo: mainRow["RO/PO"] || "",
    },
    customer: {
      nama: mainRow["NAME"],
      noHp: mainRow["HP"],
      alamat: "NO_ADDRESS", // Address not in INCOME header? Check.
      city: mainRow["CITY"],
      channel: "NO_CHANNEL", // Channel not in INCOME header?
    },
    items: invoiceRows
      .map((row) => ({
        sku: "NO_SKU", // SKU not in INCOME header
        produk: row["ITEM PRODUCT"],
        jumlah: parseFloat(row["QTY"]) || 0,
        satuan: "Pcs", // Unit not in INCOME header
        harga: parseFloat(row["PRICE/ITEM"]) || 0,
        total: parseFloat(row["ITEM*QTY"]) || 0,
        kategori: row["CATEGORY"],
      }))
      .filter((item) => item.produk),
    summary: {
      subtotal: parseFloat(mainRow["SUBTOTAL ITEM"]) || 0,
      ongkir: parseFloat(mainRow["DELIVERY"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISCOUNT"]) || 0,
      totalTagihan: parseFloat(mainRow["GRAND TOTAL"]) || 0,
    },
  };

  sessionStorage.setItem("invoiceData", JSON.stringify(invoiceData));
  window.location.href = "invoice.html";
}

function editInvoice(noPesanan) {
  const invoiceRows = groupedInvoices.map[noPesanan];
  if (!invoiceRows) return;

  const mainRow = invoiceRows[0];

  const editData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["DATE"],
      kasir: mainRow["CASHIER"],
      transaksi: mainRow["TRANSACTION"],
      payment: mainRow["PAYMENT"],
      roPo: mainRow["RO/PO"] || "",
    },
    customer: {
      nama: mainRow["NAME"],
      noHp: mainRow["HP"],
      alamat: "",
      city: mainRow["CITY"],
      channel: "",
    },
    items: invoiceRows
      .map((row) => ({
        sku: "",
        produk: row["ITEM PRODUCT"],
        jumlah: parseFloat(row["QTY"]) || 0,
        satuan: "Pcs",
        harga: parseFloat(row["PRICE/ITEM"]) || 0,
        total: parseFloat(row["ITEM*QTY"]) || 0,
        kategori: row["CATEGORY"],
      }))
      .filter((item) => item.produk),
    summary: {
      subtotal: parseFloat(mainRow["SUBTOTAL ITEM"]) || 0,
      ongkir: parseFloat(mainRow["DELIVERY"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISCOUNT"]) || 0,
      totalTagihan: parseFloat(mainRow["GRAND TOTAL"]) || 0,
    },
    totalBayar: parseFloat(mainRow["TOTAL DP/FP"]) || 0,
  };

  sessionStorage.setItem("editInvoiceData", JSON.stringify(editData));
  window.location.href = "form_edit_invoice.html?origin=INCOME";
}

async function deleteInvoiceAction(noPesanan) {
  if (
    !confirm(
      `Yakin ingin menghapus invoice ${noPesanan}? Data yang dihapus tidak bisa dikembalikan.`,
    )
  ) {
    return;
  }

  // Show loading spinner
  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    const result = await deleteInvoice(invoiceService.sheetName, noPesanan);
    if (result.success) {
      alert("Invoice berhasil dihapus.");
      await invoiceService.clearCache();
      loadRiwayatData();
    } else {
      throw new Error(result.error || "Gagal menghapus.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Gagal menghapus: " + error.message);
  } finally {
    // Hide loading spinner
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}
