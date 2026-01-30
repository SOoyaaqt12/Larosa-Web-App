/**
 * Form Pelunasan - Specific Logic
 * Handles paying off an existing DP invoice
 */

const INVOICE_SHEET_NAME = "INVOICE";
const PELUNASAN_SHEET_NAME = "DP/Pelunasan";

let currentInvoiceData = null;

document.addEventListener("DOMContentLoaded", () => {
  initPelunasanPage();
});

function initPelunasanPage() {
  const editData = sessionStorage.getItem("editInvoiceData");
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
) {
  const rows = [];
  const isInvoiceSheet = targetSheet === INVOICE_SHEET_NAME;

  data.items.forEach((item, index) => {
    let rowData = {};

    // Standardize column keys to "HARGA" regardless of sheet, assuming headers allow it.
    // If 'HARGA' works for Main Row, we should use it for Sub Row too.
    const hargaKey = "HARGA";
    const totalKey = "TOTAL";

    if (index === 0) {
      // Kedua sheet menggunakan nama kolom yang sama untuk sebagian besar field
      const invoiceKey = "INVOICE";
      const subtotalKey = "SUB TOTAL";
      const ongkirKey = "ONGKIR";
      const kotaKey = isInvoiceSheet ? "Kota" : "";

      rowData = {
        TANGGAL: formatDateForInvoice(new Date()),
        [invoiceKey]: data.info.noPesanan,
        KASIR: data.info.kasir,
        TRANSAKSI: status,
        PAYMENT: paymentMethod || data.info.payment,
        "NAMA PELANGGAN": data.customer.nama,
        "NO HP": data.customer.noHp,
        ALAMAT: data.customer.alamat,
        CHANNEL: data.customer.channel,
        KATEGORI: item.kategori || "",
        SKU: item.sku,
        PRODUK: item.produk,
        JUMLAH: item.jumlah,
        SATUAN: item.satuan,
        [hargaKey]: item.harga,
        [totalKey]: item.total,
        [subtotalKey]: data.summary.subtotal,
        [ongkirKey]: data.summary.ongkir,
        PACKING: data.summary.packing,
        DISKON: data.summary.diskon,
        "TOTAL TAGIHAN": data.summary.totalTagihan,
        "DP 1": dp1Val,
        "DP 2": dp2Val,
        Pelunasan: isLunas ? dp2Val : "",
        "SISA TAGIHAN": sisa,
      };

      // Ensure city is included for Riwayat sheet
      if (isInvoiceSheet) {
        rowData["Kota"] = data.customer.city || "";
      }
    } else {
      // Subsequent rows
      const invoiceKey = "INVOICE";
      rowData = {
        TANGGAL: "",
        [invoiceKey]: "",
        SKU: item.sku,
        PRODUK: item.produk,
        JUMLAH: item.jumlah,
        SATUAN: item.satuan,
      };

      // Use consistent keys
      rowData[hargaKey] = item.harga;
      rowData[totalKey] = item.total;
    }
    rows.push(rowData);
  });
  return rows;
}

function formatDateForInvoice(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const months = [
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
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}
