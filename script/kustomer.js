/**
 * Kustomer Page - Google Sheets Integration
 * Connects to KOSTUMER sheet
 *
 * Refactored to use shared utilities (utils.js, data-service.js)
 */

const customerService = DataServices.customer;

// Store current customers data for editing
let customersData = [];

// Load customers when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadCustomers();
  setupKustomerEventListeners();
});

async function loadCustomers() {
  const tbody = document.getElementById("kustomerTableBody");
  if (!tbody) return;

  customersData = await customerService.loadData({
    tbody: tbody,
    onRender: renderCustomerTable,
    onDataReady: (data) => {
      customersData = data;
    },
  });
}

function renderCustomerTable(customers) {
  const tbody = document.getElementById("kustomerTableBody");
  if (!tbody) return;

  customersData = customers;

  if (customers.length > 0) {
    console.log("Customer data keys:", Object.keys(customers[0]));
  }

  tbody.innerHTML = customers
    .map(
      (customer) => `
        <tr data-row-index="${customer._rowIndex}">
            <td class="text-left">${formatDisplayDate(
              getValueFromKeys(customer, ["TANGGAL", "Tanggal"], ""),
            )}</td>
            <td class="text-left">${getValueFromKeys(
              customer,
              ["NAMA PELANGGAN", "NAMA\nPELANGGAN", "Nama Pelanggan", "NAMA"],
              "",
            )}</td>
            <td class="text-left">${getValueFromKeys(
              customer,
              ["NO HP", "No HP", "NO\nHP"],
              "",
            )}</td>
            <td class="text-left">${getValueFromKeys(
              customer,
              ["ALAMAT", "Alamat"],
              "",
            )}</td>
            <td class="text-left">${getValueFromKeys(
              customer,
              ["KOTA", "Kota"],
              "",
            )}</td>
            <td class="text-left">${getValueFromKeys(
              customer,
              ["CHANNEL", "Channel"],
              "",
            )}</td>
            <td class="text-center">${getValueFromKeys(
              customer,
              ["JUMLAH TRANSAKSI", "JUMLAH\nTRANSAKSI", "Jumlah Transaksi"],
              0,
              true,
            )}</td>
            <td class="text-center">
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
    `,
    )
    .join("");
}

function setupKustomerEventListeners() {
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

  const dateInput = document.querySelector(
    '#customerForm input[name="TANGGAL"]',
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

async function addCustomer(formData) {
  const newPhoneNumber = formatPhoneNumber(formData.get("NO_HP"));

  // Frontend validation: Check for duplicate phone number
  const existingCustomer = customersData.find((c) => {
    const existingPhone = getValueFromKeys(
      c,
      ["NO HP", "NO\\nHP", "No HP"],
      "",
    );
    return (
      String(existingPhone).trim().toLowerCase() ===
      String(newPhoneNumber).trim().toLowerCase()
    );
  });

  if (existingCustomer) {
    alert(
      "Nomor HP '" + newPhoneNumber + "' sudah terdaftar untuk pelanggan lain!",
    );
    return;
  }

  const data = {
    TANGGAL: formatDateForSheet(formData.get("TANGGAL")),
    "NAMA PELANGGAN": formData.get("NAMA_PELANGGAN"),
    "NAMA\nPELANGGAN": formData.get("NAMA_PELANGGAN"),
    "NO HP": newPhoneNumber,
    ALAMAT: formData.get("ALAMAT"),
    KOTA: formData.get("KOTA"),
    CHANNEL: formData.get("CHANNEL"),
    "JUMLAH\nTRANSAKSI": 0,
  };

  // Optimistic update
  const tempRowIndex = Date.now();
  const newCustomer = { ...data, _rowIndex: tempRowIndex };
  customersData.push(newCustomer);
  await customerService.updateCache(customersData);
  renderCustomerTable(customersData);
  closeCustomerModal();

  // Sync to Google Sheets
  try {
    const result = await addSheetRow(customerService.sheetName, data, "NO HP");
    if (result.success) {
      console.log("Customer synced to Google Sheets");
      loadCustomers();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    // Rollback on error
    customersData = customersData.filter((c) => c._rowIndex !== tempRowIndex);
    await customerService.updateCache(customersData);
    renderCustomerTable(customersData);

    let msg = error.message;
    if (msg.includes("Duplicate entry")) {
      msg = "Nomor HP sudah terdaftar!";
    }
    alert("Gagal menambahkan pelanggan: " + msg);
  }
}

async function editCustomer(rowIndex) {
  const customer = customersData.find((c) => c._rowIndex === rowIndex);

  if (!customer) {
    alert("Data pelanggan tidak ditemukan. Silakan refresh halaman.");
    return;
  }

  const tanggal = getValueFromKeys(customer, ["TANGGAL", "Tanggal"], "");
  const nama = getValueFromKeys(
    customer,
    ["NAMA PELANGGAN", "NAMA\nPELANGGAN", "Nama Pelanggan"],
    "",
  );
  const noHp = getValueFromKeys(customer, ["NO HP", "NO\nHP", "No HP"], "");
  const alamat = getValueFromKeys(customer, ["ALAMAT", "Alamat"], "");
  const kota = getValueFromKeys(customer, ["KOTA", "Kota"], "");
  const channel = getValueFromKeys(customer, ["CHANNEL", "Channel"], "");

  // Format date for input
  let dateValue = "";
  if (tanggal) {
    try {
      const d = new Date(tanggal);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        dateValue = `${year}-${month}-${day}`;
      }
    } catch (e) {}
  }

  const kotaOptions = [
    "Bogor",
    "Depok",
    "Jakarta Pusat",
    "Jakarta Barat",
    "Jakarta Selatan",
    "Jakarta Timur",
    "Jakarta Utara",
    "BSD/Serpong",
    "Tangerang",
    "Cibubur",
    "Bekasi",
    "Luar Kota",
  ];
  const channelOptions = [
    "IG",
    "Facebook",
    "Google",
    "Tiktok",
    "Youtube",
    "Referensi",
    "Toko",
    "Lainnya",
    "Meta Ads",
    "Existing",
  ];

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
              ${kotaOptions
                .map(
                  (k) =>
                    `<option value="${k}" ${
                      kota === k ? "selected" : ""
                    }>${k}</option>`,
                )
                .join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Channel</label>
            <select name="CHANNEL" required>
              <option value="">Pilih Channel</option>
              ${channelOptions
                .map(
                  (c) =>
                    `<option value="${c}" ${
                      channel === c ? "selected" : ""
                    }>${c}</option>`,
                )
                .join("")}
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
    "NAMA PELANGGAN": formData.get("NAMA_PELANGGAN"),
    "NAMA\nPELANGGAN": formData.get("NAMA_PELANGGAN"),
    "NO HP": formatPhoneNumber(formData.get("NO_HP")),
    ALAMAT: formData.get("ALAMAT"),
    KOTA: formData.get("KOTA"),
    CHANNEL: formData.get("CHANNEL"),
  };

  // Save original for rollback
  const customerIndex = customersData.findIndex(
    (c) => c._rowIndex === rowIndex,
  );
  const originalData =
    customerIndex !== -1 ? { ...customersData[customerIndex] } : null;

  // Optimistic update
  if (customerIndex !== -1) {
    customersData[customerIndex] = { ...customersData[customerIndex], ...data };
    await customerService.updateCache(customersData);
    renderCustomerTable(customersData);
  }
  closeCustomerModal();

  // Sync to Google Sheets
  try {
    const result = await updateSheetRow(
      customerService.sheetName,
      rowIndex,
      data,
    );
    if (result.success) {
      console.log("Customer updated in Google Sheets");
    } else {
      throw new Error("Update failed");
    }
  } catch (error) {
    // Rollback
    if (originalData && customerIndex !== -1) {
      customersData[customerIndex] = originalData;
      await customerService.updateCache(customersData);
      renderCustomerTable(customersData);
    }
    alert("Gagal mengupdate pelanggan: " + error.message);
  }
}

async function deleteCustomer(rowIndex) {
  if (!confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) {
    return;
  }

  // Show loading spinner
  if (window.showGlobalLoader) window.showGlobalLoader();

  // Save for rollback
  const deletedIndex = customersData.findIndex((c) => c._rowIndex === rowIndex);
  const deletedCustomer = customersData[deletedIndex];

  // Optimistic update
  customersData = customersData.filter((c) => c._rowIndex !== rowIndex);
  await customerService.updateCache(customersData);
  renderCustomerTable(customersData);

  // Sync to Google Sheets
  try {
    const result = await deleteSheetRow(customerService.sheetName, rowIndex);
    if (result.success) {
      console.log("Customer deleted from Google Sheets");
      loadCustomers();
    } else {
      throw new Error("Delete failed");
    }
  } catch (error) {
    // Rollback
    if (deletedCustomer) {
      customersData.splice(deletedIndex, 0, deletedCustomer);
      await customerService.updateCache(customersData);
      renderCustomerTable(customersData);
    }
    alert("Gagal menghapus pelanggan: " + error.message);
  } finally {
    // Hide loading spinner
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}

function closeCustomerModal() {
  closeModalById("customerModal");
}
