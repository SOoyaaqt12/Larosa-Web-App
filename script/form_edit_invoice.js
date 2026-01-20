/**
 * Edit Invoice Logic
 * Duplicate of kasir.js but stripped down for dedicated editing page
 */

const INVOICE_SHEET_NAME = "INVOICE";
const PELUNASAN_SHEET_NAME = "DP/Pelunasan";
const KUSTOMER_SHEET_NAME = "KOSTUMER";
const PRODUK_SHEET_NAME = "PERSEDIAAN BARANG";
const INVOICE_COUNTER_KEY = "larosapot_invoice_counter";

// State
let keranjangData = [];
let nomorUrut = 1;
let allCustomers = [];
let allProducts = [];
let selectedCustomer = { kota: "", channel: "" };

let editOriginalOrderNo = "";
let editOriginSheet = "";
let originalStatus = "";

document.addEventListener("DOMContentLoaded", () => {
  initEditPage();
});

async function initEditPage() {
  if (window.showGlobalLoader) window.showGlobalLoader();

  // Check data
  const editDataString = sessionStorage.getItem("editInvoiceData");
  if (!editDataString) {
    alert("Data edit tidak ditemukan!");
    window.history.back();
    return;
  }

  try {
    await Promise.all([
      loadCustomersForAutocomplete(),
      loadProductsForAutocomplete(),
    ]);

    setupAutocomplete();
    setupProductAutocomplete();
    setupCalculatorInputs();

    const editData = JSON.parse(editDataString);
    populateForm(editData);
  } catch (e) {
    console.error("Init Error", e);
    alert("Gagal memuat halaman: " + (e.message || e));
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function populateForm(editData) {
  editOriginalOrderNo = editData.info.noPesanan;
  originalStatus = editData.info.transaksi;

  // Capture origin
  const urlParams = new URLSearchParams(window.location.search);
  editOriginSheet = urlParams.get("origin") || INVOICE_SHEET_NAME;

  // Core fields
  document.getElementById("tanggalDibuat").value = formatDateForInput(
    editData.info.tanggal
  );
  document.getElementById("noPesanan").value = editData.info.noPesanan;
  document.getElementById("kasir").value = editData.info.kasir;
  document.getElementById("paymen").value = editData.info.payment || "";

  // Customer
  document.getElementById("namaPelanggan").value = editData.customer.nama;
  document.getElementById("noTelepon").value = editData.customer.noHp;
  document.getElementById("alamatPelanggan").value = editData.customer.alamat;
  selectedCustomer.kota = editData.customer.city;
  selectedCustomer.channel = editData.customer.channel;

  // Cart
  keranjangData = [];
  nomorUrut = 1;
  editData.items.forEach((item) => {
    keranjangData.push({
      no: nomorUrut++,
      sku: item.sku,
      produk: item.produk,
      jumlah: item.jumlah,
      satuan: item.satuan,
      harga: item.harga,
      total: item.total,
      kategori: item.kategori,
    });
  });
  updateTabelKeranjang();

  // Totals
  document.getElementById("subtotal").value = editData.summary.subtotal;
  document.getElementById("ongkir").value = editData.summary.ongkir;
  document.getElementById("packing").value = editData.summary.packing;
  document.getElementById("diskon").value = editData.summary.diskon;

  // Payments
  // Map totalBayar to DP1
  const totalBayar = editData.totalBayar || 0;
  // Check if originally DP or Lunas
  // If we are editing, we are likely making adjustments.
  // If it was LUNAS, totalBayar usually equals totalTagihan.
  // We display totalBayar in DP1 (ReadOnly) and allow adjustments in DP2?
  // User requested "Simpan dan Batal".
  // Let's verify how kasir.js populates this.
  // kasir.js checkEditMode: if totalBayar > 0, set DP1 = totalBayar, readonly.

  // Logic:
  // If I edit the items (add more), the total goes up.
  // DP1 stays fixed. Remaining goes to Sisa.
  // If I want to pay the rest, I use DP2.
  // If I reduce items, Sisa might become negative (overpaid).

  const dp1El = document.getElementById("dp1");
  dp1El.value = totalBayar;

  hitungTotalTagihan();
}

// ... Autocomplete, Calculator, Table functions (copied/shared from kasir.js) ...
// Ideally we should have a shared util file, but for now duplicating essential logic.

// LocalStorage cache keys (shared with kasir.js)
const CUSTOMER_CACHE_KEY = "larosapot_customer_cache";
const PRODUCT_CACHE_KEY = "larosapot_product_cache";

async function loadCustomersForAutocomplete() {
  // Load from cache first for instant UI
  try {
    const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
    if (cached) allCustomers = JSON.parse(cached);
  } catch (e) {}

  // Fetch fresh data
  try {
    const result = await fetchSheetData(KUSTOMER_SHEET_NAME);
    if (result.data) {
      allCustomers = result.data;
      try {
        localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(result.data));
      } catch (e) {}
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadProductsForAutocomplete() {
  // Load from cache first
  try {
    const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (cached) allProducts = JSON.parse(cached);
  } catch (e) {}

  // Fetch fresh data
  try {
    const result = await fetchSheetData(PRODUK_SHEET_NAME);
    if (result.data) {
      allProducts = result.data;
      try {
        localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(result.data));
      } catch (e) {}
    }
  } catch (e) {
    console.error(e);
  }
}

function setupAutocomplete() {
  const input = document.getElementById("noTelepon");
  const list = document.getElementById("suggestionList");
  if (!input || !list) return;

  input.addEventListener("input", (e) => {
    const val = e.target.value;
    if (val.length < 2) {
      list.classList.remove("show");
      return;
    }

    const matches = allCustomers
      .filter(
        (c) =>
          String(c["NO HP"] || "").includes(val) ||
          String(c["NAMA PELANGGAN"] || "")
            .toLowerCase()
            .includes(val.toLowerCase())
      )
      .slice(0, 10);

    list.innerHTML = "";
    matches.forEach((c) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `${c["NAMA PELANGGAN"]} - ${c["NO HP"]}`;
      div.onclick = () => {
        document.getElementById("namaPelanggan").value = c["NAMA PELANGGAN"];
        document.getElementById("noTelepon").value = c["NO HP"];
        document.getElementById("alamatPelanggan").value = c["ALAMAT"];
        selectedCustomer.kota = c["KOTA"];
        selectedCustomer.channel = c["CHANNEL"];
        list.classList.remove("show");
      };
      list.appendChild(div);
    });
    if (matches.length > 0) list.classList.add("show");
    else list.classList.remove("show");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container"))
      list.classList.remove("show");
  });
}

function setupProductAutocomplete() {
  const input = document.getElementById("noSku");
  const list = document.getElementById("skuSuggestionList");
  if (!input || !list) return;

  input.addEventListener("input", (e) => {
    const val = e.target.value.toUpperCase();
    if (val.length < 1) {
      list.classList.remove("show");
      return;
    }

    const matches = allProducts
      .filter(
        (p) =>
          String(p["SKU"] || "").includes(val) ||
          String(p["NAMA PRODUK"] || "")
            .toUpperCase()
            .includes(val)
      )
      .slice(0, 10);

    list.innerHTML = "";
    matches.forEach((p) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `${p["SKU"]} - ${p["NAMA PRODUK"]}`;
      div.onclick = () => {
        document.getElementById("noSku").value = p["SKU"];
        document.getElementById("namaProduk").value = p["NAMA PRODUK"];
        document.getElementById("satuan").value = p["SATUAN"];
        document.getElementById("harga").value = p["HARGA JUAL"];
        document.getElementById("noSku").dataset.kategori = p["KATEGORI"];
        list.classList.remove("show");
        document.getElementById("jumlah").focus();
        hitungTotalHarga();
      };
      list.appendChild(div);
    });
    if (matches.length > 0) list.classList.add("show");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container"))
      list.classList.remove("show");
  });
}

function hitungTotalHarga() {
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  document.getElementById("totalHarga").value = jumlah * harga;
}

function tambahKeKeranjang() {
  const noSku = document.getElementById("noSku").value;
  const nama = document.getElementById("namaProduk").value;
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  const total = parseFloat(document.getElementById("totalHarga").value) || 0;
  const satuan = document.getElementById("satuan").value;
  const kategori = document.getElementById("noSku").dataset.kategori;

  if (!noSku || jumlah <= 0) {
    alert("Data produk tidak lengkap");
    return;
  }

  keranjangData.push({
    no: nomorUrut++,
    sku: noSku,
    produk: nama,
    jumlah,
    satuan,
    harga,
    total,
    kategori,
  });

  updateTabelKeranjang();
  hitungSubtotal();

  // Clear inputs
  document.getElementById("noSku").value = "";
  document.getElementById("namaProduk").value = "";
  document.getElementById("jumlah").value = "";
  document.getElementById("harga").value = "";
  document.getElementById("totalHarga").value = "";
  document.getElementById("satuan").value = "";
}

function updateTabelKeranjang() {
  const tbody = document.getElementById("keranjangBody");
  tbody.innerHTML = "";
  keranjangData.forEach((item, idx) => {
    const row = tbody.insertRow();
    row.innerHTML = `
            <td>${item.no}</td>
            <td>${item.sku}</td>
            <td>${item.produk}</td>
            <td>${item.jumlah}</td>
            <td>${item.satuan}</td>
            <td>Rp${item.harga.toLocaleString()}</td>
            <td>Rp${item.total.toLocaleString()}</td>
            <td><button class="btn-remove" onclick="hapusItem(${idx})">Hapus</button></td>
        `;
  });
}

function hapusItem(idx) {
  keranjangData.splice(idx, 1);
  keranjangData.forEach((i, x) => (i.no = x + 1));
  nomorUrut = keranjangData.length + 1;
  updateTabelKeranjang();
  hitungSubtotal();
}

function hitungSubtotal() {
  const sub = keranjangData.reduce((s, i) => s + i.total, 0);
  document.getElementById("subtotal").value = sub;
  hitungTotalTagihan();
}

function hitungTotalTagihan() {
  const sub = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = evaluateExpression(document.getElementById("ongkir"));
  const packing = evaluateExpression(document.getElementById("packing"));
  const diskon = evaluateExpression(document.getElementById("diskon"));

  const total = sub + ongkir + packing - diskon;
  document.getElementById("totalTagihan").value = total;
  hitungSisaTagihan();
}

function hitungSisaTagihan() {
  const total = parseFloat(document.getElementById("totalTagihan").value) || 0;
  const dp1 = evaluateExpression(document.getElementById("dp1"));
  const dp2 = evaluateExpression(document.getElementById("dp2"));

  document.getElementById("sisaTagihan").value = total - (dp1 + dp2);
}

function evaluateExpression(input) {
  // Basic calculator logic reused
  const val = input.value.trim();
  if (val.startsWith("=")) {
    try {
      const res = Function('"use strict";return (' + val.substring(1) + ")")();
      if (!isNaN(res)) return res;
    } catch (e) {}
  }
  return parseFloat(val) || 0;
}

function setupCalculatorInputs() {
  ["packing", "ongkir", "diskon", "dp2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9=+\-*/().]/g, "");
      });
  });
}

function cancelEdit() {
  sessionStorage.removeItem("editInvoiceData");
  window.history.back();
}

async function saveEdit(forceLunas = false) {
  if (keranjangData.length === 0) {
    alert("Keranjang kosong!");
    return;
  }

  let sisa = parseFloat(document.getElementById("sisaTagihan").value) || 0;
  let dp1 = parseFloat(document.getElementById("dp1").value) || 0;
  let dp2 = parseFloat(document.getElementById("dp2").value) || 0;

  // Logic Fix:
  // If forceLunas (Simpan Lunas button) is clicked:
  // We MUST ensure sisa becomes 0.
  // We add the remaining sisa to dp2.
  if (forceLunas && sisa > 0) {
    dp2 += sisa;
    sisa = 0; // Force sisa to 0
    // Update UI for clarity (optional, but good for feedback if we weren't redirecting immediately)
    document.getElementById("dp2").value = dp2;
    document.getElementById("sisaTagihan").value = 0;
  }

  let totalPaid = dp1 + dp2;

  // Determine Status
  let status = "DP";
  if (sisa <= 0) status = "LUNAS";

  // If user wanted "Simpan Lunas" but somehow it's still DP (shouldn't happen with above logic), warning?
  if (forceLunas && status !== "LUNAS") {
    alert("Terjadi kesalahan perhitungan. Pastikan total bayar mencukupi.");
    return;
  }

  // Warn if status changes?
  // Usually user just wants to update item details.

  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    // 1. Delete Old
    const deleteRes = await deleteInvoice(editOriginSheet, editOriginalOrderNo);
    if (!deleteRes.success)
      throw new Error("Gagal menghapus data lama: " + deleteRes.error);

    // 2. Determine Target
    const targetSheet =
      status === "LUNAS" ? INVOICE_SHEET_NAME : PELUNASAN_SHEET_NAME;

    // 3. Build Rows
    // Re-use logic for row building.
    // We use the same format as kasir.js and form_pelunasan.js
    const rows = [];
    const info = {
      noPesanan: document.getElementById("noPesanan").value,
      tanggal: document.getElementById("tanggalDibuat").value, // YYYY-MM-DD
      kasir: document.getElementById("kasir").value,
      transaction: status,
      payment: document.getElementById("paymen").value,
    };
    const cust = {
      nama: document.getElementById("namaPelanggan").value,
      hp: document.getElementById("noTelepon").value,
      alamat: document.getElementById("alamatPelanggan").value,
      kota: selectedCustomer.kota,
      channel: selectedCustomer.channel,
    };
    const sum = {
      sub: parseFloat(document.getElementById("subtotal").value) || 0,
      ong: parseFloat(document.getElementById("ongkir").value) || 0,
      pack: parseFloat(document.getElementById("packing").value) || 0,
      disc: parseFloat(document.getElementById("diskon").value) || 0,
      tot: parseFloat(document.getElementById("totalTagihan").value) || 0,
    };

    const formattedDate = formatDateForInvoice(info.tanggal); // DD-Mon-YYYY

    keranjangData.forEach((item, idx) => {
      let rowData = {};
      const isInvoiceSheet = targetSheet === INVOICE_SHEET_NAME;

      // Kedua sheet menggunakan nama kolom yang sama
      const invoiceKey = "INVOICE";
      const subtotalKey = "SUB TOTAL";
      const hargaKey = "HARGA";
      const totalKey = "TOTAL";
      const ongkirKey = "ONGKIR";
      const kotaKey = isInvoiceSheet ? "Kota" : "";

      if (idx === 0) {
        rowData = {
          TANGGAL: formattedDate,
          [invoiceKey]: info.noPesanan,
          KASIR: info.kasir,
          TRANSAKSI: status,
          PAYMENT: info.payment,
          "NAMA PELANGGAN": cust.nama,
          "NO HP": cust.hp,
          ALAMAT: cust.alamat,
          CHANNEL: cust.channel || "",
          KATEGORI: item.kategori || "",
          SKU: item.sku,
          PRODUK: item.produk,
          JUMLAH: item.jumlah,
          SATUAN: item.satuan,
          [hargaKey]: item.harga,
          [totalKey]: item.total,
          [subtotalKey]: sum.sub,
          [ongkirKey]: sum.ong,
          PACKING: sum.pack,
          DISKON: sum.disc,
          "TOTAL TAGIHAN": sum.tot,
        };
        if (isInvoiceSheet) rowData[kotaKey] = cust.kota || "";
        else {
          rowData["DP 1"] = dp1;
          rowData["DP 2"] = dp2;
          rowData["Pelunasan"] = "";
          rowData["SISA TAGIHAN"] = sisa;
        }
      } else {
        rowData = {
          TANGGAL: "",
          [invoiceKey]: "",
          SKU: item.sku,
          PRODUK: item.produk,
          JUMLAH: item.jumlah,
          SATUAN: item.satuan,
          [hargaKey]: item.harga,
          [totalKey]: item.total,
        };
      }
      rows.push(rowData);
    });

    // 4. Save
    // Loop through rows and save each one using addSheetRow
    // Reverse to maintain order if addSheetRow appends to top?
    // kasir.js uses .reverse() but usually append goes to bottom.
    // If rows are [Header, Item1, Item2], generally we want Header first.
    // If Google Sheet appends to bottom, we want [Header, Item1, Item2].
    // kasir.js reversing might be due to prepend logic or just legacy.
    // Let's stick to standard order unless proven otherwise.
    // Update: checked kasir.js, it REVERSES. Maybe inserts at top?
    // Let's follow kasir.js pattern to be safe: rows.reverse()

    for (const row of rows.reverse()) {
      const saveRes = await addSheetRow(targetSheet, row);
      if (!saveRes.success)
        throw new Error(saveRes.error || "Gagal menyimpan data");
    }

    alert("Perubahan berhasil disimpan!");
    sessionStorage.removeItem("editInvoiceData");

    // Redirect logic
    if (targetSheet === INVOICE_SHEET_NAME)
      window.location.href = "riwayat.html";
    else window.location.href = "pelunasan.html";
  } catch (e) {
    console.error("Save Error", e);
    alert("Gagal menyimpan: " + e.message);
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function formatDateForInput(dateString) {
  // YYYY-MM-DD or DD-Mon-YYYY to YYYY-MM-DD
  if (!dateString) return new Date().toISOString().split("T")[0];
  if (
    dateString.includes("-") &&
    dateString.length === 10 &&
    !isNaN(dateString.substring(0, 4))
  )
    return dateString; // Already YYYY-MM-DD

  // Parse DD-Mon-YYYY
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const parts = dateString.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${months[parts[1]] || "01"}-${parts[0]}`;
  }
  return dateString;
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
