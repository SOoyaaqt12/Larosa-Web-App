/**
 * Quotation Page - Core Functions
 * Handles customer autocomplete, cart management, and calculations for Quotations
 */

const QUOTATION_SHEET_NAME = "QUOTATION";
const KUSTOMER_SHEET_NAME = "KOSTUMER";
const PRODUK_SHEET_NAME = "PERSEDIAAN BARANG";

// Cart data
let keranjangData = [];
let nomorUrut = 1;

// Customer data cache for autocomplete
let allCustomers = [];
let selectedCustomer = { kota: "", channel: "" };

// LocalStorage cache keys
const CUSTOMER_CACHE_KEY = "larosapot_customer_cache";
const PRODUCT_CACHE_KEY = "larosapot_product_cache";

// Quotation counter storage key
const QUOTATION_COUNTER_KEY = "larosapot_quotation_counter";

// Edit Mode State (Simplified for Quotation)
let isEditMode = false;
let editOriginalOrderNo = "";
let editOriginSheet = "";

// Initialize page when loaded
document.addEventListener("DOMContentLoaded", () => {
  initQuotationPage();
});

/**
 * Initialize quotation page
 */
async function initQuotationPage() {
  const editData = sessionStorage.getItem("editQuotationData");

  const isEditMode = !!editData;
  if (isEditMode && window.showGlobalLoader) {
    window.showGlobalLoader();
  }

  const tanggalInput = document.getElementById("tanggalDibuat");
  if (tanggalInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    tanggalInput.value = `${year}-${month}-${day}`;
  }

  updateQuotationNumber();

  // Load cached data IMMEDIATELY (non-blocking sync operations)
  loadCachedCustomers();
  loadCachedProducts();
  loadCachedKasir();

  // Setup UI immediately - it will use cached data
  setupAutocomplete();
  setupProductAutocomplete();
  setupCalculatorInputs();
  setupEnterKeyListeners();

  // Now refresh data in background (non-blocking)
  refreshDataInBackground();

  if (isEditMode && window.hideGlobalLoader) {
    window.hideGlobalLoader();
  }
}

/**
 * Load customers from cache synchronously
 */
function loadCachedCustomers() {
  try {
    const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
    if (cached) {
      allCustomers = JSON.parse(cached);
    }
  } catch (e) {}
}

/**
 * Load products from cache synchronously
 */
function loadCachedProducts() {
  try {
    const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (cached) {
      allProducts = JSON.parse(cached);
    }
  } catch (e) {}
}

/**
 * Load kasir dropdown from cache synchronously
 */
function loadCachedKasir() {
  const select = document.getElementById("kasir");
  if (!select) return;

  let defaultValue = "";
  if (typeof getCurrentUser === "function") {
    const user = getCurrentUser();
    if (user) defaultValue = user.username;
  }

  try {
    const cached = localStorage.getItem("larosapot_users_cache");
    if (cached) {
      const users = JSON.parse(cached);
      select.innerHTML = "";
      users.forEach((user) => {
        const username = user.USERNAME || user.username || user.Username;
        if (username) {
          const option = document.createElement("option");
          option.value = username;
          option.textContent = username;
          if (
            defaultValue &&
            username.toLowerCase() === defaultValue.toLowerCase()
          ) {
            option.selected = true;
          }
          select.appendChild(option);
        }
      });
    } else if (defaultValue) {
      select.innerHTML = `<option value="${defaultValue}" selected>${defaultValue}</option>`;
    }
  } catch (e) {
    if (defaultValue) {
      select.innerHTML = `<option value="${defaultValue}" selected>${defaultValue}</option>`;
    }
  }
}

/**
 * Refresh all data in background without blocking UI
 */
async function refreshDataInBackground() {
  // Fire all requests in parallel, don't await individually
  Promise.all([
    loadCustomersForAutocomplete(),
    loadProductsForAutocomplete(),
    refreshKasirDropdown(),
  ]).catch((err) => console.warn("Background refresh error:", err));
}

/**
 * Refresh kasir dropdown in background
 */
async function refreshKasirDropdown() {
  const select = document.getElementById("kasir");
  if (!select) return;

  let defaultValue = select.value || "";
  if (!defaultValue && typeof getCurrentUser === "function") {
    const user = getCurrentUser();
    if (user) defaultValue = user.username;
  }

  try {
    const result = await fetchSheetData("USERS");
    if (result && result.data && result.data.length > 0) {
      localStorage.setItem(
        "larosapot_users_cache",
        JSON.stringify(result.data),
      );
      select.innerHTML = "";
      result.data.forEach((user) => {
        const username = user.USERNAME || user.username || user.Username;
        if (username) {
          const option = document.createElement("option");
          option.value = username;
          option.textContent = username;
          if (
            defaultValue &&
            username.toLowerCase() === defaultValue.toLowerCase()
          ) {
            option.selected = true;
          }
          select.appendChild(option);
        }
      });
    }
  } catch (error) {
    console.warn("Error refreshing kasir:", error);
  }
}

function setupCalculatorInputs() {
  const calculatorFields = ["packing", "ongkir", "diskon"];
  calculatorFields.forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.addEventListener("input", (e) => {
        const filtered = e.target.value.replace(/[^0-9=+\-*/().]/g, "");
        if (filtered !== e.target.value) {
          e.target.value = filtered;
        }
      });
    }
  });
}

/**
 * Update quotation number when date changes - Fetches from Server (PREVIEW ONLY)
 */
let isFetchingQuotation = false;

async function updateQuotationNumber() {
  const tanggalInput = document.getElementById("tanggalDibuat");
  const noPesananInput = document.getElementById("noPesanan");

  if (!tanggalInput || !noPesananInput) return;
  if (isFetchingQuotation) return; // Prevent double calls

  isFetchingQuotation = true;

  // Show loading state
  const originalValue = noPesananInput.value;
  noPesananInput.value = "Syncing...";
  noPesananInput.disabled = true;

  const selectedDate =
    tanggalInput.value || new Date().toISOString().split("T")[0];
  const dateObj = new Date(selectedDate);
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = String(dateObj.getFullYear()).slice(-2);
  const dateSuffix = `${d}${m}${y}`;

  // Default fallback
  let proposedId = `LR/QT/01/${dateSuffix}`;
  let maxSeq = 0;

  try {
    // 1. Get Server Suggestion
    const result = await DataServices.peekNextId("QT", selectedDate);
    if (result.success && result.id) {
      proposedId = result.id;
      // Extract sequence from server ID
      const parts = proposedId.split("/");
      if (parts.length >= 3) {
        maxSeq = parseInt(parts[2]) || 0;
      }
    }

    // 2. Use Server ID directly
    if (result.success && result.id) {
      noPesananInput.value = result.id;
    } else {
      noPesananInput.value = proposedId || originalValue;
    }

    // Logic removed to strictly follow Server ID
  } catch (e) {
    console.error("Error updating quotation number:", e);
    noPesananInput.value = proposedId || originalValue;
  } finally {
    noPesananInput.disabled = false;
    isFetchingQuotation = false;
  }
}

async function loadCustomersForAutocomplete() {
  // Step 1: Load from cache immediately
  try {
    const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
    if (cached) {
      allCustomers = JSON.parse(cached);
    }
  } catch (e) {}

  // Step 2: Fetch fresh data in background
  try {
    const result = await fetchSheetData(KUSTOMER_SHEET_NAME);
    if (result.data && result.data.length > 0) {
      allCustomers = result.data;
      localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(result.data));
    }
  } catch (error) {
    console.error("Error loading customers:", error);
  }
}

async function loadProductsForAutocomplete() {
  // Step 1: Load from cache immediately
  try {
    const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (cached) {
      allProducts = JSON.parse(cached);
    }
  } catch (e) {}

  // Step 2: Fetch fresh data in background
  try {
    const result = await fetchSheetData(PRODUK_SHEET_NAME);
    if (result.data && result.data.length > 0) {
      allProducts = result.data;
      localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(result.data));
    }
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

// ... Autocomplete functions (setupProductAutocomplete, showProductSuggestions, etc.) ...
// Copying standard autocomplete logic from kasir.js to ensure functionality
// To save space, I will implement them identically.

function setupProductAutocomplete() {
  const skuInput = document.getElementById("noSku");
  const suggestionList = document.getElementById("skuSuggestionList");
  if (!skuInput || !suggestionList) return;
  let debounceTimer;
  skuInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => showProductSuggestions(e.target.value),
      100,
    );
  });
  skuInput.addEventListener("focus", () => {
    if (skuInput.value.trim().length >= 1)
      showProductSuggestions(skuInput.value);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#noSku") && !e.target.closest("#skuSuggestionList"))
      hideProductSuggestions();
  });

  // Keyboard navigation for SKU
  skuInput.addEventListener("keydown", function (e) {
    let list = document.getElementById("skuSuggestionList");
    if (!list || !list.classList.contains("show")) return;

    let items = list.getElementsByClassName("suggestion-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentProductFocus++;
      addActiveProduct(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentProductFocus--;
      addActiveProduct(items);
    } else if (e.key === "Enter") {
      if (currentProductFocus > -1) {
        e.preventDefault();
        if (items[currentProductFocus]) items[currentProductFocus].click();
      }
    }
  });
}

let currentProductFocus = -1;

function addActiveProduct(x) {
  if (!x) return false;
  removeActiveProduct(x);
  if (currentProductFocus >= x.length) currentProductFocus = 0;
  if (currentProductFocus < 0) currentProductFocus = x.length - 1;
  x[currentProductFocus].classList.add("active");

  // Scroll to active item
  x[currentProductFocus].scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function removeActiveProduct(x) {
  for (let i = 0; i < x.length; i++) {
    x[i].classList.remove("active");
  }
}

function showProductSuggestions(query) {
  const suggestionList = document.getElementById("skuSuggestionList");
  if (!suggestionList) return;
  currentProductFocus = -1; // Reset focus
  query = query.trim().toUpperCase();
  if (query.length < 1) {
    hideProductSuggestions();
    return;
  }
  const matches = allProducts.filter((p) => {
    const sku = String(p["SKU"] || "").toUpperCase();
    const nama = String(p["NAMA PRODUK"] || "").toUpperCase();
    return sku.includes(query) || nama.includes(query);
  });
  suggestionList.innerHTML = "";
  if (matches.length === 0) {
    suggestionList.innerHTML = `<div class="suggestion-item no-result">Produk tidak ditemukan</div>`;
  } else {
    matches.forEach((product) => {
      const sku = product["SKU"] || "";
      const nama = product["NAMA PRODUK"] || "";
      const satuan = product["SATUAN"] || "Pcs";
      const harga = parseFloat(product["HARGA JUAL"]) || 0;
      const kategori = product["KATEGORI"] || "";
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `<div class="phone">${sku}</div><div class="name">${nama} - Rp${harga.toLocaleString(
        "id-ID",
      )}</div>`;
      item.addEventListener("click", () =>
        selectProduct(sku, nama, satuan, harga, kategori),
      );
      suggestionList.appendChild(item);
    });
  }
  suggestionList.classList.add("show");
}

function hideProductSuggestions() {
  const suggestionList = document.getElementById("skuSuggestionList");
  if (suggestionList) suggestionList.classList.remove("show");
}

function selectProduct(sku, nama, satuan, harga, kategori = "") {
  document.getElementById("noSku").value = sku;
  document.getElementById("namaProduk").value = nama;
  document.getElementById("satuan").value = satuan;
  document.getElementById("harga").value = harga;
  document.getElementById("noSku").dataset.kategori = kategori;
  hideProductSuggestions();
  hitungTotalHarga();
  document.getElementById("jumlah").focus();
}

function setupAutocomplete() {
  const noTeleponInput = document.getElementById("noTelepon");
  if (!noTeleponInput) return;
  let debounceTimer;
  noTeleponInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => showSuggestions(e.target.value), 100);
  });
  noTeleponInput.addEventListener("focus", () => {
    if (noTeleponInput.value.trim().length >= 2)
      showSuggestions(noTeleponInput.value);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container")) hideSuggestions();
  });

  // Keyboard navigation for Customer
  noTeleponInput.addEventListener("keydown", function (e) {
    let list = document.getElementById("suggestionList");
    if (!list || !list.classList.contains("show")) return;

    let items = list.getElementsByClassName("suggestion-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentFocus++;
      addActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentFocus--;
      addActive(items);
    } else if (e.key === "Enter") {
      if (currentFocus > -1) {
        e.preventDefault();
        if (items[currentFocus]) items[currentFocus].click();
      }
    }
  });
}

let currentFocus = -1;

function addActive(x) {
  if (!x) return false;
  removeActive(x);
  if (currentFocus >= x.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = x.length - 1;
  x[currentFocus].classList.add("active");

  // Scroll to active item
  x[currentFocus].scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function removeActive(x) {
  for (let i = 0; i < x.length; i++) {
    x[i].classList.remove("active");
  }
}

function normalizePhone(phone) {
  if (!phone) return "";
  phone = phone.toString().trim().replace(/[\s+]/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.substring(1);
  else if (!phone.startsWith("62")) phone = "62" + phone;
  return phone;
}

function showSuggestions(query) {
  const suggestionList = document.getElementById("suggestionList");
  if (!suggestionList) return;
  currentFocus = -1; // Reset focus
  query = query.trim();
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  const normalizedQuery = normalizePhone(query);
  const matches = allCustomers.filter((c) => {
    const phone = String(c["NO HP"] || c["NO\nHP"] || c["No HP"] || "");
    return (
      normalizePhone(phone).includes(normalizedQuery) || phone.includes(query)
    );
  });
  suggestionList.innerHTML = "";
  if (matches.length === 0) {
    suggestionList.innerHTML = `<div class="suggestion-item no-result">Pelanggan tidak ditemukan</div>`;
  } else {
    matches.forEach((customer) => {
      const phone = customer["NO HP"] || customer["NO\nHP"] || "";
      const nama =
        customer["NAMA PELANGGAN"] || customer["NAMA\nPELANGGAN"] || "";
      const alamat = customer["ALAMAT"] || customer["Alamat"] || "";
      const city = customer["KOTA"] || customer["Kota"] || "";
      const channel = customer["CHANNEL"] || customer["Channel"] || "";
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `<div class="phone">${phone}</div><div class="name">${nama}</div>`;
      item.addEventListener("click", () =>
        selectCustomer(phone, nama, alamat, city, channel),
      );
      suggestionList.appendChild(item);
    });
  }
  suggestionList.classList.add("show");
}

function hideSuggestions() {
  const suggestionList = document.getElementById("suggestionList");
  if (suggestionList) suggestionList.classList.remove("show");
}

function selectCustomer(phone, nama, alamat, kota = "", channel = "") {
  document.getElementById("noTelepon").value = phone;
  document.getElementById("namaPelanggan").value = nama;
  document.getElementById("alamatPelanggan").value = alamat;
  selectedCustomer.kota = kota;
  selectedCustomer.channel = channel;
  hideSuggestions();
}

function hitungTotalHarga() {
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  document.getElementById("totalHarga").value = jumlah * harga;
}

function setupEnterKeyListeners() {
  const jumlahInput = document.getElementById("jumlah");
  if (jumlahInput) {
    jumlahInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tambahKeKeranjang();
      }
    });
  }
}

function tambahKeKeranjang() {
  const noSku = document.getElementById("noSku").value.trim();
  const namaProduk = document.getElementById("namaProduk").value.trim();
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  const satuan = document.getElementById("satuan").value.trim();
  const kategori = document.getElementById("noSku").dataset.kategori || "";
  const totalHarga =
    parseFloat(document.getElementById("totalHarga").value) || 0;

  if (!noSku || !namaProduk || jumlah <= 0 || harga <= 0) {
    alert("Mohon lengkapi semua data produk!");
    return;
  }

  keranjangData.push({
    no: nomorUrut++,
    sku: noSku,
    produk: namaProduk,
    jumlah: jumlah,
    satuan: satuan || "Pcs",
    harga: harga,
    kategori: kategori,
    total: totalHarga,
  });

  updateTabelKeranjang();
  hitungSubtotal();

  document.getElementById("noSku").value = "";
  document.getElementById("namaProduk").value = "";
  document.getElementById("jumlah").value = "";
  document.getElementById("harga").value = "";
  document.getElementById("satuan").value = "";
  document.getElementById("totalHarga").value = "";

  // Focus back to SKU for rapid entry
  document.getElementById("noSku").focus();
}

function updateTabelKeranjang() {
  const tbody = document.getElementById("keranjangBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  keranjangData.forEach((item, index) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${item.no}</td>
      <td>${item.sku}</td>
      <td>${item.produk}</td>
      <td>
        <input type="number" 
               value="${item.jumlah}" 
               min="1" 
               style="width: 60px; padding: 2px 5px; border: 1px solid #ccc; border-radius: 4px;" 
               onchange="ubahJumlahItem(${index}, this.value)">
      </td>
      <td>${item.satuan}</td>
      <td>Rp${item.harga.toLocaleString("id-ID")}</td>
      <td>Rp${item.total.toLocaleString("id-ID")}</td>
      <td><button class="btn-remove" onclick="hapusItem(${index})">Hapus</button></td>
    `;
  });
}

function ubahJumlahItem(index, newQty) {
  const qty = parseFloat(newQty) || 0;
  if (qty <= 0) {
    alert("Jumlah harus lebih dari 0!");
    updateTabelKeranjang();
    return;
  }

  const item = keranjangData[index];
  item.jumlah = qty;
  item.total = item.jumlah * item.harga;

  updateTabelKeranjang();
  hitungSubtotal();
}

function hapusItem(index) {
  keranjangData.splice(index, 1);
  keranjangData.forEach((item, i) => (item.no = i + 1));
  nomorUrut = keranjangData.length + 1;
  updateTabelKeranjang();
  hitungSubtotal();
}

function evaluateExpression(input) {
  const value = input.value.trim();
  if (value.startsWith("=")) {
    const expression = value.substring(1);
    try {
      if (/^[\d\s+\-*/().]+$/.test(expression)) {
        const result = Function('"use strict"; return (' + expression + ")")();
        if (!isNaN(result) && isFinite(result)) {
          input.value = Math.round(result);
          return result;
        }
      }
    } catch (e) {
      console.error("Expression evaluation error:", e);
    }
  }
  return parseFloat(value) || 0;
}

function hitungSubtotal() {
  const subtotal = keranjangData.reduce((sum, item) => sum + item.total, 0);
  document.getElementById("subtotal").value = subtotal;
  hitungTotalTagihan();
}

function hitungTotalTagihan() {
  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = evaluateExpression(document.getElementById("ongkir"));
  const packing = evaluateExpression(document.getElementById("packing"));
  const diskon = evaluateExpression(document.getElementById("diskon"));
  const totalTagihan = subtotal + ongkir + packing - diskon;
  document.getElementById("totalTagihan").value = totalTagihan;
}

// Main Save Function for Quotation
async function saveQuotation() {
  if (window.isSavingQuotation) return;
  window.isSavingQuotation = true;

  if (keranjangData.length === 0) {
    alert("Keranjang masih kosong!");
    window.isSavingQuotation = false;
    return;
  }

  const namaPelanggan = document.getElementById("namaPelanggan").value.trim();
  if (!namaPelanggan) {
    alert("Silakan pilih pelanggan terlebih dahulu!");
    window.isSavingQuotation = false;
    return;
  }

  const tanggal = document.getElementById("tanggalDibuat").value;
  const noPesanan = document.getElementById("noPesanan").value;
  if (noPesanan === "Syncing...") {
    alert("Sistem sedang mengambil nomor quotation. Silakan tunggu sebentar.");
    window.isSavingQuotation = false;
    return;
  }
  const kasir = document.getElementById("kasir").value;
  const noTelepon = document.getElementById("noTelepon").value;
  const alamat = document.getElementById("alamatPelanggan").value;
  const payment = document.getElementById("paymen").value;
  const roPo = document.getElementById("roPo")?.value || "";

  // Get jenis transaksi (Online/Offline)
  const jenisTransaksi =
    document.getElementById("jenisTransaksi")?.value || "Online";

  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = parseFloat(document.getElementById("ongkir").value) || 0;
  const packing = parseFloat(document.getElementById("packing").value) || 0;
  const diskon = parseFloat(document.getElementById("diskon").value) || 0;
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;

  const formattedDate = formatDateForInvoice(tanggal);

  try {
    const btnSimpan = document.querySelector(".btn-lunas");
    if (btnSimpan) {
      btnSimpan.disabled = true;
      btnSimpan.innerText = "Menyimpan...";
    }

    // Get the actual (incremented) quotation number NOW, right before saving
    // Server-side (Atomic Counter at Google Sheet) is used as requested
    let finalNoPesanan = noPesanan;
    if (!isEditMode) {
      const idResult = await DataServices.getNextId("QT", tanggal);
      if (idResult.success) {
        finalNoPesanan = idResult.id;
        document.getElementById("noPesanan").value = finalNoPesanan;
      } else {
        throw new Error("Gagal mendapatkan nomor quotation: " + idResult.error);
      }
    }

    const rows = [];
    keranjangData.forEach((item, index) => {
      let rowData = {};
      if (index === 0) {
        rowData = {
          TANGGAL: formattedDate,
          "NO INVOICE": finalNoPesanan,
          KASIR: kasir,
          TRANSAKSI: jenisTransaksi, // Uses Online/Offline from select
          PAYMENT: payment,
          "RO/PO": roPo,
          PELANGGAN: namaPelanggan,
          "NO HP": noTelepon,
          ALAMAT: alamat,
          SKU: item.sku,
          PRODUK: item.produk,
          JUMLAH: item.jumlah,
          SATUAN: item.satuan,
          HARGA: item.harga,
          TOTAL: item.total,
          "SUB TOTAL": subtotal,
          ONGKIR: ongkir,
          PACKING: packing,
          DISKON: diskon,
          "TOTAL TAGIHAN": totalTagihan,
        };
      } else {
        rowData = {
          TANGGAL: "",
          "NO INVOICE": "",
          KASIR: "",
          TRANSAKSI: "",
          PAYMENT: "",
          PELANGGAN: "",
          "NO HP": "",
          ALAMAT: "",
          SKU: item.sku,
          PRODUK: item.produk,
          JUMLAH: item.jumlah,
          SATUAN: item.satuan,
          HARGA: item.harga,
          TOTAL: item.total,
          "SUB TOTAL": "",
          ONGKIR: "",
          PACKING: "",
          DISKON: "",
          "TOTAL TAGIHAN": "",
        };
      }
      rows.push(rowData);
    });

    for (const row of rows.reverse()) {
      const result = await addSheetRow(QUOTATION_SHEET_NAME, row);
      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan data");
      }
    }

    alert(`Quotation ${noPesanan} berhasil disimpan!`);
    resetQuotationForm();
  } catch (error) {
    console.error("Error saving quotation:", error);
    alert("Gagal menyimpan quotation: " + error.message);
  } finally {
    const btnSimpan = document.querySelector(".btn-lunas");
    if (btnSimpan) {
      btnSimpan.disabled = false;
      btnSimpan.innerText = "Simpan Quotation";
    }
    window.isSavingQuotation = false;
  }
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

  // Fallback: return as-is
  return String(dateString);
}

function resetQuotationForm() {
  document.getElementById("noTelepon").value = "";
  document.getElementById("namaPelanggan").value = "";
  document.getElementById("alamatPelanggan").value = "";
  document.getElementById("paymen").value = "";

  selectedCustomer = { kota: "", channel: "" };
  keranjangData = [];
  nomorUrut = 1;

  updateTabelKeranjang();

  document.getElementById("subtotal").value = "";
  document.getElementById("ongkir").value = "";
  document.getElementById("packing").value = "";
  document.getElementById("diskon").value = "";
  document.getElementById("totalTagihan").value = "";

  updateQuotationNumber();
}
