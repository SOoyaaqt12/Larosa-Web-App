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
}

function groupDataByOrder(data) {
  const groups = {};
  const orderedGroups = [];
  let currentOrderNo = null;

  const invoiceKeys = [
    "NO'PESANAN",
    "NO PESANAN",
    "INVOICE",
    "NO\nPESANAN",
    "INVOICE\n",
    "invoice",
  ];

  data.forEach((row) => {
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

    const tanggal = mainRow["TANGGAL"];
    const nama = getValueFromKeys(
      mainRow,
      ["NAMA PELANGGAN", "Nama Pelanggan"],
      ""
    );
    const itemsCount = invoiceRows.length;
    let totalTagihan = mainRow["TOTAL TAGIHAN"] || 0;

    const formattedTotal = parseFloat(totalTagihan).toLocaleString("id-ID");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}.</td>
      <td>${noPesanan}</td>
      <td>
        <div style="font-weight:bold;">${nama}</div>
        <div style="font-size: 0.8em; color: gray;">${formatDisplayDate(
          tanggal
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
      tanggal: mainRow["TANGGAL"],
      kasir: mainRow["KASIR"],
      transaksi: mainRow["TRANSAKSI"],
      payment: mainRow["PAYMENT"],
    },
    customer: {
      nama: getValueFromKeys(mainRow, ["NAMA PELANGGAN", "Nama Pelanggan"], ""),
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: getValueFromKeys(mainRow, ["Kota", "KOTA"], ""),
      channel: mainRow["CHANNEL"],
    },
    items: invoiceRows
      .map((row) => ({
        sku: row["SKU"],
        produk: row["PRODUK"],
        jumlah: parseFloat(row["JUMLAH"]) || 0,
        satuan: row["SATUAN"],
        harga: parseFloat(getValueFromKeys(row, ["U HARGA", "HARGA"], 0)) || 0,
        total: parseFloat(getValueFromKeys(row, ["U TOTAL", "TOTAL"], 0)) || 0,
        kategori: row["KATEGORI"],
      }))
      .filter((item) => item.sku || item.produk),
    summary: {
      subtotal:
        parseFloat(getValueFromKeys(mainRow, ["SUBTOTAL", "SUB TOTAL"], 0)) ||
        0,
      ongkir:
        parseFloat(getValueFromKeys(mainRow, ["U ONGIR", "ONGKIR"], 0)) || 0,
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
      nama: getValueFromKeys(mainRow, ["NAMA PELANGGAN", "Nama Pelanggan"], ""),
      noHp: mainRow["NO HP"],
      alamat: mainRow["ALAMAT"],
      city: getValueFromKeys(mainRow, ["Kota", "KOTA"], ""),
      channel: mainRow["CHANNEL"],
    },
    items: invoiceRows
      .map((row) => ({
        sku: row["SKU"],
        produk: row["PRODUK"],
        jumlah: parseFloat(row["JUMLAH"]) || 0,
        satuan: row["SATUAN"],
        harga: parseFloat(getValueFromKeys(row, ["U HARGA", "HARGA"], 0)) || 0,
        total: parseFloat(getValueFromKeys(row, ["U TOTAL", "TOTAL"], 0)) || 0,
        kategori: row["KATEGORI"],
      }))
      .filter((item) => item.sku || item.produk),
    summary: {
      subtotal:
        parseFloat(getValueFromKeys(mainRow, ["SUBTOTAL", "SUB TOTAL"], 0)) ||
        0,
      ongkir:
        parseFloat(getValueFromKeys(mainRow, ["U ONGIR", "ONGKIR"], 0)) || 0,
      packing: parseFloat(mainRow["PACKING"]) || 0,
      diskon: parseFloat(mainRow["DISKON"]) || 0,
      totalTagihan: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
    },
    totalBayar: parseFloat(mainRow["TOTAL TAGIHAN"]) || 0,
  };

  sessionStorage.setItem("editInvoiceData", JSON.stringify(editData));
  window.location.href = "form_edit_invoice.html?origin=INVOICE";
}

async function deleteInvoiceAction(noPesanan) {
  if (
    !confirm(
      `Yakin ingin menghapus invoice ${noPesanan}? Data yang dihapus tidak bisa dikembalikan.`
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
