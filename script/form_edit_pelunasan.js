/**
 * Edit Pelunasan (DP) Logic
 * Dedicated script for editing existing DP/Pelunasan data.
 * Saves back to DATA_PELUNASAN.
 */

const PELUNASAN_SHEET_NAME = "DP/Pelunasan";
const KUSTOMER_SHEET_NAME = "KOSTUMER";
const PRODUK_SHEET_NAME = "PERSEDIAAN BARANG";

// State
let keranjangData = [];
let nomorUrut = 1;
let allCustomers = [];
let allProducts = [];
let selectedCustomer = { kota: "", channel: "" };

let editOriginalOrderNo = "";
const targetSheet = PELUNASAN_SHEET_NAME; // Always save to Pelunasan

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
  selectedCustomer.kota = editData.customer.city; // Note: Pelunasan sheet might not have city
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
  const totalBayar = editData.totalBayar || 0;

  // For DP Edit:
  // DP1 is the amount ALREADY PAID historically (cannot be changed here easily)
  document.getElementById("dp1").value = totalBayar;

  // DP2 is for NEW payments if adding items, or adjusting.
  // Actually, usually when editing DP data, we are just correcting items.
  // Unless we are adding items, which increases Sisa Tagihan.
  // If we pay more now, it should be in Pelunasan flow, but maybe small adjustments here?
  // Let's keep DP2 open for "Tambahan DP" if needed.
  document.getElementById("dp2").value = 0;

  hitungTotalTagihan();
}

// ... Shared Logic ...

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

// Flag to prevent double submission
let isProcessing = false;

async function saveEditPelunasan() {
  if (isProcessing) return;

  if (keranjangData.length === 0) {
    alert("Keranjang kosong!");
    return;
  }

  const sisa = parseFloat(document.getElementById("sisaTagihan").value) || 0;
  const dp1 = parseFloat(document.getElementById("dp1").value) || 0;
  const dp2 = parseFloat(document.getElementById("dp2").value) || 0;
  // const totalPaid = dp1 + dp2; // DP1 (Old) + DP2 (New addition)

  isProcessing = true;
  // Assume there's a save button with a specific class or ID we can target if needed
  // For now just blocking the function is enough, but disabling button is better.
  // Looking at form_edit_pelunasan.html (not viewed but standard pattern)
  // Let's assume standard button or just rely on global loader.

  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    // 1. Delete Old Entry from Pelunasan
    const deleteRes = await deleteInvoice(
      PELUNASAN_SHEET_NAME,
      editOriginalOrderNo
    );
    if (!deleteRes.success)
      throw new Error("Gagal menghapus data lama: " + deleteRes.error);

    // 2. Build New Rows
    const rows = [];
    const info = {
      noPesanan: document.getElementById("noPesanan").value,
      tanggal: document.getElementById("tanggalDibuat").value,
      kasir: document.getElementById("kasir").value,
      transaction: "DP", // Always DP
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

    const formattedDate = formatDateForInvoice(info.tanggal);

    keranjangData.forEach((item, idx) => {
      let rowData = {};
      const invoiceKey = "INVOICE";
      const subtotalKey = "SUB TOTAL";
      // Standardize usage key
      const hargaKey = "HARGA";
      const totalKey = "TOTAL";
      const ongkirKey = "ONGKIR";

      if (idx === 0) {
        rowData = {
          TANGGAL: formattedDate,
          [invoiceKey]: info.noPesanan,
          KASIR: info.kasir,
          TRANSAKSI: info.transaction,
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
          "DP 1": dp1,
          "DP 2": dp2,
          Pelunasan: "",
          "SISA TAGIHAN": sisa,
        };
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

    // 4. Save using addSheetRow loop
    for (const row of rows.reverse()) {
      const saveRes = await addSheetRow(PELUNASAN_SHEET_NAME, row);
      if (!saveRes.success)
        throw new Error(saveRes.error || "Gagal menyimpan data");
    }

    alert("Perubahan berhasil disimpan!");
    sessionStorage.removeItem("editInvoiceData");
    window.location.href = "pelunasan.html";
  } catch (e) {
    console.error("Save Error", e);
    alert("Gagal menyimpan: " + e.message);
    isProcessing = false;
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function formatDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split("T")[0];
  if (
    dateString.includes("-") &&
    dateString.length === 10 &&
    !isNaN(dateString.substring(0, 4))
  )
    return dateString;
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
  if (parts.length === 3)
    return `${parts[2]}-${months[parts[1]] || "01"}-${parts[0]}`;
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
