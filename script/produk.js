/**
 * Produk Page - Google Sheets Integration
 * Connects to PERSEDIAAN BARANG sheet
 *
 * Refactored to use shared utilities (utils.js, data-service.js)
 */

const productService = DataServices.product;

// Store products data for editing
let productsData = [];
let filteredData = [];

// Pagination state
let currentPage = 1;
let itemsPerPage = 10;
let searchQuery = "";
let categoryFilter = "";

// Load products when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  setupEventListeners();
});

async function loadProducts() {
  const tbody = document.getElementById("produkTableBody");
  if (!tbody) return;

  productsData = await productService.loadData({
    tbody: tbody,
    onRender: (data) => {
      productsData = data;
      populateCategoryFilter();
      applyFiltersAndRender();
    },
    onDataReady: (data) => {
      productsData = data;
    },
  });
}

/**
 * Populate category filter dropdown from unique categories
 */
function populateCategoryFilter() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;

  // Get all categories, normalize them (trim and uppercase for comparison)
  const categoryMap = new Map();

  productsData.forEach((p) => {
    const rawCategory = getValueFromKeys(p, ["KETAGORI", "KATEGORI"], "");
    if (rawCategory) {
      // Use trimmed and uppercased version as key to detect duplicates
      const normalizedKey = rawCategory.toString().trim().toUpperCase();
      // Store the first occurrence's original value (trimmed)
      if (!categoryMap.has(normalizedKey)) {
        categoryMap.set(normalizedKey, rawCategory.toString().trim());
      }
    }
  });

  // Get unique categories and sort them
  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.toUpperCase().localeCompare(b.toUpperCase())
  );

  select.innerHTML = '<option value="">Semua Kategori</option>';
  categories.forEach((cat) => {
    select.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

/**
 * Apply search and filter, then render with pagination
 */
function applyFiltersAndRender() {
  filteredData = productsData.filter((product) => {
    const sku = (product["SKU"] || "").toLowerCase();
    const name = (product["NAMA PRODUK"] || "").toLowerCase();
    const category = getValueFromKeys(product, ["KETAGORI", "KATEGORI"], "")
      .toString()
      .trim();

    const matchesSearch =
      searchQuery === "" ||
      sku.includes(searchQuery.toLowerCase()) ||
      name.includes(searchQuery.toLowerCase());

    // Case-insensitive category matching
    const matchesCategory =
      categoryFilter === "" ||
      category.toUpperCase() === categoryFilter.toUpperCase();

    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = 1;

  renderPaginatedTable();
  updatePaginationInfo();
  updatePaginationControls();
}

/**
 * Render only the current page of data
 */
function renderPaginatedTable() {
  const tbody = document.getElementById("produkTableBody");
  if (!tbody) return;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filteredData.slice(startIndex, endIndex);

  if (pageData.length === 0) {
    showTableMessage(tbody, "Tidak ada data yang cocok", 15);
    return;
  }

  tbody.innerHTML = pageData
    .map(
      (product) => `
        <tr data-row-index="${product._rowIndex}">
            <td>${product["SKU"] || ""}</td>
            <td>${product["NAMA PRODUK"] || ""}</td>
            <td>${getValueFromKeys(product, ["KETAGORI", "KATEGORI"], "")}</td>
            <td>${product["SATUAN"] || ""}</td>
            <td>${product["STOK SISTEM"] || 0}</td>
            <td>${product["RESTOCK"] || 0}</td>
            <td>${product["TERJUAL"] || 0}</td>
            <td>${product["STOK AKHIR SISTEM"] || 0}</td>
            <td>${product["STOK LAPANGAN"] || 0}</td>
            <td>${product["SELISIH"] || 0}</td>
            <td>${product["STOK MINIMUM"] || 0}</td>
            <td>${Math.max(0, product["KEKURANGAN STOK"] || 0)}</td>
            <td>${formatCurrency(product["HPP"] || 0)}</td>
            <td>${formatCurrency(product["HARGA JUAL"] || 0)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-restock" onclick="showRestockModal(${
                      product._rowIndex
                    })">Restock</button>
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

/**
 * Update pagination info text
 */
function updatePaginationInfo() {
  const infoEl = document.getElementById("paginationInfo");
  if (!infoEl) return;

  const startIndex =
    filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredData.length);

  infoEl.textContent = `Menampilkan ${startIndex} - ${endIndex} dari ${filteredData.length} data`;
}

/**
 * Update pagination controls
 * Shows pages around the current page with ellipsis for gaps
 */
function updatePaginationControls() {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const prevBtn = document.getElementById("btnPrevPage");
  const nextBtn = document.getElementById("btnNextPage");
  const pageNumbers = document.getElementById("pageNumbers");

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  if (pageNumbers) {
    let html = "";

    // Calculate which page numbers to show
    const maxVisible = 5; // Max page buttons to show (excluding ellipsis)
    let startPage, endPage;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small enough
      startPage = 1;
      endPage = totalPages;
    } else {
      // Calculate range around current page
      const halfVisible = Math.floor(maxVisible / 2);

      if (currentPage <= halfVisible + 1) {
        // Near the beginning
        startPage = 1;
        endPage = maxVisible;
      } else if (currentPage >= totalPages - halfVisible) {
        // Near the end
        startPage = totalPages - maxVisible + 1;
        endPage = totalPages;
      } else {
        // In the middle
        startPage = currentPage - halfVisible;
        endPage = currentPage + halfVisible;
      }
    }

    // Always show page 1
    if (startPage > 1) {
      html += `<button class="page-btn ${
        currentPage === 1 ? "active" : ""
      }" onclick="goToPage(1)">1</button>`;
      if (startPage > 2) {
        html += `<span class="page-ellipsis">...</span>`;
      }
    }

    // Show page range
    for (let i = startPage; i <= endPage; i++) {
      if (i === 1 && startPage > 1) continue; // Skip if already shown
      if (i === totalPages && endPage < totalPages) continue; // Skip if will be shown
      const active = i === currentPage ? "active" : "";
      html += `<button class="page-btn ${active}" onclick="goToPage(${i})">${i}</button>`;
    }

    // Always show last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<span class="page-ellipsis">...</span>`;
      }
      html += `<button class="page-btn ${
        currentPage === totalPages ? "active" : ""
      }" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    pageNumbers.innerHTML = html;
  }
}

/**
 * Navigate to specific page
 */
function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentPage = page;
  renderPaginatedTable();
  updatePaginationInfo();
  updatePaginationControls();
}

// Event handlers for controls
function handleSearch() {
  searchQuery = document.getElementById("searchInput").value;
  currentPage = 1;
  applyFiltersAndRender();
}

function handleCategoryFilter() {
  categoryFilter = document.getElementById("categoryFilter").value;
  currentPage = 1;
  applyFiltersAndRender();
}

function handleItemsPerPageChange() {
  itemsPerPage = parseInt(document.getElementById("itemsPerPage").value);
  currentPage = 1;
  applyFiltersAndRender();
}

/**
 * Reset all filters and show all data
 */
function resetFilters() {
  searchQuery = "";
  categoryFilter = "";
  currentPage = 1;
  itemsPerPage = 10;

  document.getElementById("searchInput").value = "";
  document.getElementById("categoryFilter").value = "";
  document.getElementById("itemsPerPage").value = "10";

  applyFiltersAndRender();
}

function setupEventListeners() {
  const btnTambah = document.querySelector(".btn-tambah");
  if (btnTambah) {
    btnTambah.addEventListener("click", showAddProductModal);
  }
}

function showAddProductModal() {
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
                        <input type="text" name="KATEGORI">
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
                        <label>Stok Lapangan</label>
                        <input type="number" name="STOK LAPANGAN" value="0">
                    </div>
                    <div class="form-group">
                        <label>Stok Minimum</label>
                        <input type="number" name="STOK MINIMUM" value="0">
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
  const submitBtn = form.querySelector(".btn-simpan");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Prevent double-click
    if (submitBtn.disabled) return;

    // Show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Menyimpan...";

    try {
      await addProduct(new FormData(form));
    } finally {
      // Restore button state (in case of error and modal stays open)
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

async function addProduct(formData) {
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });

  try {
    const result = await addSheetRow(productService.sheetName, data);
    if (result.success) {
      alert("Produk berhasil ditambahkan!");
      closeModal();
      // Clear cache to ensure fresh data is loaded
      await window.IDBCache.clear(productService.cacheKey);
      loadProducts();
    }
  } catch (error) {
    alert("Gagal menambahkan produk: " + error.message);
  }
}

async function editProduct(rowIndex) {
  const newName = prompt("Masukkan nama produk baru:");
  if (newName) {
    try {
      const result = await updateSheetRow(productService.sheetName, rowIndex, {
        "NAMA PRODUK": newName,
      });
      if (result.success) {
        alert("Produk berhasil diupdate!");
        // Clear cache to ensure fresh data is loaded
        await window.IDBCache.clear(productService.cacheKey);
        loadProducts();
      }
    } catch (error) {
      alert("Gagal mengupdate produk: " + error.message);
    }
  }
}

async function deleteProduct(rowIndex) {
  if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
    // Show loading spinner
    if (window.showGlobalLoader) window.showGlobalLoader();

    try {
      const result = await deleteSheetRow(productService.sheetName, rowIndex);
      if (result.success) {
        alert("Produk berhasil dihapus!");
        // Clear cache to ensure fresh data is loaded
        await window.IDBCache.clear(productService.cacheKey);
        loadProducts();
      }
    } catch (error) {
      alert("Gagal menghapus produk: " + error.message);
    } finally {
      // Hide loading spinner
      if (window.hideGlobalLoader) window.hideGlobalLoader();
    }
  }
}

function closeModal() {
  closeModalById("productModal");
}

// Restock Logic
function showRestockModal(rowIndex) {
  const product = productsData.find((p) => p._rowIndex === rowIndex);
  if (!product) return;

  const modalHTML = `
        <div id="restockModal" class="modal">
            <div class="modal-content">
                <h2>Restock Produk</h2>
                <div class="form-group">
                    <label>Produk</label>
                    <input type="text" value="${product["NAMA PRODUK"]} (${product["SKU"]})" disabled style="background: #f0f0f0;">
                </div>
                <div class="form-group">
                    <label>Jumlah Restock (Tambahan)</label>
                    <input type="number" id="restockAmount" placeholder="Masukkan jumlah..." required>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="btn-simpan" onclick="processRestock(${rowIndex})">Simpan</button>
                    <button type="button" class="btn-batal" onclick="closeRestockModal()">Batal</button>
                </div>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  document.getElementById("restockAmount").focus();
}

function closeRestockModal() {
  closeModalById("restockModal");
}

async function processRestock(rowIndex) {
  const amountInput = document.getElementById("restockAmount");
  const amount = parseFloat(amountInput.value);

  if (!amount || amount <= 0) {
    alert("Masukkan jumlah restock yang valid!");
    return;
  }

  const product = productsData.find((p) => p._rowIndex === rowIndex);
  if (!product) return;

  // Get save button and show loading state
  const saveBtn = document.querySelector("#restockModal .btn-simpan");
  if (saveBtn.disabled) return; // Prevent double-click

  saveBtn.disabled = true;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Menyimpan...";

  const currentRestock = parseFloat(product["RESTOCK"] || 0);
  const newRestock = currentRestock + amount;

  try {
    const result = await updateSheetRow(productService.sheetName, rowIndex, {
      RESTOCK: newRestock,
    });
    if (result.success) {
      alert("Restock berhasil! Stok bertambah.");
      closeRestockModal();
      // Clear cache to ensure fresh data is loaded
      await window.IDBCache.clear(productService.cacheKey);
      loadProducts();
    }
  } catch (error) {
    alert("Gagal melakukan restock: " + error.message);
    // Restore button state on error
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}
