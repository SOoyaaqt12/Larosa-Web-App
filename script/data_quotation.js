const QUOTATION_SHEET_NAME = "QUOTATION";
const QUOTATION_CACHE_KEY = "quotation_data_cache";
const QUOTATION_CACHE_TIMESTAMP_KEY = "quotation_cache_timestamp";

let groupedQuotations = {};

/**
 * Format date for display (remove time portion)
 */
function formatDisplayDate(dateValue) {
  if (!dateValue) return "-";
  try {
    let date;
    if (typeof dateValue === "string" && dateValue.includes("T")) {
      date = new Date(dateValue);
    } else {
      date = new Date(dateValue);
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

const quotationService = DataServices.quotation;

document.addEventListener("DOMContentLoaded", () => {
  loadQuotationData().then(() => setupSearch());
});

async function loadQuotationData() {
  const tableBody = document.querySelector("tbody");
  if (!tableBody) return;

  groupedQuotations = await quotationService.loadGroupedData({
    tbody: tableBody,
    onRender: renderTable,
    groupFn: groupDataByOrder,
  });
}

function groupDataByOrder(data) {
  const groups = {};
  const orderedGroups = [];
  let currentOrderNo = null;

  data.forEach((row) => {
    let noPesanan =
      row["NO PESANAN"] || row["NO'PESANAN"] || row["INVOICE"] || null;

    // Fuzzy search if direct key not found
    if (!noPesanan) {
      for (const key in row) {
        if (
          key.toUpperCase().includes("PESANAN") ||
          key.toUpperCase().includes("INVOICE")
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

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (!searchTerm) {
      renderTable({
        map: groupedQuotations.map,
        order: groupedQuotations.order,
      });
      return;
    }

    const keywords = searchTerm.split(/\s+/);
    const filteredOrder = groupedQuotations.order.filter((noPesanan) => {
      const rows = groupedQuotations.map[noPesanan];
      const mainRow = rows[0];
      const nama = (
        mainRow["PELANGGAN"] ||
        mainRow["NAMA PELANGGAN"] ||
        ""
      ).toLowerCase();
      const kota = (mainRow["KOTA"] || mainRow["Kota"] || "").toLowerCase();
      const searchSource = `${noPesanan.toLowerCase()} ${nama} ${kota}`;

      return keywords.every((kw) => searchSource.includes(kw));
    });

    renderTable({ map: groupedQuotations.map, order: filteredOrder });
  });
}

function renderTable(groupedData) {
  const tableBody = document.querySelector("tbody");
  tableBody.innerHTML = "";
  const { map, order } = groupedData;

  order.forEach((noPesanan, index) => {
    const rows = map[noPesanan];
    const mainRow = rows[0];
    const tanggal = mainRow["TANGGAL"];
    const nama = mainRow["PELANGGAN"] || mainRow["NAMA PELANGGAN"];
    const itemsCount = rows.length;
    const totalTagihan = mainRow["TOTAL TAGIHAN"] || 0;
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
          <button class="btn-lihat" onclick="viewQuotation('${noPesanan}')">Lihat</button>
          <button class="btn-edit" onclick="editQuotationAction('${noPesanan}')">Edit</button>
          <button class="btn-checkout" onclick="checkoutQuotation('${noPesanan}')">Checkout</button>
          <button class="btn-hapus" onclick="deleteQuotationAction('${noPesanan}')">Hapus</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function checkoutQuotation(noPesanan) {
  const rows = groupedQuotations.map[noPesanan];
  if (!rows) return;
  const mainRow = rows[0];

  const checkoutData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["TANGGAL"],
      kasir: mainRow["KASIR"],
      transaksi: "QUOTATION",
      payment: mainRow["PAYMENT"],
    },
    customer: {
      nama: mainRow["PELANGGAN"] || mainRow["NAMA PELANGGAN"],
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: mainRow["KOTA"],
      channel: mainRow["CHANNEL"],
    },
    items: rows
      .map((row) => ({
        sku: row["SKU"],
        produk: row["PRODUK"],
        jumlah: parseFloat(row["JUMLAH"]) || 0,
        satuan: row["SATUAN"],
        harga: parseFloat(row["HARGA"] || row["U HARGA"]) || 0,
        total: parseFloat(row["TOTAL"] || row["U TOTAL"]) || 0,
      }))
      .filter((item) => item.sku || item.produk), // Filter out empty rows
    summary: {
      subtotal: parseFloat(mainRow["SUB TOTAL"] || mainRow["SUBTOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"] || mainRow["U ONGIR"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      totalTagihan: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("checkoutQuotationData", JSON.stringify(checkoutData));
  window.location.href = "kasir.html?mode=checkout";
}

function viewQuotation(noPesanan) {
  const rows = groupedQuotations.map[noPesanan];
  if (!rows) return;
  const mainRow = rows[0];

  const quotationData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["TANGGAL"],
      kasir: mainRow["KASIR"],
      transaksi: "QUOTATION",
      payment: mainRow["PAYMENT"],
    },
    customer: {
      nama: mainRow["PELANGGAN"] || mainRow["NAMA PELANGGAN"],
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: mainRow["KOTA"],
      channel: mainRow["CHANNEL"],
    },
    items: rows
      .map((row) => ({
        sku: row["SKU"],
        produk: row["PRODUK"],
        jumlah: parseFloat(row["JUMLAH"]) || 0,
        satuan: row["SATUAN"],
        harga: parseFloat(row["HARGA"] || row["U HARGA"]) || 0,
        total: parseFloat(row["TOTAL"] || row["U TOTAL"]) || 0,
      }))
      .filter((item) => item.sku || item.produk), // Filter out empty rows
    summary: {
      subtotal: parseFloat(mainRow["SUB TOTAL"] || mainRow["SUBTOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"] || mainRow["U ONGIR"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      totalTagihan: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("invoiceData", JSON.stringify(quotationData)); // Reuse invoiceData key for compatibility with invoice view logic if reusing invoice.html, but I'll use quotation_view.html
  window.location.href = "quotation_view.html";
}

function editQuotationAction(noPesanan) {
  const rows = groupedQuotations.map[noPesanan];
  if (!rows) return;
  const mainRow = rows[0];

  const editData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["TANGGAL"],
      kasir: mainRow["KASIR"],
      transaksi: mainRow["TRANSAKSI"] || "Online",
      payment: mainRow["PAYMENT"] || "Transfer",
    },
    customer: {
      nama: mainRow["PELANGGAN"] || mainRow["NAMA PELANGGAN"],
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: mainRow["KOTA"] || "",
      channel: mainRow["CHANNEL"] || "",
    },
    items: rows
      .map((row) => ({
        sku: row["SKU"],
        produk: row["PRODUK"],
        jumlah: parseFloat(row["JUMLAH"]) || 0,
        satuan: row["SATUAN"],
        harga: parseFloat(row["HARGA"] || row["U HARGA"]) || 0,
        total: parseFloat(row["TOTAL"] || row["U TOTAL"]) || 0,
        kategori: row["KATEGORI"] || "",
      }))
      .filter((item) => item.sku || item.produk),
    summary: {
      subtotal: parseFloat(mainRow["SUB TOTAL"] || mainRow["SUBTOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"] || mainRow["U ONGIR"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      totalTagihan: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("editQuotationData", JSON.stringify(editData));
  window.location.href = "form_edit_quotation.html";
}

async function deleteQuotationAction(noPesanan) {
  if (!confirm(`Yakin ingin menghapus quotation ${noPesanan}?`)) return;

  // Show loading spinner
  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    const result = await deleteInvoice(QUOTATION_SHEET_NAME, noPesanan);
    if (result.success) {
      alert("Quotation berhasil dihapus.");
      localStorage.removeItem(QUOTATION_CACHE_KEY);
      loadQuotationData();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    alert("Gagal menghapus: " + error.message);
  } finally {
    // Hide loading spinner
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}
