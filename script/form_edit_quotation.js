/**
 * Edit Quotation Logic
 */

const QUOTATION_SHEET_NAME = "QUOTATION";
const KUSTOMER_SHEET_NAME = "KOSTUMER";
const PRODUK_SHEET_NAME = "PERSEDIAAN BARANG";

// State
let keranjangData = [];
let nomorUrut = 1;
let allCustomers = [];
let allProducts = [];
let selectedCustomer = { kota: "", channel: "" };
let editOriginalOrderNo = "";

// LocalStorage cache keys
const CUSTOMER_CACHE_KEY = "larosapot_customer_cache";
const PRODUCT_CACHE_KEY = "larosapot_product_cache";

document.addEventListener("DOMContentLoaded", () => {
  initEditPage();
});

async function initEditPage() {
  const editDataString = sessionStorage.getItem("editQuotationData");
  if (!editDataString) {
    alert("Data edit tidak ditemukan!");
    window.history.back();
    return;
  }

  const editData = JSON.parse(editDataString);

  // Step 1: Load cached data IMMEDIATELY (non-blocking sync operations)
  loadCachedCustomers();
  loadCachedProducts();
  loadCachedKasir(editData.info.kasir);

  // Step 2: Setup and Populate UI immediately
  setupAutocomplete();
  setupProductAutocomplete();
  setupCalculatorInputs();
  setupEnterKeyListeners();

  populateForm(editData);

  // Step 3: Refresh data in background (non-blocking)
  refreshDataInBackground(editData.info.kasir);
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
function loadCachedKasir(defaultKasir) {
  const select = document.getElementById("kasir");
  if (!select) return;

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
            defaultKasir &&
            username.toLowerCase() === defaultKasir.toLowerCase()
          ) {
            option.selected = true;
          }
          select.appendChild(option);
        }
      });
    } else if (defaultKasir) {
      select.innerHTML = `<option value="${defaultKasir}" selected>${defaultKasir}</option>`;
    }
  } catch (e) {
    if (defaultKasir) {
      select.innerHTML = `<option value="${defaultKasir}" selected>${defaultKasir}</option>`;
    }
  }
}

/**
 * Refresh all data in background without blocking UI
 */
function refreshDataInBackground(defaultKasir) {
  Promise.all([
    loadCustomersForAutocomplete(),
    loadProductsForAutocomplete(),
    refreshKasirDropdown(defaultKasir),
  ]).catch((err) => console.warn("Background refresh error:", err));
}

/**
 * Refresh kasir dropdown in background
 */
async function refreshKasirDropdown(defaultKasir) {
  const select = document.getElementById("kasir");
  if (!select) return;

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
            defaultKasir &&
            username.toLowerCase() === defaultKasir.toLowerCase()
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

function populateForm(editData) {
  editOriginalOrderNo = editData.info.noPesanan;

  document.getElementById("tanggalDibuat").value = formatDateForInput(
    editData.info.tanggal,
  );
  document.getElementById("noPesanan").value = editData.info.noPesanan;
  document.getElementById("kasir").value = editData.info.kasir;
  document.getElementById("paymen").value = editData.info.payment || "Transfer";
  document.getElementById("jenisTransaksi").value =
    editData.info.transaksi || "Online";

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
      kategori: item.kategori || "",
    });
  });
  updateTabelKeranjang();

  // Totals
  document.getElementById("subtotal").value = editData.summary.subtotal;
  document.getElementById("ongkir").value = editData.summary.ongkir;
  document.getElementById("packing").value = editData.summary.packing;
  document.getElementById("diskon").value = editData.summary.diskon;
  document.getElementById("totalTagihan").value = editData.summary.totalTagihan;
}

async function loadCustomersForAutocomplete() {
  try {
    const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
    if (cached) allCustomers = JSON.parse(cached);
  } catch (e) {}

  try {
    const result = await fetchSheetData(KUSTOMER_SHEET_NAME);
    if (result.data) {
      allCustomers = result.data;
      localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(result.data));
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadProductsForAutocomplete() {
  try {
    const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (cached) allProducts = JSON.parse(cached);
  } catch (e) {}

  try {
    const result = await fetchSheetData(PRODUK_SHEET_NAME);
    if (result.data) {
      allProducts = result.data;
      localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(result.data));
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
            .includes(val.toLowerCase()),
      )
      .slice(0, 10);

    list.innerHTML = "";
    matches.forEach((c) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `<div class="phone">${c["NO HP"]}</div><div class="name">${c["NAMA PELANGGAN"]}</div>`;
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

  input.addEventListener("keydown", (e) => {
    const items = list.getElementsByClassName("suggestion-item");
    if (!list.classList.contains("show")) return;

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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container"))
      list.classList.remove("show");
  });
}

let currentFocus = -1;
function addActive(x) {
  if (!x) return false;
  removeActive(x);
  if (currentFocus >= x.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = x.length - 1;
  x[currentFocus].classList.add("active");
  x[currentFocus].scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function removeActive(x) {
  for (let i = 0; i < x.length; i++) x[i].classList.remove("active");
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
            .includes(val),
      )
      .slice(0, 10);

    list.innerHTML = "";
    matches.forEach((p) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `<div class="phone">${p["SKU"]}</div><div class="name">${p["NAMA PRODUK"]} - Rp${(parseFloat(p["HARGA JUAL"]) || 0).toLocaleString("id-ID")}</div>`;
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

  input.addEventListener("keydown", (e) => {
    const items = list.getElementsByClassName("suggestion-item");
    if (!list.classList.contains("show")) return;

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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container"))
      list.classList.remove("show");
  });
}

let currentProductFocus = -1;
function addActiveProduct(x) {
  if (!x) return false;
  removeActiveProduct(x);
  if (currentProductFocus >= x.length) currentProductFocus = 0;
  if (currentProductFocus < 0) currentProductFocus = x.length - 1;
  x[currentProductFocus].classList.add("active");
  x[currentProductFocus].scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}
function removeActiveProduct(x) {
  for (let i = 0; i < x.length; i++) x[i].classList.remove("active");
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
  document.getElementById("noSku").focus();
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
            <td>
                <input type="number" 
                       value="${item.jumlah}" 
                       min="1" 
                       style="width: 60px; padding: 2px 5px; border: 1px solid #ccc; border-radius: 4px;" 
                       onchange="ubahJumlahItem(${idx}, this.value)">
            </td>
            <td>${item.satuan}</td>
            <td>Rp${item.harga.toLocaleString()}</td>
            <td>Rp${item.total.toLocaleString()}</td>
            <td><button class="btn-remove" onclick="hapusItem(${idx})">Hapus</button></td>
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
  ["packing", "ongkir", "diskon"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9=+\-*/().]/g, "");
      });
  });
}

function cancelEdit() {
  sessionStorage.removeItem("editQuotationData");
  window.history.back();
}

let isProcessing = false;
async function saveEditQuotation() {
  if (isProcessing) return;

  if (keranjangData.length === 0) {
    alert("Keranjang kosong!");
    return;
  }

  isProcessing = true;
  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    // 1. Delete Old Entry
    const deleteRes = await deleteInvoice(
      QUOTATION_SHEET_NAME,
      editOriginalOrderNo,
    );
    if (!deleteRes.success)
      throw new Error("Gagal menghapus data lama: " + deleteRes.error);

    // 2. Build New Rows
    const rows = [];
    const info = {
      noPesanan: document.getElementById("noPesanan").value,
      tanggal: document.getElementById("tanggalDibuat").value,
      kasir: document.getElementById("kasir").value,
      transaksi: document.getElementById("jenisTransaksi").value,
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
      if (idx === 0) {
        rowData = {
          TANGGAL: formattedDate,
          "NO INVOICE": info.noPesanan,
          KASIR: info.kasir,
          TRANSAKSI: info.transaksi,
          PAYMENT: info.payment,
          PELANGGAN: cust.nama,
          "NO HP": cust.hp,
          ALAMAT: cust.alamat,
          SKU: item.sku,
          PRODUK: item.produk,
          JUMLAH: item.jumlah,
          SATUAN: item.satuan,
          HARGA: item.harga,
          TOTAL: item.total,
          "SUB TOTAL": sum.sub,
          ONGKIR: sum.ong,
          PACKING: sum.pack,
          DISKON: sum.disc,
          "TOTAL TAGIHAN": sum.tot,
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
        };
      }
      rows.push(rowData);
    });

    // 3. Save
    for (const row of rows.reverse()) {
      const saveRes = await addSheetRow(QUOTATION_SHEET_NAME, row);
      if (!saveRes.success)
        throw new Error(saveRes.error || "Gagal menyimpan data");
    }

    alert("Perubahan quotation berhasil disimpan!");
    sessionStorage.removeItem("editQuotationData");

    // Clear cache so the list page shows fresh data
    if (window.IDBCache) {
      await window.IDBCache.clear("quotation_data_cache");
    }

    window.location.href = "data_quotation.html";
  } catch (e) {
    console.error("Save Error", e);
    alert("Gagal menyimpan: " + e.message);
    isProcessing = false;
  } finally {
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function formatDateForInput(dateVal) {
  const toLocalISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (!dateVal) return toLocalISO(new Date());

  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime())
      ? toLocalISO(new Date())
      : toLocalISO(dateVal);
  }

  const str = String(dateVal).trim();

  if (str.includes("T")) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return toLocalISO(d);
  }

  const ym = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, "0")}-${ym[3].padStart(2, "0")}`;

  const dm = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;

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
  const dmon = str.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3})[-/ ](\d{4})/);
  if (dmon && months[dmon[2]])
    return `${dmon[3]}-${months[dmon[2]]}-${dmon[1].padStart(2, "0")}`;

  const d = new Date(str);
  if (!isNaN(d.getTime())) return toLocalISO(d);

  return toLocalISO(new Date());
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
