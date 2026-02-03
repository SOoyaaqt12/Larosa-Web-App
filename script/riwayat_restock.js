/**
 * Riwayat Restock Page - Logic
 * Connects to RESTOCK sheet
 */

const restockService = DataServices.restock;

// Global variable to store grouped data for actions
let groupedRestocks = {};

document.addEventListener("DOMContentLoaded", () => {
  loadRestockData();
});

async function loadRestockData() {
  const tableBody = document.getElementById("restockTableBody");
  if (!tableBody) return;

  groupedRestocks = await restockService.loadGroupedData({
    tbody: tableBody,
    onRender: renderTable,
    groupFn: groupDataByInvoice,
  });

  setupSearch();
}

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (!searchTerm) {
      renderTable({ map: groupedRestocks.map, order: groupedRestocks.order });
      return;
    }

    const keywords = searchTerm.split(/\s+/);
    const filteredOrder = groupedRestocks.order.filter((invoiceNo) => {
      const rows = groupedRestocks.map[invoiceNo];
      const mainRow = rows[0];
      const vendor = (mainRow["VENDOR"] || "").toLowerCase();
      const invoice = invoiceNo.toLowerCase();
      const searchSource = `${invoice} ${vendor}`;

      // All keywords must be found in the combined source string (AND logic)
      return keywords.every((kw) => searchSource.includes(kw));
    });

    renderTable({ map: groupedRestocks.map, order: filteredOrder });
  });
}

function groupDataByInvoice(data) {
  const groups = {};
  const orderedGroups = [];

  data.forEach((row) => {
    const invoiceNo = row["INVOICE"];
    if (!invoiceNo) return;

    if (!groups[invoiceNo]) {
      groups[invoiceNo] = [];
      orderedGroups.push(invoiceNo);
    }
    groups[invoiceNo].push(row);
  });

  // Sort by date (descending) if TANGGAL exists
  orderedGroups.sort((a, b) => {
    const dateA = new Date(groups[a][0]["TANGGAL"]);
    const dateB = new Date(groups[b][0]["TANGGAL"]);
    return dateB - dateA;
  });

  return { map: groups, order: orderedGroups };
}

function renderTable(groupedData) {
  const tableBody = document.getElementById("restockTableBody");
  tableBody.innerHTML = "";

  const { map, order } = groupedData;

  order.forEach((invoiceNo, index) => {
    const rows = map[invoiceNo];
    const mainRow = rows[0];

    const tanggal = mainRow["TANGGAL"];
    const vendor = mainRow["VENDOR"] || "";
    const totalTagihan = parseFloat(mainRow["TOTAL TAGIHAN"]) || 0;
    const itemsCount = rows.length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>
        <div style="font-weight:bold;">${vendor}</div>
        <div style="font-size: 0.8em; color: gray;">${formatDisplayDate(tanggal)}</div>
      </td>
      <td>${invoiceNo}</td>
      <td>
        <div style="font-weight:bold;">${formatCurrency(totalTagihan)}</div>
        <div style="font-size: 0.8em; color: gray;">${itemsCount} Items</div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-lihat" onclick="viewRestockInvoice('${invoiceNo}')">Lihat</button>
          <button class="btn-edit" onclick="editRestockAction('${invoiceNo}')">Edit</button>
          <button class="btn-hapus" onclick="deleteRestockAction('${invoiceNo}')">Hapus</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function viewRestockInvoice(invoiceNo) {
  const rows = groupedRestocks.map[invoiceNo];
  if (!rows) return;

  const mainRow = rows[0];

  const restockData = {
    invoiceNo: invoiceNo,
    tanggal: mainRow["TANGGAL"],
    vendor: {
      nama: mainRow["VENDOR"],
      phone: mainRow["HP VENDOR"] || "-",
      kategori: mainRow["KATEGORI"] || "-",
      alamat: mainRow["ALAMAT VENDOR"] || "-",
      bank: mainRow["BANK VENDOR"] || "-",
      rekening: mainRow["REKENING VENDOR"] || "-",
    },
    items: rows.map((row) => ({
      sku: row["SKU"],
      produk: row["NAMA PRODUK"],
      jumlah: parseFloat(row["JUMLAH"]) || 0,
      satuan: row["SATUAN"],
      hpp: parseFloat(row["HPP"]) || 0,
      total: parseFloat(row["TOTAL"]) || 0,
    })),
    summary: {
      subtotal: parseFloat(mainRow["SUB TOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"]) || 0,
      potongan: parseFloat(mainRow["POTONGAN"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      total: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
      dp: parseFloat(mainRow["DP"]) || 0,
      sisa: parseFloat(mainRow["SISA TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("currentPurchaseInvoice", JSON.stringify(restockData));
  window.location.href = "invoice_pembelian.html";
}

async function deleteRestockAction(invoiceNo) {
  if (
    !confirm(
      `Yakin ingin menghapus riwayat restock ${invoiceNo}? Data stok produk AKAN otomatis dikembalikan (dikurangi).`,
    )
  ) {
    return;
  }

  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    const result = await deleteRestockAndCorrectStock(invoiceNo);
    if (result.success) {
      alert("Riwayat restock berhasil dihapus.");
      await restockService.clearCache();
      loadRestockData();
    } else {
      throw new Error(result.error || "Gagal menghapus.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Gagal menghapus: " + error.message);
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function editRestockAction(invoiceNo) {
  const rows = groupedRestocks.map[invoiceNo];
  if (!rows) return;

  const mainRow = rows[0];

  const editData = {
    invoiceNo: invoiceNo,
    tanggal: mainRow["TANGGAL"],
    vendor: {
      nama: mainRow["VENDOR"],
      phone: mainRow["HP VENDOR"] || "",
      kategori: mainRow["KATEGORI"] || "",
      alamat: mainRow["ALAMAT VENDOR"] || "",
      bank: mainRow["BANK VENDOR"] || "",
      rekening: mainRow["REKENING VENDOR"] || "",
    },
    items: rows.map((row) => ({
      sku: row["SKU"],
      produk: row["NAMA PRODUK"],
      jumlah: parseFloat(row["JUMLAH"]) || 0,
      satuan: row["SATUAN"],
      hpp: parseFloat(row["HPP"]) || 0,
      total: parseFloat(row["TOTAL"]) || 0,
    })),
    summary: {
      subtotal: parseFloat(mainRow["SUB TOTAL"]) || 0,
      ongkir: parseFloat(mainRow["ONGKIR"]) || 0,
      potongan: parseFloat(mainRow["POTONGAN"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      total: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
      dp: parseFloat(mainRow["DP"]) || 0,
      sisa: parseFloat(mainRow["SISA TAGIHAN"]) || 0,
    },
  };

  sessionStorage.setItem("editRestockData", JSON.stringify(editData));
  window.location.href = "form_restock.html?mode=edit";
}
