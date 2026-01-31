/**
 * Pelunasan Page - Google Sheets Integration
 * Connects to DP/Pelunasan sheet
 *
 * Refactored to use shared utilities (utils.js, data-service.js)
 */

const pelunasanService = DataServices.pelunasan;

let groupedInvoices = {};

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
      const nama = (mainRow["NAMA PELANGGAN"] || "").toLowerCase();
      const kota = (mainRow["KOTA"] || "").toLowerCase();
      const searchSource = `${noPesanan.toLowerCase()} ${nama} ${kota}`;

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
    "INVOICE",
    "NO PESANAN",
    "NO\nPESANAN",
    "INVOICE\n",
    "invoice",
  ];

  data.forEach((row) => {
    // Filter for DP only
    if (row["DP/FP"] !== "DP") return;

    let noPesanan = null;
    for (const key of invoiceKeys) {
      if (row[key]) {
        noPesanan = row[key];
        break;
      }
    }

    if (!noPesanan) {
      const keys = Object.keys(row);
      for (const key of keys) {
        if (
          key.toUpperCase().includes("INVOICE") ||
          key.toUpperCase().includes("PESANAN")
        ) {
          if (row[key]) {
            noPesanan = row[key];
            break;
          }
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

  if (order.length === 0) {
    showTableMessage(tableBody, "Tidak ada transaksi yang perlu dilunasi.", 6);
    return;
  }

  order.forEach((noPesanan) => {
    const invoiceRows = map[noPesanan];
    const mainRow = invoiceRows[0];

    // New keys: DATE, NAME, REMAINING BALANCE
    const tanggal = mainRow["DATE"];
    const nama = mainRow["NAME"];
    let sisaTagihan = mainRow["REMAINING BALANCE"] || 0;

    if (typeof sisaTagihan === "string") {
      sisaTagihan = parseFloat(sisaTagihan.replace(/[^\d.-]/g, "")) || 0;
    }

    const formattedSisa = sisaTagihan.toLocaleString("id-ID");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDisplayDate(tanggal)}</td>
      <td>${noPesanan}</td>
      <td>${nama}</td>
      <td><span class="badge status-dp">DP</span></td>
      <td>
         <div style="font-weight:bold;">Rp${formattedSisa}</div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-lihat" onclick="viewInvoicePelunasan('${noPesanan}')">Lihat</button>
          <button class="btn-edit" onclick="editInvoicePelunasan('${noPesanan}')" style="background-color: #ff9800;">Edit</button>
          <button class="btn-delete" onclick="deleteInvoiceAction('${noPesanan}')" style="background-color: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Hapus</button>
          <button class="btn-lihat" style="background-color: #4CAF50;" onclick="bayarInvoice('${noPesanan}')">Pelunasan</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function bayarInvoice(noPesanan) {
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
    },
    customer: {
      nama: mainRow["NAME"],
      noHp: mainRow["HP"],
      alamat: "NO_ADDRESS",
      kota: mainRow["CITY"],
      channel: "NO_CHANNEL",
    },
    items: invoiceRows
      .map((row) => ({
        sku: "NO_SKU",
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
  window.location.href = "form_pelunasan.html";
}

function viewInvoicePelunasan(noPesanan) {
  const invoiceRows = groupedInvoices.map[noPesanan];
  if (!invoiceRows) return;

  const mainRow = invoiceRows[0];

  const paidAmount = parseFloat(mainRow["TOTAL DP/FP"]) || 0;
  const totalTagihan = parseFloat(mainRow["GRAND TOTAL"]) || 0;
  // Previously we had DP1/DP2. Now we just have Total DP/FP.
  // We can map DP1 = paidAmount, DP2 = 0 for compatibility with view
  const dp1 = paidAmount;
  const dp2 = 0;
  const sisa = totalTagihan - paidAmount;

  const invoiceData = {
    info: {
      noPesanan: noPesanan,
      tanggal: mainRow["DATE"],
      kasir: mainRow["CASHIER"],
      transaksi: mainRow["TRANSACTION"],
      payment: mainRow["PAYMENT"],
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
      totalTagihan: totalTagihan,
      dp1: dp1,
      dp2: dp2,
      sisaTagihan: sisa,
    },
  };

  sessionStorage.setItem("invoiceData", JSON.stringify(invoiceData));
  window.location.href = "invoice_dp.html";
}

function editInvoicePelunasan(noPesanan) {
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
    },
    customer: {
      nama: mainRow["NAME"],
      noHp: mainRow["HP"],
      alamat: "",
      kota: mainRow["CITY"],
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
  window.location.href = `form_edit_pelunasan.html`;
}

async function deleteInvoiceAction(noPesanan) {
  if (
    !confirm(
      `Yakin ingin menghapus invoice ${noPesanan} dari daftar Pelunasan? Data yang dihapus tidak bisa dikembalikan.`,
    )
  ) {
    return;
  }

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
    console.error("Error:", error);
    alert("Gagal menghapus: " + error.message);
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}
