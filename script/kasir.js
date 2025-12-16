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

// Edit Mode State
let isEditMode = false;
let editOriginalOrderNo = "";

// Initialize page when loaded
document.addEventListener("DOMContentLoaded", () => {
  initKasirPage();
});

/**
 * Initialize kasir page
 */
async function initKasirPage() {
  // Show loader immediately
  if (window.showGlobalLoader) window.showGlobalLoader();

  // Check for edit mode FIRST
  const editData = sessionStorage.getItem("editInvoiceData");

  // Set today's date if not editing
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

  // Setup calculator input validation
  setupCalculatorInputs();

  // Apply edit data if available
  checkEditMode();

  // Hide loader when done
  if (window.hideGlobalLoader) window.hideGlobalLoader();
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
    matches.slice(0, 10).forEach((product) => {
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
    matches.slice(0, 10).forEach((customer) => {
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

// Store selected customer details
let selectedCustomer = {
  kota: "",
  channel: "",
};

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
 * Calculate sisa tagihan (total tagihan - DP1 - DP2)
 */
function hitungSisaTagihan() {
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;

  // Evaluate expressions for DP1 and DP2
  const dp1Input = document.getElementById("dp1");
  const dp2Input = document.getElementById("dp2");

  const dp1 = evaluateExpression(dp1Input);
  const dp2 = evaluateExpression(dp2Input);

  const sisaTagihan = totalTagihan - (dp1 + dp2);
  document.getElementById("sisaTagihan").value = sisaTagihan;
}

const INVOICE_SHEET_NAME = "DATA_INVOICE";

/**
 * Save invoice to Google Sheets
 * @param {string} status - 'DP' or 'LUNAS'
 */
async function saveInvoice(status) {
  // Validate cart
  if (keranjangData.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }

  // Validate customer
  const namaPelanggan = document.getElementById("namaPelanggan").value.trim();
  if (!namaPelanggan) {
    alert("Silakan pilih pelanggan terlebih dahulu!");
    return;
  }

  // Gather invoice data
  const tanggal = document.getElementById("tanggalDibuat").value;
  const noPesanan = document.getElementById("noPesanan").value;
  const kasir = document.getElementById("kasir").value;
  const noTelepon = document.getElementById("noTelepon").value;
  const alamat = document.getElementById("alamatPelanggan").value;
  const payment = document.getElementById("paymen").value;

  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = parseFloat(document.getElementById("ongkir").value) || 0;
  const packing = parseFloat(document.getElementById("packing").value) || 0;
  const diskon = parseFloat(document.getElementById("diskon").value) || 0;
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;

  // Format date
  const formattedDate = formatDateForInvoice(tanggal);

  // Build rows for each product
  const rows = [];

  keranjangData.forEach((item, index) => {
    if (index === 0) {
      // First row: full data
      rows.push({
        TANGGAL: formattedDate,
        "NO PESANAN": noPesanan,
        KASIR: kasir,
        TRANSAKSI: status,
        PAYMENT: payment,
        "NAMA PELANGGAN": namaPelanggan,
        "NO HP": noTelepon,
        ALAMAT: alamat,
        KOTA: selectedCustomer.kota || "",
        CHANNEL: selectedCustomer.channel || "",
        KATEGORI: item.kategori || "",
        SKU: item.sku,
        PRODUK: item.produk,
        JUMLAH: item.jumlah,
        SATUAN: item.satuan,
        HARGA: item.harga,
        TOTAL: item.total,
        SUBTOTAL: subtotal,
        ONGKIR: ongkir,
        PACKING: packing,
        DISKON: diskon,
        "TOTAL TAGIHAN": totalTagihan,
      });
    } else {
      // Subsequent rows: only product data
      rows.push({
        TANGGAL: "",
        "NO PESANAN": "",
        KASIR: "",
        TRANSAKSI: "",
        PAYMENT: "",
        "NAMA PELANGGAN": "",
        "NO HP": "",
        ALAMAT: "",
        KOTA: "",
        CHANNEL: "",
        KATEGORI: item.kategori || "",
        SKU: item.sku,
        PRODUK: item.produk,
        JUMLAH: item.jumlah,
        SATUAN: item.satuan,
        HARGA: item.harga,
        TOTAL: item.total,
        SUBTOTAL: "",
        ONGKIR: "",
        PACKING: "",
        DISKON: "",
        "TOTAL TAGIHAN": "",
      });
    }
  });

  // Save to Google Sheets
  try {
    // Show loading
    const btnDp = document.querySelector(".btn-dp");
    const btnLunas = document.querySelector(".btn-lunas");
    if (btnDp) btnDp.disabled = true;
    if (btnLunas) btnLunas.disabled = true;

    // Save each row (reversed order so the first row ends up at the top)
    // Save each row (reversed order so the first row ends up at the top)
    if (isEditMode && editOriginalOrderNo) {
      // If in edit mode, delete original invoice first
      // We only do this if we are saving successfully
      // However, if we delete then fail to save, data is lost.
      // Ideally we should update, but our structure (split rows) makes update hard.
      // Atomic transaction not supported, so we delete first.
      const deleteResult = await deleteInvoice(
        INVOICE_SHEET_NAME,
        editOriginalOrderNo
      );
      if (!deleteResult.success) {
        throw new Error("Gagal menghapus invoice lama: " + deleteResult.error);
      }
    }

    for (const row of rows.reverse()) {
      const result = await addSheetRow(INVOICE_SHEET_NAME, row);
      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan data");
      }
    }

    // Increment invoice counter for today
    const selectedDate =
      document.getElementById("tanggalDibuat").valueAsDate || new Date();
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const dateString = `${selectedDate.getFullYear()}-${month}-${day}`;
    incrementInvoiceCounter(dateString);

    alert(`Invoice ${noPesanan} berhasil disimpan dengan status ${status}!`);

    // Prepare data for invoice page (use raw variables before reset)
    const invoiceData = {
      info: {
        noPesanan: noPesanan,
        tanggal: formattedDate,
        kasir: kasir,
        transaksi: status === "LUNAS" ? "Lunas" : status, // Or customize
        payment: payment,
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
    // Re-enable buttons
    const btnDp = document.querySelector(".btn-dp");
    const btnLunas = document.querySelector(".btn-lunas");
    if (btnDp) btnDp.disabled = false;
    if (btnLunas) btnLunas.disabled = false;
  }
}

/**
 * Format date for invoice (DD-Mon-YYYY)
 */
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

/**
 * Reset kasir form after successful save
 */
function resetKasirForm() {
  // Reset customer info
  document.getElementById("noTelepon").value = "";
  document.getElementById("namaPelanggan").value = "";
  document.getElementById("alamatPelanggan").value = "";
  document.getElementById("paymen").value = "";

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

  // Reset edit mode
  isEditMode = false;
  editOriginalOrderNo = "";
}

/**
 * Check if we are in Edit Mode and populate form
 */
function checkEditMode() {
  const editDataString = sessionStorage.getItem("editInvoiceData");
  if (!editDataString) return;

  try {
    const editData = JSON.parse(editDataString);
    sessionStorage.removeItem("editInvoiceData"); // Clear after use

    isEditMode = true;
    editOriginalOrderNo = editData.info.noPesanan;

    // Set Fields
    document.getElementById("tanggalDibuat").value = formatDateForInput(
      editData.info.tanggal
    ); // Need helper for DD-Mon-YYYY to YYYY-MM-DD
    // Or if saved as DD-Mon-YYYY, input type=date expects YYYY-MM-DD.
    // Our formatDateForInvoice makes it DD-Mon-YYYY.
    // We need to parse it back.

    document.getElementById("noPesanan").value = editData.info.noPesanan;
    document.getElementById("kasir").value = editData.info.kasir;
    document.getElementById("paymen").value =
      editData.info.payment || "Transfer"; // Default?

    // Set Customer
    document.getElementById("namaPelanggan").value = editData.customer.nama;
    document.getElementById("noTelepon").value = editData.customer.noHp;
    document.getElementById("alamatPelanggan").value = editData.customer.alamat;
    selectedCustomer.kota = editData.customer.city;
    selectedCustomer.channel = editData.customer.channel;

    // Set Cart
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
        kategori: item.kategori, // Ensure this is carried over
      });
    });

    updateTabelKeranjang();

    // Set Totals
    document.getElementById("subtotal").value = editData.summary.subtotal;
    document.getElementById("ongkir").value = editData.summary.ongkir;
    document.getElementById("packing").value = editData.summary.packing;
    document.getElementById("diskon").value = editData.summary.diskon;

    hitungTotalTagihan();
  } catch (e) {
    console.error("Error loading edit data:", e);
  }
}

function formatDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split("T")[0];
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
  // Input: 16-Dec-2025
  const parts = dateString.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${months[parts[1]]}-${parts[0]}`;
  }
  return dateString;
}
