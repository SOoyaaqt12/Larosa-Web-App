/**
 * Form Pelunasan - Specific Logic
 * Handles paying off an existing DP invoice
 */

const INVOICE_SHEET_NAME = "INCOME";
const PELUNASAN_SHEET_NAME = "INCOME";

let currentInvoiceData = null;

document.addEventListener("DOMContentLoaded", () => {
  initPelunasanPage();
});

function initPelunasanPage() {
  const editData = sessionStorage.getItem("pelunasanInvoiceData");
  if (!editData) {
    alert("Data invoice tidak ditemukan!");
    window.location.href = "pelunasan.html";
    return;
  }

  try {
    currentInvoiceData = JSON.parse(editData);
    renderInvoiceData(currentInvoiceData);
  } catch (e) {
    console.error("Error parsing invoice data:", e);
    alert("Data invoice rusak!");
    window.location.href = "pelunasan.html";
  }
}

function renderInvoiceData(data) {
  // Info
  document.getElementById("noPesanan").value = data.info.noPesanan;
  document.getElementById("tanggalDibuat").value = data.info.tanggal;

  // Customer
  document.getElementById("namaPelanggan").value = data.customer.nama;
  document.getElementById("noTelepon").value = data.customer.noHp;
  if (document.getElementById("roPo")) {
    document.getElementById("roPo").value = data.info.roPo || "";
  }

  // Items
  const tbody = document.getElementById("keranjangBody");
  tbody.innerHTML = "";
  data.items.forEach((item, index) => {
    const row = tbody.insertRow();
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.produk}</td>
            <td>${item.jumlah}</td>
            <td>Rp${item.harga.toLocaleString("id-ID")}</td>
            <td>Rp${item.total.toLocaleString("id-ID")}</td>
        `;
  });

  // Totals
  document.getElementById("subtotal").value = formatRupiah(
    data.summary.subtotal,
  );
  document.getElementById("ongkir").value = formatRupiah(data.summary.ongkir);
  document.getElementById("diskon").value = formatRupiah(data.summary.diskon);
  document.getElementById("totalTagihan").value = formatRupiah(
    data.summary.totalTagihan,
  );

  // Payment Info
  document.getElementById("totalBayarAwal").value = formatRupiah(
    data.totalBayar,
  );

  // Calculate current remaining
  const sisa = data.summary.totalTagihan - data.totalBayar;
  document.getElementById("sisaTagihan").value = formatRupiah(sisa);

  // Auto-fill payment amount to match remaining
  document.getElementById("jumlahPelunasan").value = sisa;
}

function formatRupiah(amount) {
  return "Rp" + (parseFloat(amount) || 0).toLocaleString("id-ID");
}

function hitungSisaAkhir() {
  const jumlahInput = document.getElementById("jumlahPelunasan").value;
  const jumlahBayar = parseFloat(jumlahInput.replace(/[^\d.-]/g, "")) || 0;

  const sisaAwal =
    currentInvoiceData.summary.totalTagihan - currentInvoiceData.totalBayar;

  const btnSimpan = document.getElementById("btnSimpanDynamic");

  if (jumlahBayar < sisaAwal) {
    // Partial Payment Mode
    btnSimpan.textContent = "SIMPAN (CICIL)";
    btnSimpan.style.backgroundColor = "#ff9800"; // Orange
  } else {
    // Full Payment Mode
    btnSimpan.textContent = "SIMPAN LUNAS";
    btnSimpan.style.backgroundColor = "#2e7d32"; // Green
  }
}

// Flag to prevent double submission
let isProcessing = false;

async function prosesPelunasan() {
  if (isProcessing) return;

  const jumlahBayar =
    parseFloat(
      document.getElementById("jumlahPelunasan").value.replace(/[^\d.-]/g, ""),
    ) || 0;
  const sisaAwal =
    currentInvoiceData.summary.totalTagihan - currentInvoiceData.totalBayar;

  if (jumlahBayar <= 0) {
    alert("Masukkan jumlah pembayaran!");
    return;
  }

  // RO/PO Validation
  const roPo = document.getElementById("roPo")?.value || "";
  if (!roPo) {
    alert("RO/PO wajib diisi!");
    return;
  }

  // Determine status automatically
  let isFullPayment = false;

  if (jumlahBayar >= sisaAwal) {
    isFullPayment = true;
  } else {
    isFullPayment = false;
  }

  // Confirmation message
  const message = isFullPayment
    ? `Pembayaran LUNAS sebesar Rp${jumlahBayar.toLocaleString()}. Simpan transaksi ke Riwayat?`
    : `Pembayaran CICILAN sebesar Rp${jumlahBayar.toLocaleString()}. Simpan dan perbarui sisa tagihan?`;

  if (!confirm(message)) {
    return;
  }

  isProcessing = true;
  const btnSimpan = document.getElementById("btnSimpanDynamic");
  const originalText = btnSimpan.textContent;
  btnSimpan.textContent = "Menyimpan...";
  btnSimpan.disabled = true;

  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    // 1. Delete from DATA_PELUNASAN (Origin)
    const noPesanan = currentInvoiceData.info.noPesanan;
    console.log("Deleting original invoice from Pelunasan:", noPesanan);

    const deleteResult = await deleteInvoice(PELUNASAN_SHEET_NAME, noPesanan);
    if (!deleteResult.success) {
      throw new Error(`Gagal menghapus data lama: ${deleteResult.error}`);
    }

    // 2. Determine Target Sheet & Status
    const targetSheet = isFullPayment
      ? INVOICE_SHEET_NAME
      : PELUNASAN_SHEET_NAME;
    const status = isFullPayment ? "LUNAS" : "DP";

    const totalPaidNow = currentInvoiceData.totalBayar + jumlahBayar;
    const currentSisa = currentInvoiceData.summary.totalTagihan - totalPaidNow;

    // 3. Prepare Data Rows
    // Logic for DP1/DP2:
    const dp1Obj = currentInvoiceData.totalBayar;
    const dp2Obj = jumlahBayar;

    const rows = buildInvoiceRows(
      currentInvoiceData,
      isFullPayment,
      totalPaidNow,
      currentSisa,
      status,
      targetSheet,
      dp1Obj,
      dp2Obj,
      document.getElementById("paymen").value ||
        currentInvoiceData.info.payment,
      roPo,
    );

    // 4. Save to Target Sheet
    console.log(`Saving to ${targetSheet} as ${status}`);

    for (const row of rows.reverse()) {
      const saveResult = await addSheetRow(targetSheet, row);
      if (!saveResult.success) {
        throw new Error(saveResult.error || "Gagal menyimpan data");
      }
    }

    alert(
      `Berhasil menyimpan transaksi! Data disimpan di ${
        isFullPayment ? "Riwayat" : "Pelunasan"
      } (${status}).`,
    );
    // Ensure we don't double submit by redirecting immediately
    // Wait for redirect, don't re-enable button immediately
    window.location.href = isFullPayment ? "riwayat.html" : "pelunasan.html";
  } catch (error) {
    console.error("Error processing payment:", error);
    alert("Gagal memproses pelunasan: " + error.message);
    isProcessing = false;
    btnSimpan.textContent = originalText;
    btnSimpan.disabled = false;
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function buildInvoiceRows(
  data,
  isLunas,
  totalPaid,
  sisa,
  status,
  targetSheet,
  dp1Val,
  dp2Val,
  paymentMethod,
  roPoVal,
) {
  const rows = [];

  // Current database schema uses these column names:
  // DATE, CASHIER, TRANSACTION, PAYMENT, RO/PO, DP/FP, NO INVOICE, NAME, HP, CITY,
  // CATEGORY, ITEM PRODUCT, QTY, PRICE/ITEM, ITEM*QTY, SUBTOTAL ITEM, PACKING,
  // DELIVERY, DISCOUNT, GRAND TOTAL, TOTAL DP/FP, REMAINING BALANCE, STATUS

  data.items.forEach((item, index) => {
    let rowData = {};

    // Combine SKU and Product Name for "ITEM PRODUCT"
    const itemProductDisplay = item.sku
      ? `[${item.sku}] ${item.produk}`
      : item.produk;

    if (index === 0) {
      // Main row with all transaction details
      rowData = {
        DATE: formatDateForInvoice(new Date()),
        CASHIER: data.info.kasir,
        TRANSACTION: data.info.transaksi || "Online",
        PAYMENT: paymentMethod || data.info.payment,
        "RO/PO": roPoVal || data.info.roPo || "",
        "DP/FP": isLunas ? "FP" : "DP",
        "NO INVOICE": data.info.noPesanan,
        NAME: data.customer.nama,
        HP: data.customer.noHp,
        CITY: data.customer.city || "",
        CATEGORY: item.kategori || "",
        "ITEM PRODUCT": itemProductDisplay,
        QTY: item.jumlah,
        "PRICE/ITEM": item.harga,
        "ITEM*QTY": item.total,
        "SUBTOTAL ITEM": data.summary.subtotal,
        PACKING: data.summary.packing || 0,
        DELIVERY: data.summary.ongkir,
        DISCOUNT: data.summary.diskon,
        "GRAND TOTAL": data.summary.totalTagihan,
        "TOTAL DP/FP": totalPaid,
        "REMAINING BALANCE": isLunas ? 0 : sisa,
        STATUS: "Belum Dikirim",
      };
    } else {
      // Subsequent rows only contain item details
      rowData = {
        DATE: "",
        CASHIER: "",
        TRANSACTION: "",
        PAYMENT: "",
        "RO/PO": "",
        "DP/FP": "",
        "NO INVOICE": "",
        NAME: "",
        HP: "",
        CITY: "",
        CATEGORY: item.kategori || "",
        "ITEM PRODUCT": itemProductDisplay,
        QTY: item.jumlah,
        "PRICE/ITEM": item.harga,
        "ITEM*QTY": item.total,
        "SUBTOTAL ITEM": "",
        PACKING: "",
        DELIVERY: "",
        DISCOUNT: "",
        "GRAND TOTAL": "",
        "TOTAL DP/FP": "",
        "REMAINING BALANCE": "",
        STATUS: "",
      };
    }
    rows.push(rowData);
  });
  return rows;
}

function formatDateForInvoice(dateString) {
  if (!dateString) return "";

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
  const ddMonYYYY = String(dateString).match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
  );
  if (ddMonYYYY) {
    return `${ddMonYYYY[1].padStart(2, "0")}-${ddMonYYYY[2]}-${ddMonYYYY[3]}`;
  }

  // If in YYYY-MM-DD format (from HTML date input)
  const ymd = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const monthIdx = parseInt(ymd[2], 10) - 1;
    return `${ymd[3]}-${monthNames[monthIdx]}-${ymd[1]}`;
  }

  // If it's a Date object, format it locally
  if (dateString instanceof Date) {
    const d = dateString;
    const day = String(d.getDate()).padStart(2, "0");
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Fallback: return as-is
  return String(dateString);
}
