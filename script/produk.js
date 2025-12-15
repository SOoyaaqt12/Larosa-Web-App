/**
 * Produk Page - Google Sheets Integration
 * Connects to PERSEDIAAN BARANG sheet
 */

const PRODUK_SHEET_NAME = "PERSEDIAAN BARANG";

// Load products when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  setupEventListeners();
});

async function loadProducts() {
  const tbody = document.getElementById("produkTableBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="15" style="text-align: center;">Memuat data...</td></tr>';

  try {
    const result = await fetchSheetData(PRODUK_SHEET_NAME);

    if (result.data && result.data.length > 0) {
      renderProductTable(result.data);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="15" style="text-align: center;">Tidak ada data produk</td></tr>';
    }
  } catch (error) {
    console.error("Error loading products:", error);
    tbody.innerHTML =
      '<tr><td colspan="15" style="text-align: center; color: red;">Gagal memuat data. Pastikan Google Apps Script sudah di-deploy.</td></tr>';
  }
}

function renderProductTable(products) {
  const tbody = document.getElementById("produkTableBody");
  if (!tbody) return;

  tbody.innerHTML = products
    .map(
      (product) => `
        <tr data-row-index="${product._rowIndex}">
            <td>${product["SKU"] || ""}</td>
            <td>${product["NAMA PRODUK"] || ""}</td>
            <td>${product["KETAGORI"] || product["KATEGORI"] || ""}</td>
            <td>${product["SATUAN"] || ""}</td>
            <td>${product["STOK SISTEM"] || 0}</td>
            <td>${product["RESTOCK"] || 0}</td>
            <td>${product["TERJUAL"] || 0}</td>
            <td>${product["STOK AKHIR SISTEM"] || 0}</td>
            <td>${product["STOK LAPANGAN"] || 0}</td>
            <td>${product["SELISIH"] || 0}</td>
            <td>${product["STOK MINIMUM"] || 0}</td>
            <td>${product["KEKURANGAN STOK"] || 0}</td>
            <td>${formatCurrency(product["HPP"] || 0)}</td>
            <td>${formatCurrency(product["HARGA JUAL"] || 0)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editProduct(${
                      product._rowIndex
                    })">Edit</button>
                    <button class="btn-delete" onclick="deleteProduct(${
                      product._rowIndex
                    })">Delete</button>
                </div>
            </td>
        </tr>
    `
    )
    .join("");
}

function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return "Rp" + num.toLocaleString("id-ID");
}

function setupEventListeners() {
  // Tambah button
  const btnTambah = document.querySelector(".btn-tambah");
  if (btnTambah) {
    btnTambah.addEventListener("click", showAddProductModal);
  }
}

function showAddProductModal() {
  // Create modal HTML
  const modalHTML = `
        <div id="productModal" class="modal">
            <div class="modal-content">
                <h2>Tambah Produk Baru</h2>
                <form id="productForm">
                    <div class="form-group">
                        <label>SKU</label>
                        <input type="text" name="SKU" required>
                    </div>
                    <div class="form-group">
                        <label>Nama Produk</label>
                        <input type="text" name="NAMA PRODUK" required>
                    </div>
                    <div class="form-group">
                        <label>Kategori</label>
                        <input type="text" name="KETAGORI">
                    </div>
                    <div class="form-group">
                        <label>Satuan</label>
                        <input type="text" name="SATUAN" value="Pcs">
                    </div>
                    <div class="form-group">
                        <label>Stok Sistem</label>
                        <input type="number" name="STOK SISTEM" value="0">
                    </div>
                    <div class="form-group">
                        <label>HPP</label>
                        <input type="number" name="HPP" value="0">
                    </div>
                    <div class="form-group">
                        <label>Harga Jual</label>
                        <input type="number" name="HARGA JUAL" value="0">
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-simpan">Simpan</button>
                        <button type="button" class="btn-batal" onclick="closeModal()">Batal</button>
                    </div>
                </form>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const form = document.getElementById("productForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addProduct(new FormData(form));
  });
}

async function addProduct(formData) {
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });

  try {
    const result = await addSheetRow(PRODUK_SHEET_NAME, data);
    if (result.success) {
      alert("Produk berhasil ditambahkan!");
      closeModal();
      loadProducts();
    }
  } catch (error) {
    alert("Gagal menambahkan produk: " + error.message);
  }
}

async function editProduct(rowIndex) {
  // For now, simple prompt-based edit
  const newName = prompt("Masukkan nama produk baru:");
  if (newName) {
    try {
      const result = await updateSheetRow(PRODUK_SHEET_NAME, rowIndex, {
        "NAMA PRODUK": newName,
      });
      if (result.success) {
        alert("Produk berhasil diupdate!");
        loadProducts();
      }
    } catch (error) {
      alert("Gagal mengupdate produk: " + error.message);
    }
  }
}

async function deleteProduct(rowIndex) {
  if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
    try {
      const result = await deleteSheetRow(PRODUK_SHEET_NAME, rowIndex);
      if (result.success) {
        alert("Produk berhasil dihapus!");
        loadProducts();
      }
    } catch (error) {
      alert("Gagal menghapus produk: " + error.message);
    }
  }
}

function closeModal() {
  const modal = document.getElementById("productModal");
  if (modal) {
    modal.remove();
  }
}
