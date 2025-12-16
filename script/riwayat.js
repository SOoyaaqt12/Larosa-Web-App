const INVOICE_SHEET_NAME = "DATA_INVOICE";
const RIWAYAT_CACHE_KEY = "riwayat_data_cache";
const RIWAYAT_CACHE_TIMESTAMP_KEY = "riwayat_cache_timestamp";

// Global variable to store grouped data for actions
let groupedInvoices = {};

document.addEventListener("DOMContentLoaded", () => {
  loadRiwayatData();
});

async function loadRiwayatData() {
  const tableBody = document.querySelector("tbody");
  if (!tableBody) return;

  // Step 1: Immediately show cached data if available
  const cachedData = getRiwayatCachedData();
  if (cachedData && cachedData.map && Object.keys(cachedData.map).length > 0) {
    console.log("Showing cached riwayat data instantly");
    groupedInvoices = cachedData;
    renderTable(cachedData);
    showRiwayatRefreshIndicator();
  } else {
    tableBody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>';
  }

  // Step 2: Fetch fresh data in background
  try {
    const result = await fetchSheetData(INVOICE_SHEET_NAME);

    if (!result.data || result.data.length === 0) {
      if (
        !cachedData ||
        !cachedData.map ||
        Object.keys(cachedData.map).length === 0
      ) {
        tableBody.innerHTML =
          '<tr><td colspan="5" style="text-align:center;">Belum ada riwayat transaksi.</td></tr>';
      }
    } else {
      // Group data
      const freshGroupedData = groupDataByOrder(result.data);
      groupedInvoices = freshGroupedData;
      setRiwayatCachedData(freshGroupedData);
      renderTable(freshGroupedData);
    }
    hideRiwayatRefreshIndicator();
  } catch (error) {
    console.error("Error loading history:", error);
    hideRiwayatRefreshIndicator();
    // Only show error in table if no cache was shown
    if (!cachedData || !cachedData.map) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat data: ${error.message}</td></tr>`;
    }
  }
}

// Cache functions
function getRiwayatCachedData() {
  try {
    const cached = localStorage.getItem(RIWAYAT_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error("Error reading riwayat cache:", e);
  }
  return null;
}

function setRiwayatCachedData(data) {
  try {
    localStorage.setItem(RIWAYAT_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(RIWAYAT_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.error("Error saving riwayat cache:", e);
  }
}

function showRiwayatRefreshIndicator() {
  // Try to find header to inject indicator
  // layout.js header is in .main-content > .header > h1
  const pageTitle = document.querySelector(".header h1");
  if (pageTitle && !document.getElementById("riwayatRefreshIndicator")) {
    pageTitle.insertAdjacentHTML(
      "afterend",
      '<span id="riwayatRefreshIndicator" style="font-size: 12px; color: #888; margin-left: 10px;">Memperbarui data...</span>'
    );
  }
}

function hideRiwayatRefreshIndicator() {
  const indicator = document.getElementById("riwayatRefreshIndicator");
  if (indicator) indicator.remove();
}

function groupDataByOrder(data) {
  const groups = {};
  const orderedGroups = []; // To keep sort order (newest first)
  let currentOrderNo = null;

  data.forEach((row) => {
    let noPesanan = row["NO PESANAN"];

    // If this row has a new order number, start a new group
    if (noPesanan) {
      currentOrderNo = noPesanan;
      if (!groups[currentOrderNo]) {
        groups[currentOrderNo] = [];
        orderedGroups.push(currentOrderNo);
      }
    }

    // If we have a current order context, add this row to it
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
    const mainRow = invoiceRows[0]; // The first row has the header info

    // Extract info
    const tanggal = mainRow["TANGGAL"];
    const nama = mainRow["NAMA PELANGGAN"] || mainRow["Nama Pelanggan"];
    const itemsCount = invoiceRows.length;
    let totalTagihan = mainRow["TOTAL TAGIHAN"] || 0;

    // Format currency
    const formattedTotal = parseFloat(totalTagihan).toLocaleString("id-ID");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>${noPesanan}</td>
      <td>
        <div style="font-weight:bold;">${nama}</div>
        <div style="font-size: 0.8em; color: gray;">${tanggal}</div>
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

  // Reconstruct invoice object
  const invoiceData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["TANGGAL"],
      kasir: mainRow["KASIR"],
      transaksi: mainRow["TRANSAKSI"],
      payment: mainRow["PAYMENT"],
    },
    customer: {
      nama: mainRow["NAMA PELANGGAN"],
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: mainRow["KOTA"],
      channel: mainRow["CHANNEL"],
    },
    items: invoiceRows.map((row) => ({
      sku: row["SKU"],
      produk: row["PRODUK"],
      jumlah: parseFloat(row["JUMLAH"]) || 0,
      satuan: row["SATUAN"],
      harga: parseFloat(row["HARGA"]) || 0,
      total: parseFloat(row["TOTAL"]) || 0,
      kategori: row["KATEGORI"],
    })),
    summary: {
      subtotal: parseFloat(mainRow["SUBTOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      totalTagihan: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("invoiceData", JSON.stringify(invoiceData));
  window.location.href = "invoice.html";
}

function editInvoice(noPesanan) {
  const invoiceRows = groupedInvoices.map[noPesanan];
  if (!invoiceRows) return;

  // Save for edit mode
  // Reuse viewInvoice helper logic or duplicate
  // We need distinct structure? No, existing structure works with checkEditMode in kasir.js

  // Basically viewInvoice logic but save to differnet key
  const mainRow = invoiceRows[0];
  const editData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["TANGGAL"],
      kasir: mainRow["KASIR"],
      transaksi: mainRow["TRANSAKSI"],
      payment: mainRow["PAYMENT"],
    },
    customer: {
      nama: mainRow["NAMA PELANGGAN"],
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: mainRow["KOTA"],
      channel: mainRow["CHANNEL"],
    },
    items: invoiceRows.map((row) => ({
      sku: row["SKU"],
      produk: row["PRODUK"],
      jumlah: parseFloat(row["JUMLAH"]) || 0,
      satuan: row["SATUAN"],
      harga: parseFloat(row["HARGA"]) || 0,
      total: parseFloat(row["TOTAL"]) || 0,
      kategori: row["KATEGORI"],
    })),
    summary: {
      subtotal: parseFloat(mainRow["SUBTOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"]) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      totalTagihan: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("editInvoiceData", JSON.stringify(editData));
  window.location.href = "kasir.html?mode=edit";
}

async function deleteInvoiceAction(noPesanan) {
  if (
    !confirm(
      `Yakin ingin menghapus invoice ${noPesanan}? Data yang dihapus tidak bisa dikembalikan.`
    )
  ) {
    return;
  }

  // Show loading state
  // We can't reach event.target easily from onclick string, but we can redraw table or use cached data
  // Simplified:
  const previousText = "Hapus"; // assumption
  // Better: find button

  try {
    const result = await deleteInvoice(INVOICE_SHEET_NAME, noPesanan);
    if (result.success) {
      alert("Invoice berhasil dihapus.");
      // Clear cache and reload
      localStorage.removeItem(RIWAYAT_CACHE_KEY);
      loadRiwayatData();
    } else {
      throw new Error(result.error || "Gagal menghapus.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Gagal menghapus: " + error.message);
  }
}
