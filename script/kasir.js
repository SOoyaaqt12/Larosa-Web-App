/**
 * Kasir Page - Core Functions
 * Handles customer autocomplete, cart management, and calculations
 */

const INVOICE_SHEET_NAME = "INCOME";
const PELUNASAN_SHEET_NAME = "INCOME";
const KUSTOMER_SHEET_NAME = "KOSTUMER";
const QUOTATION_SHEET_NAME = "QUOTATION";

// Cart data
let keranjangData = [];
let nomorUrut = 1;

// Customer data cache for autocomplete
let allCustomers = [];
let isLoadingCustomers = false;
let selectedCustomer = { kota: "", channel: "" };

// LocalStorage cache keys
const CUSTOMER_CACHE_KEY = "larosapot_customer_cache";
const PRODUCT_CACHE_KEY = "larosapot_product_cache";

// Invoice counter storage key (stores {date: 'YYYY-MM-DD', count: number})
const INVOICE_COUNTER_KEY = "larosapot_invoice_counter";

// Checkout Mode State (Quotation -> Invoice)
let isCheckoutMode = false;
let checkoutQuotationNo = "";

// Initialize page when loaded
document.addEventListener("DOMContentLoaded", () => {
  initKasirPage();
});

/**
 * Initialize kasir page
 */
async function initKasirPage() {
  // Check for checkout mode FIRST
  const checkoutData = sessionStorage.getItem("checkoutQuotationData");

  const hasCheckoutData = !!checkoutData;
  if (hasCheckoutData && window.showGlobalLoader) {
    window.showGlobalLoader();
  }

  // Set today's date if not editing (using local timezone)
  const tanggalInput = document.getElementById("tanggalDibuat");
  if (tanggalInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    tanggalInput.value = `${year}-${month}-${day}`;
  }

  // Generate invoice number
  updateInvoiceNumber();

  // Load cached data IMMEDIATELY (non-blocking sync operations)
  loadCachedCustomers();
  loadCachedProducts();
  loadCachedKasir();

  // Setup autocomplete event listeners IMMEDIATELY (uses cached data)
  setupAutocomplete();
  setupProductAutocomplete();

  // Setup calculator input validation
  setupCalculatorInputs();
  setupEnterKeyListeners();

  // Apply checkout data if available (Quotation -> Invoice)
  checkCheckoutMode();

  // Hide loader when done (only if it was shown)
  if (hasCheckoutData && window.hideGlobalLoader) {
    window.hideGlobalLoader();
  }

  // Now refresh data in background (non-blocking)
  refreshKasirDataInBackground();
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
function refreshKasirDataInBackground() {
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

/**
 * Setup input validation for calculator fields
 * Only allows: numbers, =, +, -, *, /, (, ), .
 */
function setupCalculatorInputs() {
  const calculatorFields = ["packing", "ongkir", "diskon", "dp1", "dp2"];

  calculatorFields.forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.addEventListener("input", (e) => {
        // Only allow: numbers, =, +, -, *, /, (, ), .
        const filtered = e.target.value.replace(/[^0-9=+\-*/().]/g, "");
        if (filtered !== e.target.value) {
          e.target.value = filtered;
        }
      });
    }
  });
}

/**
 * Update invoice number when date changes - Fetches from Server
 */
let isFetchingInvoice = false;

/**
 * Update invoice number when date changes - Fetches from Server
 */
async function updateInvoiceNumber() {
  const tanggalInput = document.getElementById("tanggalDibuat");
  const noPesananInput = document.getElementById("noPesanan");

  if (!tanggalInput || !noPesananInput) return;
  if (isFetchingInvoice) return; // Prevent double calls

  isFetchingInvoice = true;

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
  let proposedId = `LR/INV/01/${dateSuffix}`;
  let maxSeq = 0;

  try {
    // 1. Get Server Suggestion
    const serverResult = await DataServices.peekNextId("INV", selectedDate);
    if (serverResult.success && serverResult.id) {
      proposedId = serverResult.id;
      // Extract sequence from server ID (expected: LR/INV/XX/DDMMYY)
      const parts = proposedId.split("/");
      if (parts.length >= 3) {
        maxSeq = parseInt(parts[2]) || 0;
      }
    }

    // 2. Use Server ID directly
    if (serverResult.success && serverResult.id) {
      noPesananInput.value = serverResult.id;
    } else {
      // Fallback
      noPesananInput.value = proposedId || originalValue;
    }

    // Logic removed to strictly follow Server ID
  } catch (e) {
    console.error("Error updating invoice number:", e);
    noPesananInput.value = proposedId || originalValue;
  } finally {
    noPesananInput.disabled = false;
    isFetchingInvoice = false;
  }
}

/**
 * Load all customers for autocomplete suggestions
 */
async function loadCustomersForAutocomplete() {
  // Step 1: Load from cache immediately for instant UI
  try {
    const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
    if (cached) {
      allCustomers = JSON.parse(cached);
      console.log(
        "Loaded",
        allCustomers.length,
        "customers from cache (instant)",
      );
    }
  } catch (e) {
    console.error("Error loading customer cache:", e);
  }

  // Step 2: Fetch fresh data in background and update cache
  try {
    const result = await fetchSheetData(KUSTOMER_SHEET_NAME);
    if (result.data && result.data.length > 0) {
      allCustomers = result.data;
      // Update cache
      try {
        localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(result.data));
      } catch (cacheError) {
        console.warn("Could not cache customer data:", cacheError);
      }
      console.log("Refreshed", allCustomers.length, "customers from server");
    }
  } catch (error) {
    console.error("Error loading customers:", error);
  }
}

// Product data cache for autocomplete
let allProducts = [];
const PRODUK_SHEET_NAME = "PERSEDIAAN BARANG";

/**
 * Load all products for autocomplete suggestions
 */
async function loadProductsForAutocomplete() {
  // Step 1: Load from cache immediately
  try {
    const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (cached) {
      allProducts = JSON.parse(cached);
      console.log(
        "Loaded",
        allProducts.length,
        "products from cache (instant)",
      );
    }
  } catch (e) {
    console.error("Error loading product cache:", e);
  }

  // Step 2: Fetch fresh data in background
  try {
    const result = await fetchSheetData(PRODUK_SHEET_NAME);
    if (result.data && result.data.length > 0) {
      allProducts = result.data;
      try {
        localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(result.data));
      } catch (cacheError) {
        console.warn("Could not cache product data:", cacheError);
      }
      console.log("Refreshed", allProducts.length, "products from server");
    }
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

/**
 * Setup product autocomplete event listeners
 */
function setupProductAutocomplete() {
  const skuInput = document.getElementById("noSku");
  const suggestionList = document.getElementById("skuSuggestionList");

  if (!skuInput || !suggestionList) return;

  let debounceTimer;

  skuInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      showProductSuggestions(e.target.value);
    }, 100); // Reduced from 200ms for faster response
  });

  skuInput.addEventListener("focus", () => {
    if (skuInput.value.trim().length >= 1) {
      showProductSuggestions(skuInput.value);
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#noSku") &&
      !e.target.closest("#skuSuggestionList")
    ) {
      hideProductSuggestions();
    }
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

/**
 * Show product suggestions based on SKU input
 */
function showProductSuggestions(query) {
  const suggestionList = document.getElementById("skuSuggestionList");
  if (!suggestionList) return;

  currentProductFocus = -1; // Reset focus
  query = query.trim().toUpperCase();

  if (query.length < 1) {
    hideProductSuggestions();
    return;
  }

  // Filter products by SKU or name
  const matches = allProducts.filter((p) => {
    const sku = String(p["SKU"] || "").toUpperCase();
    const nama = String(p["NAMA PRODUK"] || "").toUpperCase();
    return sku.includes(query) || nama.includes(query);
  });

  suggestionList.innerHTML = "";

  if (matches.length === 0) {
    suggestionList.innerHTML = `
      <div class="suggestion-item no-result">
        Produk tidak ditemukan
      </div>
    `;
  } else {
    matches.forEach((product) => {
      const sku = product["SKU"] || "";
      const nama = product["NAMA PRODUK"] || "";
      const satuan = product["SATUAN"] || "Pcs";
      const harga = parseFloat(product["HARGA JUAL"]) || 0;
      const kategori = product["KATEGORI"] || "";

      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <div class="phone">${sku}</div>
        <div class="name">${nama} - Rp${harga.toLocaleString("id-ID")}</div>
      `;

      item.addEventListener("click", () => {
        selectProduct(sku, nama, satuan, harga, kategori);
      });

      suggestionList.appendChild(item);
    });
  }

  suggestionList.classList.add("show");
}

/**
 * Hide product suggestions dropdown
 */
function hideProductSuggestions() {
  const suggestionList = document.getElementById("skuSuggestionList");
  if (suggestionList) {
    suggestionList.classList.remove("show");
  }
}

/**
 * Select a product from suggestions
 */
function selectProduct(sku, nama, satuan, harga, kategori = "") {
  document.getElementById("noSku").value = sku;
  document.getElementById("namaProduk").value = nama;
  document.getElementById("satuan").value = satuan;
  document.getElementById("harga").value = harga;

  // Store category in dataset for later use
  document.getElementById("noSku").dataset.kategori = kategori;

  hideProductSuggestions();

  // Recalculate total if jumlah already has a value
  hitungTotalHarga();

  // Focus on jumlah input
  document.getElementById("jumlah").focus();
}

/**
 * Setup autocomplete event listeners
 */
function setupAutocomplete() {
  const noTeleponInput = document.getElementById("noTelepon");
  const suggestionList = document.getElementById("suggestionList");

  if (!noTeleponInput || !suggestionList) return;

  // Debounce timer
  let debounceTimer;

  // On input, show suggestions
  noTeleponInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      showSuggestions(e.target.value);
    }, 100); // Reduced from 200ms for faster response
  });

  // On focus, show suggestions if there's input
  noTeleponInput.addEventListener("focus", () => {
    if (noTeleponInput.value.trim().length >= 2) {
      showSuggestions(noTeleponInput.value);
    }
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

  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container")) {
      hideSuggestions();
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

/**
 * Format phone number for comparison (normalize to 62xxx format)
 */
function normalizePhone(phone) {
  if (!phone) return "";
  phone = phone.toString().trim();

  // Remove + and spaces
  phone = phone.replace(/[\s+]/g, "");

  // Remove leading 0 and add 62
  if (phone.startsWith("0")) {
    phone = "62" + phone.substring(1);
  }
  // If no country code, add 62
  else if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }

  return phone;
}

/**
 * Show customer suggestions based on input
 */
function showSuggestions(query) {
  const suggestionList = document.getElementById("suggestionList");
  if (!suggestionList) return;

  currentFocus = -1; // Reset focus
  query = query.trim();

  // Need at least 2 characters
  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  const normalizedQuery = normalizePhone(query);

  // Filter customers by phone number
  const matches = allCustomers.filter((c) => {
    const phone = String(c["NO HP"] || c["NO\nHP"] || c["No HP"] || "");
    const normalizedPhone = normalizePhone(phone);
    return normalizedPhone.includes(normalizedQuery) || phone.includes(query);
  });

  // Clear and populate suggestions
  suggestionList.innerHTML = "";

  if (matches.length === 0) {
    suggestionList.innerHTML = `
      <div class="suggestion-item no-result">
        Pelanggan tidak ditemukan
      </div>
    `;
  } else {
    // Limit to 10 results
    matches.forEach((customer) => {
      const phone =
        customer["NO HP"] || customer["NO\nHP"] || customer["No HP"] || "";
      const nama =
        customer["NAMA PELANGGAN"] ||
        customer["NAMA\nPELANGGAN"] ||
        customer["Nama Pelanggan"] ||
        "";
      const alamat = customer["ALAMAT"] || customer["Alamat"] || "";

      const city = customer["KOTA"] || customer["Kota"] || "";
      const channel = customer["CHANNEL"] || customer["Channel"] || "";

      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <div class="phone">${phone}</div>
        <div class="name">${nama}</div>
      `;

      item.addEventListener("click", () => {
        selectCustomer(phone, nama, alamat, city, channel);
      });

      suggestionList.appendChild(item);
    });
  }

  suggestionList.classList.add("show");
}

/**
 * Hide suggestions dropdown
 */
function hideSuggestions() {
  const suggestionList = document.getElementById("suggestionList");
  if (suggestionList) {
    suggestionList.classList.remove("show");
  }
}

// Store selected customer details: already declared globally

/**
 * Select a customer from suggestions
 */
function selectCustomer(phone, nama, alamat, kota = "", channel = "") {
  document.getElementById("noTelepon").value = phone;
  document.getElementById("namaPelanggan").value = nama;
  document.getElementById("alamatPelanggan").value = alamat;

  // Store extra details
  selectedCustomer.kota = kota;
  selectedCustomer.channel = channel;

  hideSuggestions();
}

/**
 * Calculate total price for single item (quantity × price)
 */
function hitungTotalHarga() {
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  document.getElementById("totalHarga").value = jumlah * harga;
}

/**
 * Setup Enter key listener for adding items to cart
 */
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

/**
 * Add item to cart
 */
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

  // Clear input fields
  document.getElementById("noSku").value = "";
  document.getElementById("namaProduk").value = "";
  document.getElementById("jumlah").value = "";
  document.getElementById("harga").value = "";
  document.getElementById("satuan").value = "";
  document.getElementById("totalHarga").value = "";

  // Focus back to SKU for rapid entry
  document.getElementById("noSku").focus();
}

/**
 * Update cart table display
 */
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

/**
 * Change item quantity directly in cart
 */
function ubahJumlahItem(index, newQty) {
  const qty = parseFloat(newQty) || 0;
  if (qty <= 0) {
    alert("Jumlah harus lebih dari 0!");
    updateTabelKeranjang(); // Restore previous value
    return;
  }

  const item = keranjangData[index];
  item.jumlah = qty;
  item.total = item.jumlah * item.harga;

  updateTabelKeranjang();
  hitungSubtotal();
}

/**
 * Remove item from cart
 */
function hapusItem(index) {
  keranjangData.splice(index, 1);
  // Re-number items
  keranjangData.forEach((item, i) => {
    item.no = i + 1;
  });
  nomorUrut = keranjangData.length + 1;
  updateTabelKeranjang();
  hitungSubtotal();
}

/**
 * Evaluate math expression if it starts with '='
 * Supports: +, -, *, /
 * Example: =10000+5000 → 15000
 */
function evaluateExpression(input) {
  const value = input.value.trim();

  if (value.startsWith("=")) {
    const expression = value.substring(1); // Remove '='

    try {
      // Only allow numbers and math operators for safety
      if (/^[\d\s+\-*/().]+$/.test(expression)) {
        const result = Function('"use strict"; return (' + expression + ")")();
        if (!isNaN(result) && isFinite(result)) {
          input.value = Math.round(result); // Round to whole number
          return result;
        }
      }
    } catch (e) {
      console.error("Expression evaluation error:", e);
    }
  }

  return parseFloat(value) || 0;
}

/**
 * Calculate subtotal (sum of all item totals)
 */
function hitungSubtotal() {
  const subtotal = keranjangData.reduce((sum, item) => sum + item.total, 0);
  document.getElementById("subtotal").value = subtotal;
  hitungTotalTagihan();
}

/**
 * Calculate total tagihan (subtotal + ongkir + packing - diskon)
 */
function hitungTotalTagihan() {
  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;

  // Evaluate expressions for ongkir, packing, diskon
  const ongkirInput = document.getElementById("ongkir");
  const packingInput = document.getElementById("packing");
  const diskonInput = document.getElementById("diskon");

  const ongkir = evaluateExpression(ongkirInput);
  const packing = evaluateExpression(packingInput);
  const diskon = evaluateExpression(diskonInput);

  const totalTagihan = subtotal + ongkir + packing - diskon;
  document.getElementById("totalTagihan").value = totalTagihan;
  hitungSisaTagihan();
}

/**
 * Calculate sisa tagihan (total tagihan - DP1 - DP2 - Pelunasan)
 */
function hitungSisaTagihan() {
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;

  // Evaluate expressions for DP1, DP2, and Pelunasan
  const dp1Input = document.getElementById("dp1");
  const dp2Input = document.getElementById("dp2");
  const pelunasanInput = document.getElementById("pelunasan");

  const dp1 = evaluateExpression(dp1Input);
  const dp2 = evaluateExpression(dp2Input);
  const pelunasan = pelunasanInput ? evaluateExpression(pelunasanInput) : 0;

  const sisaTagihan = totalTagihan - (dp1 + dp2 + pelunasan);
  document.getElementById("sisaTagihan").value = sisaTagihan;
}

/**
 * Save invoice to Google Sheets
 * @param {string} status - 'DP' or 'LUNAS'
 */
async function saveInvoice(status) {
  // Flag to prevent double submission
  if (window.isSavingKasir) return;
  window.isSavingKasir = true;

  // Validate cart
  if (keranjangData.length === 0) {
    alert("Keranjang masih kosong!");
    window.isSavingKasir = false;
    return;
  }

  // Validate customer
  const namaPelanggan = document.getElementById("namaPelanggan").value.trim();
  if (!namaPelanggan) {
    alert("Silakan pilih pelanggan terlebih dahulu!");
    window.isSavingKasir = false;
    return;
  }

  // Gather invoice data
  const tanggal = document.getElementById("tanggalDibuat").value;
  const noPesanan = document.getElementById("noPesanan").value;
  if (noPesanan === "Syncing...") {
    alert("Sistem sedang mengambil nomor invoice. Silakan tunggu sebentar.");
    window.isSavingKasir = false;
    return;
  }
  const kasir = document.getElementById("kasir").value;
  const noTelepon = document.getElementById("noTelepon").value;
  const alamat = document.getElementById("alamatPelanggan").value;
  const payment = document.getElementById("paymen").value;
  const roPo = document.getElementById("roPo")?.value || "";

  if (!roPo) {
    alert("Silakan pilih RO/PO terlebih dahulu!");
    window.isSavingKasir = false;
    return;
  }

  // Get new select values
  const jenisTransaksi =
    document.getElementById("jenisTransaksi")?.value || "Online";

  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = parseFloat(document.getElementById("ongkir").value) || 0;
  const packing = parseFloat(document.getElementById("packing").value) || 0;
  const diskon = parseFloat(document.getElementById("diskon").value) || 0;
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;

  // Calculate Status & Total Paid
  let dp1 = parseFloat(document.getElementById("dp1").value) || 0;
  let dp2 = parseFloat(document.getElementById("dp2").value) || 0;
  let pelunasan = parseFloat(document.getElementById("pelunasan")?.value) || 0;
  let totalPaid = dp1 + dp2 + pelunasan;
  let sisa = totalTagihan - totalPaid;

  // Enforce Status Logic
  // If user clicked "LUNAS" but sisa > 0, we should AUTO-FILL the payment
  if (status === "LUNAS" && sisa > 0) {
    // Auto-fill DP1 with total tagihan (or remaining sisa if some was already in DP2)
    // But usually for new transaction DP1 is the main payment field.
    // Let's reset DP2 and put everything in DP1 for simplicity, or just add sisa to DP1?
    // Safest: set DP1 = totalTagihan, DP2 = 0.
    document.getElementById("dp1").value = totalTagihan;
    document.getElementById("dp2").value = 0;

    // Recalculate variables for saving
    dp1 = totalTagihan;
    dp2 = 0;
    totalPaid = totalTagihan;
    sisa = 0;
    document.getElementById("sisaTagihan").value = 0;
  }

  if (sisa <= 0) {
    status = "LUNAS"; // Auto-switch to LUNAS if fully paid
  }

  // Format date
  const formattedDate = formatDateForInvoice(tanggal);

  // Save to Google Sheets
  try {
    // Show loading state
    const btnDp = document.querySelector(".btn-dp");
    const btnLunas = document.querySelector(".btn-lunas");
    const originalDpText = btnDp ? btnDp.textContent : "";
    const originalLunasText = btnLunas ? btnLunas.textContent : "";

    if (btnDp) {
      btnDp.disabled = true;
      btnDp.textContent = "Menyimpan...";
    }
    if (btnLunas) {
      btnLunas.disabled = true;
      btnLunas.textContent = "Menyimpan...";
    }

    // Get the actual (incremented) invoice number NOW, right before saving
    // Server-side (Atomic Counter at Google Sheet) is used as requested
    let finalNoPesanan = noPesanan;
    if (!isCheckoutMode) {
      // Only get new ID for new invoices
      const idResult = await DataServices.getNextId("INV", tanggal);
      if (idResult.success) {
        finalNoPesanan = idResult.id;
        document.getElementById("noPesanan").value = finalNoPesanan;
      } else {
        throw new Error("Gagal mendapatkan nomor invoice: " + idResult.error);
      }
    }

    // Determine Save Target (Always INCOME now)
    const targetSheetName = "INCOME";

    // Data Mapping for INCOME Sheet
    // Header: DATE, CASHIER, TRANSACTION, PAYMENT, RO/PO, DP/FP, NO INVOICE, NAME, HP, CITY, CATEGORY, ITEM PRODUCT, QTY, PRICE/ITEM, ITEM*QTY, SUBTOTAL ITEM, PACKING, DELIVERY, DISCOUNT, GRAND TOTAL, TOTAL DP/FP, REMAINING BALANCE, STATUS

    const roPo = document.getElementById("roPo")?.value || "";
    // Status Logic:
    // If user clicked "Lunas" (FP) -> DP/FP = "FP", TOTAL DP/FP = GRAND TOTAL, REMAINING = 0
    // If user clicked "DP" (DP) -> DP/FP = "DP", TOTAL DP/FP = totalPaid (dp1+dp2+pelunasan), REMAINING = Grand Total - totalPaid

    let dpFpStatus = status === "LUNAS" ? "FP" : "DP";
    let finalTotalPaid = totalPaid;
    let finalRemaining = sisa;

    if (status === "LUNAS") {
      finalTotalPaid = totalTagihan;
      finalRemaining = 0;
    }

    // Build rows
    const rows = [];
    keranjangData.forEach((item, index) => {
      let rowData = {};

      // Combine SKU and Product Name for "ITEM PRODUCT" if SKU exists
      const itemProductDisplay = item.sku
        ? `[${item.sku}] ${item.produk}`
        : item.produk;

      if (index === 0) {
        rowData = {
          DATE: formattedDate,
          CASHIER: kasir,
          TRANSACTION: jenisTransaksi,
          PAYMENT: payment,
          "RO/PO": roPo,
          "DP/FP": dpFpStatus,
          "NO INVOICE": finalNoPesanan,
          NAME: namaPelanggan,
          HP: noTelepon,
          CITY: selectedCustomer.kota || "",
          CATEGORY: item.kategori || "",
          "ITEM PRODUCT": itemProductDisplay,
          QTY: item.jumlah,
          "PRICE/ITEM": item.harga,
          "ITEM*QTY": item.total,
          "SUBTOTAL ITEM": subtotal,
          PACKING: packing,
          DELIVERY: ongkir,
          DISCOUNT: diskon,
          "GRAND TOTAL": totalTagihan,
          "TOTAL DP/FP": finalTotalPaid,
          "REMAINING BALANCE": finalRemaining,
          STATUS: "Belum Dikirim",
        };
      } else {
        // Subsequent rows only contain Item details + shared identifiers if needed?
        // Usually GAS script expects full rows or handles sparse rows.
        // In previous implementation, we mapped Keys again.
        // For new structure, we should keep Meta info empty to avoid double counting in sums,
        // BUT we need DATE/NAME to identify the row?
        // User's previous structure had empty invoice numbers for secondary items?
        // Let's stick to the pattern: Fill Item details, leave transaction totals empty.

        rowData = {
          DATE: "", // Or should we repeat? Usually repeat ID/Date is better for filtering. But let's follow old pattern for now.
          CASHIER: "",
          TRANSACTION: "",
          PAYMENT: "",
          "RO/PO": "",
          "DP/FP": "",
          "NO INVOICE": "",
          NAME: "", // Leave empty?
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

    for (const row of rows.reverse()) {
      const result = await addSheetRow(targetSheetName, row);
      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan data");
      }
    }

    // Increment Transaction Logic (Only if LUNAS)
    // Logic update: Only increment if it wasn't ALREADY LUNAS.
    // If we are editing a LUNAS invoice, we shouldn't increment again.
    // But currently we can't easily track old status.
    // Exception: If origin was DATA_PELUNASAN (DP), and now LUNAS, then Increment.
    // If origin was DATA_INVOICE (LUNAS), and now LUNAS, don't increment?
    // User request: "kustomer ingin membayar... data dp yang ada di riwayat... menuju halaman kasir... lalu datanya diupdate"
    // So usually we are converting DP -> LUNAS.
    // Let's assume we increment if status is LUNAS. (Ideally backend handles idempotency)
    // Backend increments if we call it.
    if (status === "LUNAS" && noTelepon && !isCheckoutMode) {
      try {
        await incrementCustomerTransaction(noTelepon);
        console.log("Customer transaction count incremented for:", noTelepon);
      } catch (e) {
        console.error("Failed to increment customer transaction:", e);
      }
    }

    // Increment Product Sold Count (Only for new LUNAS or DP->LUNAS)
    if (status === "LUNAS" && !isCheckoutMode) {
      try {
        const soldItems = keranjangData.map((item) => ({
          sku: item.sku,
          jumlah: item.jumlah,
        }));
        await incrementProductSold(soldItems);
        console.log("Product sold count incremented");
      } catch (e) {
        console.error("Failed to increment product sold count:", e);
      }
    }

    // If this was a checkout from quotation, delete the original quotation
    console.log("Checkout mode check:", {
      isCheckoutMode,
      checkoutQuotationNo,
    });
    if (isCheckoutMode && checkoutQuotationNo) {
      try {
        console.log("Attempting to delete quotation:", checkoutQuotationNo);
        const deleteResult = await deleteInvoice(
          QUOTATION_SHEET_NAME,
          checkoutQuotationNo,
        );
        console.log("Delete result:", deleteResult);
        if (deleteResult.success) {
          console.log("Quotation deleted successfully:", checkoutQuotationNo);
        } else {
          console.warn("Failed to delete quotation:", deleteResult.error);
          alert("Warning: Quotation tidak terhapus: " + deleteResult.error);
        }
      } catch (e) {
        console.error("Error deleting quotation:", e);
        alert("Error deleting quotation: " + e.message);
        // Don't block the flow - invoice was saved successfully
      }
      // Reset checkout mode state
      isCheckoutMode = false;
      checkoutQuotationNo = "";

      // Clear quotation cache so Data Quotation page shows fresh data
      localStorage.removeItem("quotation_data_cache");
      localStorage.removeItem("quotation_cache_timestamp");
    } else {
      console.log("Not in checkout mode or no quotation number");
    }

    alert(
      `Invoice ${noPesanan} berhasil disimpan dengan status ${status} di sheet ${targetSheetName}!`,
    );

    // Prepare data for invoice page (use raw variables before reset)
    const invoiceData = {
      info: {
        noPesanan: noPesanan,
        tanggal: formattedDate,
        kasir: kasir,
        transaksi: status === "LUNAS" ? "Lunas" : status, // Or customize
        payment: payment,
        roPo: roPo,
      },
      customer: {
        nama: namaPelanggan,
        noHp: noTelepon,
        alamat: alamat,
        city: selectedCustomer.kota,
        channel: selectedCustomer.channel,
      },
      items: keranjangData.map((item) => ({
        sku: item.sku,
        produk: item.produk,
        jumlah: item.jumlah,
        satuan: item.satuan,
        harga: item.harga,
        total: item.total,
      })),
      summary: {
        subtotal: subtotal,
        ongkir: ongkir,
        packing: packing,
        diskon: diskon,
        totalTagihan: totalTagihan,
      },
    };

    // Save to sessionStorage
    sessionStorage.setItem("invoiceData", JSON.stringify(invoiceData));

    // Reset form
    resetKasirForm();

    // Redirect to invoice page
    window.location.href = "invoice.html";
  } catch (error) {
    console.error("Error saving invoice:", error);
    alert("Gagal menyimpan invoice: " + error.message);
  } finally {
    // Re-enable buttons and restore text
    const btnDp = document.querySelector(".btn-dp");
    const btnLunas = document.querySelector(".btn-lunas");
    if (btnDp) {
      btnDp.disabled = false;
      btnDp.textContent = "Simpan DP";
    }
    if (btnLunas) {
      btnLunas.disabled = false;
      btnLunas.textContent = "Simpan Lunas";
    }

    // Reset double submission flag
    setTimeout(() => {
      window.isSavingKasir = false;
    }, 1000);
  }
}

/**
 * Format date for invoice (DD-Mon-YYYY)
 * Uses string parsing to avoid timezone issues
 */
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
  const ddMonYYYY = dateString.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMonYYYY) {
    return `${ddMonYYYY[1].padStart(2, "0")}-${ddMonYYYY[2]}-${ddMonYYYY[3]}`;
  }

  // If in YYYY-MM-DD format (from HTML date input)
  const ymd = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const monthIdx = parseInt(ymd[2], 10) - 1;
    return `${ymd[3]}-${monthNames[monthIdx]}-${ymd[1]}`;
  }

  // Fallback: return as-is
  return dateString;
}

/**
 * Reset kasir form after successful save
 */
function resetKasirForm() {
  // Reset customer info
  document.getElementById("noTelepon").value = "";
  document.getElementById("namaPelanggan").value = "";
  document.getElementById("alamatPelanggan").value = "";
  document.getElementById("paymen").value = "";
  const roPoEl = document.getElementById("roPo");
  if (roPoEl) roPoEl.value = "";

  // Reset selected customer
  selectedCustomer = { kota: "", channel: "" };

  // Reset cart
  keranjangData = [];
  nomorUrut = 1;
  updateTabelKeranjang();

  // Reset calculations
  document.getElementById("subtotal").value = "";
  document.getElementById("ongkir").value = "";
  document.getElementById("packing").value = "";
  document.getElementById("diskon").value = "";
  document.getElementById("totalTagihan").value = "";
  document.getElementById("dp1").value = "";
  document.getElementById("dp2").value = "";
  document.getElementById("sisaTagihan").value = "";

  // Generate new invoice number
  updateInvoiceNumber();
}

/**
 * Check if we are in Checkout Mode (Quotation -> Invoice)
 * Populates form but keeps the quotation number
 */
function checkCheckoutMode() {
  const checkoutDataString = sessionStorage.getItem("checkoutQuotationData");
  if (!checkoutDataString) return;

  try {
    const checkoutData = JSON.parse(checkoutDataString);
    sessionStorage.removeItem("checkoutQuotationData"); // Clear after use

    // Set checkout mode state
    isCheckoutMode = true;
    checkoutQuotationNo = checkoutData.info.noPesanan;

    // Generate a fresh sequential invoice number for this checkout
    updateInvoiceNumber();

    // Set today's date for the new invoice
    const tanggalInput = document.getElementById("tanggalDibuat");
    if (tanggalInput) {
      tanggalInput.valueAsDate = new Date();
    }

    // Set Customer
    document.getElementById("namaPelanggan").value = checkoutData.customer.nama;
    document.getElementById("noTelepon").value = checkoutData.customer.noHp;
    document.getElementById("alamatPelanggan").value =
      checkoutData.customer.alamat || "";
    selectedCustomer.kota = checkoutData.customer.city || "";
    selectedCustomer.channel = checkoutData.customer.channel || "";

    // Set Payment method if available
    if (checkoutData.info.payment) {
      document.getElementById("paymen").value = checkoutData.info.payment;
    }

    // Set Cart
    keranjangData = [];
    nomorUrut = 1;

    checkoutData.items.forEach((item) => {
      keranjangData.push({
        no: nomorUrut++,
        sku: item.sku,
        produk: item.produk,
        jumlah: item.jumlah,
        satuan: item.satuan,
        harga: item.harga,
        total: item.total,
        kategori: item.kategori || "",
      });
    });

    updateTabelKeranjang();

    // Set Totals
    document.getElementById("subtotal").value = checkoutData.summary.subtotal;
    document.getElementById("ongkir").value = checkoutData.summary.ongkir;
    document.getElementById("packing").value = checkoutData.summary.packing;
    document.getElementById("diskon").value = checkoutData.summary.diskon;

    hitungTotalTagihan();

    console.log("Checkout mode: Loaded quotation data for invoice conversion");
  } catch (e) {
    console.error("Error loading checkout data:", e);
  }
}

function formatDateForInput(dateString) {
  // Get today's date in local timezone for fallback
  const today = new Date();
  const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (!dateString) return todayFormatted;

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

  // Try dash-separated format first: "4-Feb-2026" or "16-Dec-2025"
  let parts = dateString.split("-");
  if (parts.length === 3 && months[parts[1]]) {
    const day = parts[0].padStart(2, "0");
    return `${parts[2]}-${months[parts[1]]}-${day}`;
  }

  // Try space-separated format: "4 Feb 2026"
  parts = dateString.split(" ");
  if (parts.length === 3 && months[parts[1]]) {
    const day = parts[0].padStart(2, "0");
    return `${parts[2]}-${months[parts[1]]}-${day}`;
  }

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Fallback to today's local date (avoid Date object parsing to prevent timezone issues)
  return todayFormatted;
}
