/**
 * Kasir Page - Core Functions
 * Handles customer autocomplete, cart management, and calculations
 */

const KUSTOMER_SHEET_NAME = "KOSTUMER";

// Cart data
let keranjangData = [];
let nomorUrut = 1;

// Customer data cache for autocomplete
let allCustomers = [];

// Invoice counter storage key (stores {date: 'YYYY-MM-DD', count: number})
const INVOICE_COUNTER_KEY = "larosapot_invoice_counter";

// Initialize page when loaded
document.addEventListener("DOMContentLoaded", () => {
  initKasirPage();
});

/**
 * Initialize kasir page
 */
async function initKasirPage() {
  // Set today's date
  const tanggalInput = document.getElementById("tanggalDibuat");
  if (tanggalInput) {
    tanggalInput.valueAsDate = new Date();
  }

  // Generate invoice number
  updateInvoiceNumber();

  // Set kasir name from logged-in user
  const kasirInput = document.getElementById("kasir");
  if (kasirInput && typeof getCurrentUser === "function") {
    const user = getCurrentUser();
    if (user && user.username) {
      kasirInput.value = user.username;
    }
  }

  // Load customers for autocomplete
  await loadCustomersForAutocomplete();

  // Load products for autocomplete
  await loadProductsForAutocomplete();

  // Setup autocomplete event listeners
  setupAutocomplete();
  setupProductAutocomplete();
}

/**
 * Get invoice counter for a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {number} - Current counter for that date
 */
function getInvoiceCounter(dateString) {
  try {
    const stored = localStorage.getItem(INVOICE_COUNTER_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === dateString) {
        return data.count;
      }
    }
  } catch (e) {
    console.error("Error reading invoice counter:", e);
  }
  // New day or no data - start at 1
  return 1;
}

/**
 * Increment and save invoice counter for today
 * @param {string} dateString - Date in YYYY-MM-DD format
 */
function incrementInvoiceCounter(dateString) {
  const currentCount = getInvoiceCounter(dateString);
  try {
    localStorage.setItem(
      INVOICE_COUNTER_KEY,
      JSON.stringify({
        date: dateString,
        count: currentCount + 1,
      })
    );
  } catch (e) {
    console.error("Error saving invoice counter:", e);
  }
}

/**
 * Generate invoice number based on date
 * Format: LR/INV/NOPESANAN/DDMMYY
 * NOPESANAN = order sequence (padded to 2 digits)
 * DD = day (2 digits)
 * MM = month (2 digits)
 * YY = year last 2 digits
 */
function generateInvoiceNumber(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  // Get date string for counter lookup
  const dateString = `${date.getFullYear()}-${month}-${day}`;
  const orderNum = getInvoiceCounter(dateString);
  const orderNumPadded = String(orderNum).padStart(2, "0");

  return `LR/INV/${orderNumPadded}/${day}${month}${year}`;
}

/**
 * Update invoice number when date changes
 */
function updateInvoiceNumber() {
  const tanggalInput = document.getElementById("tanggalDibuat");
  const noPesananInput = document.getElementById("noPesanan");

  if (!tanggalInput || !noPesananInput) return;

  const selectedDate = tanggalInput.valueAsDate || new Date();
  const invoiceNumber = generateInvoiceNumber(selectedDate);
  noPesananInput.value = invoiceNumber;
}

/**
 * Load all customers for autocomplete suggestions
 */
async function loadCustomersForAutocomplete() {
  try {
    const result = await fetchSheetData(KUSTOMER_SHEET_NAME);
    if (result.data && result.data.length > 0) {
      allCustomers = result.data;
      console.log("Loaded", allCustomers.length, "customers for autocomplete");
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
  try {
    const result = await fetchSheetData(PRODUK_SHEET_NAME);
    if (result.data && result.data.length > 0) {
      allProducts = result.data;
      console.log("Loaded", allProducts.length, "products for autocomplete");
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
    }, 200);
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
}

/**
 * Show product suggestions based on SKU input
 */
function showProductSuggestions(query) {
  const suggestionList = document.getElementById("skuSuggestionList");
  if (!suggestionList) return;

  query = query.trim().toUpperCase();

  if (query.length < 1) {
    hideProductSuggestions();
    return;
  }

  // Filter products by SKU or name
  const matches = allProducts.filter((p) => {
    const sku = (p["SKU"] || "").toUpperCase();
    const nama = (p["NAMA PRODUK"] || "").toUpperCase();
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
    matches.slice(0, 10).forEach((product) => {
      const sku = product["SKU"] || "";
      const nama = product["NAMA PRODUK"] || "";
      const satuan = product["SATUAN"] || "Pcs";
      const harga = parseFloat(product["HARGA JUAL"]) || 0;

      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <div class="phone">${sku}</div>
        <div class="name">${nama} - Rp${harga.toLocaleString("id-ID")}</div>
      `;

      item.addEventListener("click", () => {
        selectProduct(sku, nama, satuan, harga);
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
function selectProduct(sku, nama, satuan, harga) {
  document.getElementById("noSku").value = sku;
  document.getElementById("namaProduk").value = nama;
  document.getElementById("satuan").value = satuan;
  document.getElementById("harga").value = harga;
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
    }, 200);
  });

  // On focus, show suggestions if there's input
  noTeleponInput.addEventListener("focus", () => {
    if (noTeleponInput.value.trim().length >= 2) {
      showSuggestions(noTeleponInput.value);
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container")) {
      hideSuggestions();
    }
  });
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

  query = query.trim();

  // Need at least 2 characters
  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  const normalizedQuery = normalizePhone(query);

  // Filter customers by phone number
  const matches = allCustomers.filter((c) => {
    const phone = c["NO HP"] || c["NO\nHP"] || c["No HP"] || "";
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
    matches.slice(0, 10).forEach((customer) => {
      const phone =
        customer["NO HP"] || customer["NO\nHP"] || customer["No HP"] || "";
      const nama =
        customer["NAMA PELANGGAN"] ||
        customer["NAMA\nPELANGGAN"] ||
        customer["Nama Pelanggan"] ||
        "";
      const alamat = customer["ALAMAT"] || customer["Alamat"] || "";

      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <div class="phone">${phone}</div>
        <div class="name">${nama}</div>
      `;

      item.addEventListener("click", () => {
        selectCustomer(phone, nama, alamat);
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

/**
 * Select a customer from suggestions
 */
function selectCustomer(phone, nama, alamat) {
  document.getElementById("noTelepon").value = phone;
  document.getElementById("namaPelanggan").value = nama;
  document.getElementById("alamatPelanggan").value = alamat;
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
 * Add item to cart
 */
function tambahKeKeranjang() {
  const noSku = document.getElementById("noSku").value.trim();
  const namaProduk = document.getElementById("namaProduk").value.trim();
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  const satuan = document.getElementById("satuan").value.trim();
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
      <td>${item.jumlah}</td>
      <td>${item.satuan}</td>
      <td>Rp${item.harga.toLocaleString("id-ID")}</td>
      <td>Rp${item.total.toLocaleString("id-ID")}</td>
      <td><button class="btn-remove" onclick="hapusItem(${index})">Hapus</button></td>
    `;
  });
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
  const ongkir = parseFloat(document.getElementById("ongkir").value) || 0;
  const packing = parseFloat(document.getElementById("packing").value) || 0;
  const diskon = parseFloat(document.getElementById("diskon").value) || 0;

  const totalTagihan = subtotal + ongkir + packing - diskon;
  document.getElementById("totalTagihan").value = totalTagihan;
  hitungSisaTagihan();
}

/**
 * Calculate sisa tagihan (total tagihan - DP1 - DP2)
 */
function hitungSisaTagihan() {
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;
  const dp1 = parseFloat(document.getElementById("dp1").value) || 0;
  const dp2 = parseFloat(document.getElementById("dp2").value) || 0;

  const sisaTagihan = totalTagihan - (dp1 + dp2);
  document.getElementById("sisaTagihan").value = sisaTagihan;
}
