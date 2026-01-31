/**
 * Form Restock (Pembelian Barang) - Logic
 */

let allVendors = [];
let allProducts = [];
let keranjangData = [];
let nomorUrut = 1;

document.addEventListener("DOMContentLoaded", () => {
  initRestockPage();
});

async function initRestockPage() {
  // Set today's date
  const dateInput = document.getElementById("tanggalPembelian");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  dateInput.value = `${year}-${month}-${day}`;

  // Generate Initial Invoice No
  updatePurchaseInvoiceNumber();

  // Load data for autocomplete
  loadVendors();
  loadProducts();

  // Setup Event Listeners
  setupVendorAutocomplete();
  setupProductAutocomplete();
}

/**
 * Generate Invoice No: LR/SJ/xx/ddmmyy
 */
function updatePurchaseInvoiceNumber() {
  const dateInput = document.getElementById("tanggalPembelian");
  const date = new Date(dateInput.value);
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);

  // For simulation, we use a more unique counter based on time
  const now = new Date();
  const counter = String(now.getSeconds() + now.getMilliseconds())
    .slice(-2)
    .padStart(2, "0");
  document.getElementById("noInvoice").value = `LR/SJ/${counter}/${d}${m}${y}`;
}

/**
 * Load Vendors from DataService
 */
async function loadVendors() {
  allVendors = await DataServices.vendor.loadData({
    onRender: () => {}, // Silent load
  });
}

/**
 * Load Products from DataService
 */
async function loadProducts() {
  allProducts = await DataServices.product.loadData({
    onRender: () => {}, // Silent load
  });
}

/**
 * Vendor Autocomplete
 */
let currentVendorFocus = -1;

function setupVendorAutocomplete() {
  const input = document.getElementById("noHpVendor");
  const list = document.getElementById("vendorSuggestionList");

  input.addEventListener("input", (e) => {
    const query = e.target.value.trim().toLowerCase();
    currentVendorFocus = -1;
    if (query.length < 2) {
      list.classList.remove("show");
      return;
    }

    const matches = allVendors.filter((v) => {
      const phone = String(v["NO HP"] || "").toLowerCase();
      const name = getValueFromKeys(
        v,
        ["NAMA\nVENDOR", "NAMA VENDOR"],
        "",
      ).toLowerCase();
      return phone.includes(query) || name.includes(query);
    });

    list.innerHTML = "";
    matches.forEach((v) => {
      const name = getValueFromKeys(
        v,
        ["NAMA\nVENDOR", "NAMA VENDOR"],
        v["VENDOR"] || "Vendor",
      );
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `<strong>${v["NO HP"]}</strong> - ${name}`;
      item.onclick = () => selectVendor(v);
      list.appendChild(item);
    });
    list.classList.add("show");
  });

  input.addEventListener("keydown", (e) => {
    const items = list.getElementsByClassName("suggestion-item");
    if (!list.classList.contains("show")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentVendorFocus++;
      addActiveSuggestion(
        items,
        currentVendorFocus,
        (idx) => (currentVendorFocus = idx),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentVendorFocus--;
      addActiveSuggestion(
        items,
        currentVendorFocus,
        (idx) => (currentVendorFocus = idx),
      );
    } else if (e.key === "Enter") {
      if (currentVendorFocus > -1) {
        e.preventDefault();
        if (items[currentVendorFocus]) items[currentVendorFocus].click();
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container")) {
      list.classList.remove("show");
    }
  });
}

function selectVendor(v) {
  document.getElementById("noHpVendor").value = v["NO HP"] || "";
  document.getElementById("namaVendor").value = getValueFromKeys(
    v,
    ["NAMA\nVENDOR", "NAMA VENDOR"],
    v["VENDOR"] || "",
  );
  document.getElementById("kategoriVendor").value = v["KATEGORI"] || "";
  document.getElementById("alamatVendor").value = v["ALAMAT"] || "";
  document.getElementById("bankVendor").value = v["BANK"] || "";
  document.getElementById("rekeningVendor").value = v["REKENING"] || "";

  document.getElementById("vendorSuggestionList").classList.remove("show");
}

/**
 * Product Autocomplete
 */
let currentProductFocus = -1;

function setupProductAutocomplete() {
  const input = document.getElementById("noSku");
  const list = document.getElementById("skuSuggestionList");

  input.addEventListener("input", (e) => {
    const query = e.target.value.trim().toUpperCase();
    currentProductFocus = -1;
    if (query.length < 1) {
      list.classList.remove("show");
      return;
    }

    const matches = allProducts.filter((p) => {
      const sku = String(p["SKU"] || "").toUpperCase();
      const name = String(p["NAMA PRODUK"] || "").toUpperCase();
      return sku.includes(query) || name.includes(query);
    });

    list.innerHTML = "";
    matches.forEach((p) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `<strong>${p["SKU"]}</strong> - ${p["NAMA PRODUK"]}`;
      item.onclick = () => selectProduct(p);
      list.appendChild(item);
    });
    list.classList.add("show");
  });

  input.addEventListener("keydown", (e) => {
    const items = list.getElementsByClassName("suggestion-item");
    if (!list.classList.contains("show")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentProductFocus++;
      addActiveSuggestion(
        items,
        currentProductFocus,
        (idx) => (currentProductFocus = idx),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentProductFocus--;
      addActiveSuggestion(
        items,
        currentProductFocus,
        (idx) => (currentProductFocus = idx),
      );
    } else if (e.key === "Enter") {
      if (currentProductFocus > -1) {
        e.preventDefault();
        if (items[currentProductFocus]) items[currentProductFocus].click();
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container")) {
      list.classList.remove("show");
    }
  });

  // Enter key listeners for inputs
  const jumlahInput = document.getElementById("jumlah");
  const hppInput = document.getElementById("hpp");

  [jumlahInput, hppInput].forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !list.classList.contains("show")) {
        e.preventDefault();
        tambahKeKeranjang();
      }
    });
  });
}

function addActiveSuggestion(items, index, setIndex) {
  if (!items || items.length === 0) return;
  removeActiveSuggestion(items);
  if (index >= items.length) index = 0;
  if (index < 0) index = items.length - 1;
  setIndex(index);
  items[index].classList.add("active");
  items[index].scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function removeActiveSuggestion(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].classList.remove("active");
  }
}

function selectProduct(p) {
  document.getElementById("noSku").value = p["SKU"] || "";
  document.getElementById("namaProduk").value = p["NAMA PRODUK"] || "";
  document.getElementById("satuan").value = p["SATUAN"] || "";
  document.getElementById("hpp").value = p["HPP"] || 0;

  document.getElementById("skuSuggestionList").classList.remove("show");
  document.getElementById("jumlah").focus();
}

function hitungTotalHPP() {
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const hpp = parseFloat(document.getElementById("hpp").value) || 0;
  document.getElementById("totalHpp").value = jumlah * hpp;
}

/**
 * Cart Management
 */
function tambahKeKeranjang() {
  const sku = document.getElementById("noSku").value;
  const nama = document.getElementById("namaProduk").value;
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const satuan = document.getElementById("satuan").value;
  const hpp = parseFloat(document.getElementById("hpp").value) || 0;
  const total = parseFloat(document.getElementById("totalHpp").value) || 0;

  if (!sku || jumlah <= 0) {
    alert("Silakan pilih produk dan masukkan jumlah!");
    return;
  }

  keranjangData.push({
    no: nomorUrut++,
    sku: sku,
    produk: nama,
    jumlah: jumlah,
    satuan: satuan,
    hpp: hpp,
    total: total,
  });

  renderTabel();
  hitungSubtotal();

  // Reset inputs
  document.getElementById("noSku").value = "";
  document.getElementById("namaProduk").value = "";
  document.getElementById("jumlah").value = "";
  document.getElementById("satuan").value = "";
  document.getElementById("hpp").value = "";
  document.getElementById("totalHpp").value = "";
  document.getElementById("noSku").focus();
}

function renderTabel() {
  const tbody = document.getElementById("keranjangBody");
  tbody.innerHTML = keranjangData
    .map(
      (item, index) => `
        <tr>
            <td>${item.no}</td>
            <td>${item.sku}</td>
            <td>${item.produk}</td>
            <td>${item.jumlah}</td>
            <td>${item.satuan}</td>
            <td>${formatCurrency(item.hpp)}</td>
            <td>${formatCurrency(item.total)}</td>
            <td><button class="btn-remove" onclick="hapusItem(${index})">Hapus</button></td>
        </tr>
    `,
    )
    .join("");
}

function hapusItem(index) {
  keranjangData.splice(index, 1);
  // Re-index
  keranjangData.forEach((item, i) => (item.no = i + 1));
  nomorUrut = keranjangData.length + 1;
  renderTabel();
  hitungSubtotal();
}

/**
 * Financial Calculations
 */
function hitungSubtotal() {
  const subtotal = keranjangData.reduce((acc, item) => acc + item.total, 0);
  document.getElementById("subtotal").value = subtotal;
  hitungTotalTagihan();
}

function hitungTotalTagihan() {
  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = parseFloat(document.getElementById("ongkir").value) || 0;
  const potongan = parseFloat(document.getElementById("potongan").value) || 0;
  const diskon = parseFloat(document.getElementById("diskon").value) || 0;

  // Total Tagihan = subtotal + ongkir + potongan - diskon
  const total = subtotal + ongkir + potongan - diskon;
  document.getElementById("totalTagihan").value = total;
  hitungSisaTagihan();
}

function hitungSisaTagihan() {
  const total = parseFloat(document.getElementById("totalTagihan").value) || 0;
  const dp = parseFloat(document.getElementById("dp").value) || 0;

  // Sisa Tagihan = Total Tagihan - DP
  document.getElementById("sisaTagihan").value = total - dp;
}

/**
 * Simulation: Preview Invoice
 */
function previewInvoice() {
  if (keranjangData.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }

  const previewData = {
    invoiceNo: document.getElementById("noInvoice").value,
    tanggal: document.getElementById("tanggalPembelian").value,
    vendor: {
      nama: document.getElementById("namaVendor").value,
      phone: document.getElementById("noHpVendor").value,
      kategori: document.getElementById("kategoriVendor").value,
      alamat: document.getElementById("alamatVendor").value,
      bank: document.getElementById("bankVendor").value,
      rekening: document.getElementById("rekeningVendor").value,
    },
    items: keranjangData,
    summary: {
      subtotal: parseFloat(document.getElementById("subtotal").value),
      ongkir: parseFloat(document.getElementById("ongkir").value) || 0,
      potongan: parseFloat(document.getElementById("potongan").value) || 0,
      diskon: parseFloat(document.getElementById("diskon").value) || 0,
      total: parseFloat(document.getElementById("totalTagihan").value),
      dp: parseFloat(document.getElementById("dp").value) || 0,
      sisa: parseFloat(document.getElementById("sisaTagihan").value),
    },
  };

  sessionStorage.setItem("currentPurchaseInvoice", JSON.stringify(previewData));
  window.location.href = "invoice_pembelian.html";
}
