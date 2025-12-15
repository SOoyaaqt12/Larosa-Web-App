/**
 * Kustomer Page - Google Sheets Integration
 * Connects to KOSTUMER sheet
 */

const KUSTOMER_SHEET_NAME = "KOSTUMER";
const CACHE_KEY = "kustomer_data_cache";
const CACHE_TIMESTAMP_KEY = "kustomer_cache_timestamp";

// Load customers when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadCustomers();
  setupKustomerEventListeners();
});

async function loadCustomers() {
  const tbody = document.getElementById("kustomerTableBody");
  if (!tbody) return;

  // Step 1: Immediately show cached data if available
  const cachedData = getCachedData();
  if (cachedData && cachedData.length > 0) {
    console.log("Showing cached data instantly");
    renderCustomerTable(cachedData);
    // Show subtle indicator that we're refreshing
    showRefreshIndicator();
  } else {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center;">Memuat data...</td></tr>';
  }

  // Step 2: Fetch fresh data in background
  try {
    const result = await fetchSheetData(KUSTOMER_SHEET_NAME);

    if (result.data && result.data.length > 0) {
      // Save to cache
      setCachedData(result.data);
      // Render fresh data
      renderCustomerTable(result.data);
    } else if (!cachedData || cachedData.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align: center;">Tidak ada data pelanggan</td></tr>';
    }
    hideRefreshIndicator();
  } catch (error) {
    console.error("Error loading customers:", error);
    hideRefreshIndicator();
    // Only show error if no cached data
    if (!cachedData || cachedData.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align: center; color: red;">Gagal memuat data. Pastikan Google Apps Script sudah di-deploy.</td></tr>';
    }
  }
}

// Cache functions
function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error("Error reading cache:", e);
  }
  return null;
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.error("Error saving cache:", e);
  }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

// Refresh indicator
function showRefreshIndicator() {
  const header = document.querySelector(".header h1");
  if (header && !document.getElementById("refreshIndicator")) {
    header.insertAdjacentHTML(
      "afterend",
      '<span id="refreshIndicator" style="font-size: 12px; color: #888; margin-left: 10px;">Memperbarui data...</span>'
    );
  }
}

function hideRefreshIndicator() {
  const indicator = document.getElementById("refreshIndicator");
  if (indicator) {
    indicator.remove();
  }
}

function renderCustomerTable(customers) {
  const tbody = document.getElementById("kustomerTableBody");
  if (!tbody) return;

  // Store customers data for editing
  customersData = customers;

  // Debug: log first customer to see actual keys
  if (customers.length > 0) {
    console.log("Customer data keys:", Object.keys(customers[0]));
    console.log("First customer:", customers[0]);
  }

  tbody.innerHTML = customers
    .map(
      (customer) => `
        <tr data-row-index="${customer._rowIndex}">
            <td>${formatDate(
              customer["TANGGAL"] || customer["Tanggal"] || ""
            )}</td>
            <td>${
              customer["NAMA PELANGGAN"] ||
              customer["NAMA\nPELANGGAN"] ||
              customer["Nama Pelanggan"] ||
              customer["NAMA"] ||
              getColumnValue(customer, "NAMA") ||
              ""
            }</td>
            <td>${
              customer["NO HP"] || customer["No HP"] || customer["NO\nHP"] || ""
            }</td>
            <td>${customer["ALAMAT"] || customer["Alamat"] || ""}</td>
            <td>${customer["KOTA"] || customer["Kota"] || ""}</td>
            <td>${customer["CHANNEL"] || customer["Channel"] || ""}</td>
            <td>${
              customer["JUMLAH TRANSAKSI"] ||
              customer["JUMLAH\nTRANSAKSI"] ||
              customer["Jumlah Transaksi"] ||
              0
            }</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editCustomer(${
                      customer._rowIndex
                    })">Edit</button>
                    <button class="btn-delete" onclick="deleteCustomer(${
                      customer._rowIndex
                    })">Delete</button>
                </div>
            </td>
        </tr>
    `
    )
    .join("");
}

// Helper function to find column value by partial match
function getColumnValue(obj, searchKey) {
  for (const key of Object.keys(obj)) {
    if (key.toUpperCase().includes(searchKey.toUpperCase())) {
      return obj[key];
    }
  }
  return null;
}

function formatDate(dateValue) {
  if (!dateValue) return "";

  try {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch (e) {
    console.error("Date parse error:", e);
  }

  // If parsing failed, try to extract date from ISO string
  if (typeof dateValue === "string" && dateValue.includes("T")) {
    const parts = dateValue.split("T")[0].split("-");
    if (parts.length === 3) {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      return `${parts[2]}-${months[parseInt(parts[1]) - 1]}-${parts[0]}`;
    }
  }

  return dateValue;
}

function setupKustomerEventListeners() {
  // Tambah button
  const btnTambah = document.querySelector(".btn-tambah");
  if (btnTambah) {
    btnTambah.addEventListener("click", showAddCustomerModal);
  }
}

function showAddCustomerModal() {
  const modalHTML = `
        <div id="customerModal" class="modal">
            <div class="modal-content">
                <h2>Tambah Pelanggan Baru</h2>
                <form id="customerForm">
                    <div class="form-group">
                        <label>Tanggal</label>
                        <input type="date" name="TANGGAL" required>
                    </div>
                    <div class="form-group">
                        <label>Nama Pelanggan</label>
                        <input type="text" name="NAMA_PELANGGAN" id="namaPelanggan" required>
                    </div>
                    <div class="form-group">
                        <label>No HP</label>
                        <input type="text" name="NO_HP">
                    </div>
                    <div class="form-group">
                        <label>Alamat</label>
                        <input type="text" name="ALAMAT">
                    </div>
                    <div class="form-group">
                        <label>Kota</label>
                        <select name="KOTA" required>
                            <option value="">Pilih Kota</option>
                            <option value="Bogor">Bogor</option>
                            <option value="Depok">Depok</option>
                            <option value="Jakarta Pusat">Jakarta Pusat</option>
                            <option value="Jakarta Barat">Jakarta Barat</option>
                            <option value="Jakarta Selatan">Jakarta Selatan</option>
                            <option value="Jakarta Timur">Jakarta Timur</option>
                            <option value="Jakarta Utara">Jakarta Utara</option>
                            <option value="BSD/Serpong">BSD/Serpong</option>
                            <option value="Tangerang">Tangerang</option>
                            <option value="Cibubur">Cibubur</option>
                            <option value="Bekasi">Bekasi</option>
                            <option value="Luar Kota">Luar Kota</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Channel</label>
                        <select name="CHANNEL" required>
                            <option value="">Pilih Channel</option>
                            <option value="IG">IG</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Google">Google</option>
                            <option value="Tiktok">Tiktok</option>
                            <option value="Youtube">Youtube</option>
                            <option value="Referensi">Referensi</option>
                            <option value="Toko">Toko</option>
                            <option value="Lainnya">Lainnya</option>
                            <option value="Meta Ads">Meta Ads</option>
                            <option value="Existing">Existing</option>
                        </select>
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-simpan">Simpan</button>
                        <button type="button" class="btn-batal" onclick="closeCustomerModal()">Batal</button>
                    </div>
                </form>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Set today's date as default
  const dateInput = document.querySelector(
    '#customerForm input[name="TANGGAL"]'
  );
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }

  const form = document.getElementById("customerForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addCustomer(new FormData(form));
  });
}

// Helper function to format phone number (08xxx → 628xxx)
function formatPhoneNumber(phone) {
  if (!phone) return "";
  phone = phone.toString().trim();

  // Remove any existing +62 or 62 prefix
  if (phone.startsWith("+62")) {
    phone = phone.substring(3);
  } else if (phone.startsWith("62")) {
    phone = phone.substring(2);
  }

  // Remove leading 0 if present
  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  // Add 62 prefix
  return "62" + phone;
}

// Helper function to format date (YYYY-MM-DD → DD-Mon-YYYY)
function formatDateForSheet(dateString) {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

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
  } catch (e) {
    return dateString;
  }
}

async function addCustomer(formData) {
  // Build data object with the correct header names that match the spreadsheet
  const data = {
    TANGGAL: formatDateForSheet(formData.get("TANGGAL")),
    "NAMA\nPELANGGAN": formData.get("NAMA_PELANGGAN"),
    "NO HP": formatPhoneNumber(formData.get("NO_HP")),
    ALAMAT: formData.get("ALAMAT"),
    KOTA: formData.get("KOTA"),
    CHANNEL: formData.get("CHANNEL"),
    "JUMLAH\nTRANSAKSI": 0,
  };

  // Optimistic update: add to cache immediately
  const tempRowIndex = Date.now(); // Temporary ID
  const newCustomer = { ...data, _rowIndex: tempRowIndex };
  customersData.push(newCustomer);
  setCachedData(customersData);
  renderCustomerTable(customersData);
  closeCustomerModal();

  // Sync to Google Sheets in background
  try {
    const result = await addSheetRow(KUSTOMER_SHEET_NAME, data);
    if (result.success) {
      console.log("Customer synced to Google Sheets");
      // Refresh to get actual row index
      loadCustomers();
    } else {
      // Rollback on failure
      customersData = customersData.filter((c) => c._rowIndex !== tempRowIndex);
      setCachedData(customersData);
      renderCustomerTable(customersData);
      alert("Gagal menyimpan ke server. Data akan dimuat ulang.");
    }
  } catch (error) {
    // Rollback on error
    customersData = customersData.filter((c) => c._rowIndex !== tempRowIndex);
    setCachedData(customersData);
    renderCustomerTable(customersData);
    alert("Gagal menambahkan pelanggan: " + error.message);
  }
}

// Store current customers data for editing
let customersData = [];

async function editCustomer(rowIndex) {
  // Find the customer data from our cached data
  const customer = customersData.find((c) => c._rowIndex === rowIndex);

  if (!customer) {
    alert("Data pelanggan tidak ditemukan. Silakan refresh halaman.");
    return;
  }

  // Get values with fallbacks for different header formats
  const tanggal = customer["TANGGAL"] || customer["Tanggal"] || "";
  const nama =
    customer["NAMA PELANGGAN"] ||
    customer["NAMA\nPELANGGAN"] ||
    customer["Nama Pelanggan"] ||
    "";
  const noHp =
    customer["NO HP"] || customer["NO\nHP"] || customer["No HP"] || "";
  const alamat = customer["ALAMAT"] || customer["Alamat"] || "";
  const kota = customer["KOTA"] || customer["Kota"] || "";
  const channel = customer["CHANNEL"] || customer["Channel"] || "";

  // Format date for input (use local timezone to avoid off-by-one day issue)
  let dateValue = "";
  if (tanggal) {
    try {
      const d = new Date(tanggal);
      if (!isNaN(d.getTime())) {
        // Use local date components instead of toISOString (which uses UTC)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        dateValue = `${year}-${month}-${day}`;
      }
    } catch (e) {}
  }

  const modalHTML = `
    <div id="customerModal" class="modal">
      <div class="modal-content">
        <h2>Edit Pelanggan</h2>
        <form id="editCustomerForm">
          <input type="hidden" name="rowIndex" value="${rowIndex}">
          <div class="form-group">
            <label>Tanggal</label>
            <input type="date" name="TANGGAL" value="${dateValue}" required>
          </div>
          <div class="form-group">
            <label>Nama Pelanggan</label>
            <input type="text" name="NAMA_PELANGGAN" value="${nama}" required>
          </div>
          <div class="form-group">
            <label>No HP</label>
            <input type="text" name="NO_HP" value="${noHp}">
          </div>
          <div class="form-group">
            <label>Alamat</label>
            <input type="text" name="ALAMAT" value="${alamat}">
          </div>
          <div class="form-group">
            <label>Kota</label>
            <select name="KOTA" required>
              <option value="">Pilih Kota</option>
              <option value="Bogor" ${
                kota === "Bogor" ? "selected" : ""
              }>Bogor</option>
              <option value="Depok" ${
                kota === "Depok" ? "selected" : ""
              }>Depok</option>
              <option value="Jakarta Pusat" ${
                kota === "Jakarta Pusat" ? "selected" : ""
              }>Jakarta Pusat</option>
              <option value="Jakarta Barat" ${
                kota === "Jakarta Barat" ? "selected" : ""
              }>Jakarta Barat</option>
              <option value="Jakarta Selatan" ${
                kota === "Jakarta Selatan" ? "selected" : ""
              }>Jakarta Selatan</option>
              <option value="Jakarta Timur" ${
                kota === "Jakarta Timur" ? "selected" : ""
              }>Jakarta Timur</option>
              <option value="Jakarta Utara" ${
                kota === "Jakarta Utara" ? "selected" : ""
              }>Jakarta Utara</option>
              <option value="BSD/Serpong" ${
                kota === "BSD/Serpong" ? "selected" : ""
              }>BSD/Serpong</option>
              <option value="Tangerang" ${
                kota === "Tangerang" ? "selected" : ""
              }>Tangerang</option>
              <option value="Cibubur" ${
                kota === "Cibubur" ? "selected" : ""
              }>Cibubur</option>
              <option value="Bekasi" ${
                kota === "Bekasi" ? "selected" : ""
              }>Bekasi</option>
              <option value="Luar Kota" ${
                kota === "Luar Kota" ? "selected" : ""
              }>Luar Kota</option>
            </select>
          </div>
          <div class="form-group">
            <label>Channel</label>
            <select name="CHANNEL" required>
              <option value="">Pilih Channel</option>
              <option value="IG" ${
                channel === "IG" ? "selected" : ""
              }>IG</option>
              <option value="Facebook" ${
                channel === "Facebook" ? "selected" : ""
              }>Facebook</option>
              <option value="Google" ${
                channel === "Google" ? "selected" : ""
              }>Google</option>
              <option value="Tiktok" ${
                channel === "Tiktok" ? "selected" : ""
              }>Tiktok</option>
              <option value="Youtube" ${
                channel === "Youtube" ? "selected" : ""
              }>Youtube</option>
              <option value="Referensi" ${
                channel === "Referensi" ? "selected" : ""
              }>Referensi</option>
              <option value="Toko" ${
                channel === "Toko" ? "selected" : ""
              }>Toko</option>
              <option value="Lainnya" ${
                channel === "Lainnya" ? "selected" : ""
              }>Lainnya</option>
              <option value="Meta Ads" ${
                channel === "Meta Ads" ? "selected" : ""
              }>Meta Ads</option>
              <option value="Existing" ${
                channel === "Existing" ? "selected" : ""
              }>Existing</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="submit" class="btn-simpan">Simpan</button>
            <button type="button" class="btn-batal" onclick="closeCustomerModal()">Batal</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const form = document.getElementById("editCustomerForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateCustomer(new FormData(form));
  });
}

async function updateCustomer(formData) {
  const rowIndex = parseInt(formData.get("rowIndex"));

  const data = {
    TANGGAL: formatDateForSheet(formData.get("TANGGAL")),
    "NAMA\nPELANGGAN": formData.get("NAMA_PELANGGAN"),
    "NO HP": formatPhoneNumber(formData.get("NO_HP")),
    ALAMAT: formData.get("ALAMAT"),
    KOTA: formData.get("KOTA"),
    CHANNEL: formData.get("CHANNEL"),
  };

  // Save original for rollback
  const originalCustomer = customersData.find((c) => c._rowIndex === rowIndex);
  const originalData = originalCustomer ? { ...originalCustomer } : null;

  // Optimistic update: update cache immediately
  const customerIndex = customersData.findIndex(
    (c) => c._rowIndex === rowIndex
  );
  if (customerIndex !== -1) {
    customersData[customerIndex] = { ...customersData[customerIndex], ...data };
    setCachedData(customersData);
    renderCustomerTable(customersData);
  }
  closeCustomerModal();

  // Sync to Google Sheets in background
  try {
    const result = await updateSheetRow(KUSTOMER_SHEET_NAME, rowIndex, data);
    if (result.success) {
      console.log("Customer updated in Google Sheets");
    } else {
      // Rollback on failure
      if (originalData && customerIndex !== -1) {
        customersData[customerIndex] = originalData;
        setCachedData(customersData);
        renderCustomerTable(customersData);
      }
      alert("Gagal menyimpan perubahan ke server.");
    }
  } catch (error) {
    // Rollback on error
    if (originalData && customerIndex !== -1) {
      customersData[customerIndex] = originalData;
      setCachedData(customersData);
      renderCustomerTable(customersData);
    }
    alert("Gagal mengupdate pelanggan: " + error.message);
  }
}

async function deleteCustomer(rowIndex) {
  if (!confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) {
    return;
  }

  // Save for rollback
  const deletedCustomer = customersData.find((c) => c._rowIndex === rowIndex);
  const deletedIndex = customersData.findIndex((c) => c._rowIndex === rowIndex);

  // Optimistic update: remove from cache immediately
  customersData = customersData.filter((c) => c._rowIndex !== rowIndex);
  setCachedData(customersData);
  renderCustomerTable(customersData);

  // Sync to Google Sheets in background
  try {
    const result = await deleteSheetRow(KUSTOMER_SHEET_NAME, rowIndex);
    if (result.success) {
      console.log("Customer deleted from Google Sheets");
      // Refresh to update row indices
      loadCustomers();
    } else {
      // Rollback on failure
      if (deletedCustomer) {
        customersData.splice(deletedIndex, 0, deletedCustomer);
        setCachedData(customersData);
        renderCustomerTable(customersData);
      }
      alert("Gagal menghapus dari server.");
    }
  } catch (error) {
    // Rollback on error
    if (deletedCustomer) {
      customersData.splice(deletedIndex, 0, deletedCustomer);
      setCachedData(customersData);
      renderCustomerTable(customersData);
    }
    alert("Gagal menghapus pelanggan: " + error.message);
  }
}

function closeCustomerModal() {
  const modal = document.getElementById("customerModal");
  if (modal) {
    modal.remove();
  }
}
