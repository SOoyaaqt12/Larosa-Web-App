/**
 * Vendor Page - Google Sheets Integration
 * Connects to VENDOR sheet
 *
 * Refactored to use shared utilities (utils.js, data-service.js)
 */

const vendorService = DataServices.vendor;

// Local data reference
let vendorData = [];

// Load vendors when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadVendors();
  setupVendorEventListeners();
});

async function loadVendors() {
  const tbody = document.getElementById("vendorTableBody");
  if (!tbody) return;

  vendorData = await vendorService.loadData({
    tbody: tbody,
    onRender: renderVendorTable,
    onDataReady: (data) => {
      vendorData = data;
    },
  });
}

// Render vendor table
function renderVendorTable(data) {
  const tbody = document.getElementById("vendorTableBody");
  if (!tbody) return;

  if (!data || data.length === 0) {
    showTableMessage(tbody, "Tidak ada data vendor", 9);
    return;
  }

  tbody.innerHTML = data
    .map((vendor, index) => {
      const namaVendor = getValueFromKeys(
        vendor,
        ["NAMA\nVENDOR", "NAMA VENDOR"],
        "-"
      );
      const kategori = vendor["KATEGORI"] || "-";
      const noHp = vendor["NO HP"] || "-";
      const alamat = vendor["ALAMAT"] || "-";
      const kota = vendor["KOTA"] || "-";
      const bank = vendor["BANK"] || "-";
      const atasNama = vendor["ATAS NAMA"] || "-";
      const rekening = vendor["REKENING"] || "-";

      return `
        <tr data-index="${index}">
          <td>${namaVendor}</td>
          <td>${kategori}</td>
          <td>${noHp}</td>
          <td>${alamat}</td>
          <td>${kota}</td>
          <td>${bank}</td>
          <td>${atasNama}</td>
          <td>${rekening}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit" onclick="editVendor(${index})">Edit</button>
              <button class="btn-delete" onclick="deleteVendor(${index})">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Event listeners
function setupVendorEventListeners() {
  const btnTambah = document.querySelector(".btn-tambah");
  if (btnTambah) {
    btnTambah.addEventListener("click", () => {
      // TODO: Implement add vendor modal
      alert("Fitur tambah vendor akan segera tersedia");
    });
  }
}

// Edit vendor
function editVendor(index) {
  // TODO: Implement edit vendor modal
  alert("Fitur edit vendor akan segera tersedia");
}

// Delete vendor
async function deleteVendor(index) {
  if (!confirm("Apakah Anda yakin ingin menghapus vendor ini?")) {
    return;
  }

  // Show loading spinner
  if (window.showGlobalLoader) window.showGlobalLoader();

  try {
    const vendor = vendorData[index];
    const rowNumber = vendor._rowNumber;

    if (!rowNumber) {
      alert("Tidak dapat menentukan baris data");
      return;
    }

    const result = await deleteSheetRow(vendorService.sheetName, rowNumber);

    if (result.success) {
      // Remove from cache and re-render
      vendorData.splice(index, 1);
      await vendorService.updateCache(vendorData);
      renderVendorTable(vendorData);
      alert("Vendor berhasil dihapus");
    } else {
      alert("Gagal menghapus vendor: " + (result.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error deleting vendor:", error);
    alert("Gagal menghapus vendor");
  } finally {
    // Hide loading spinner
    if (window.hideGlobalLoader) window.hideGlobalLoader();
  }
}
