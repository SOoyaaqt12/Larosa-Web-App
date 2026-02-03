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
    a.toUpperCase().localeCompare(b.toUpperCase()),
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
            <td>${product["STOK AWAL"] || 0}</td>
            <td>${product["RESTOCK"] || 0}</td>
            <td>${product["TERJUAL"] || 0}</td>
            <td>${product["STOK AKHIR"] || 0}</td>
            <td>${product["STOK LAPANG"] || 0}</td>
            <td>${product["SELISIH"] || 0}</td>
            <td>${product["STOK MINIMUM"] || 0}</td>
            <td>${Math.max(0, -(product["KEKURANGAN STOK"] || 0))}</td>
            <td>${formatCurrency(product["HPP"] || 0)}</td>
            <td>${formatCurrency(product["HARGA JUAL"] || 0)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-stok-lapang" onclick="showStokLapangModal(${
                      product._rowIndex
                    })">Stok Lapang</button>
                    <button class="btn-edit" onclick="showEditProductModal(${
                      product._rowIndex
                    })">Edit</button>
                    <button class="btn-delete" onclick="deleteProduct(${
                      product._rowIndex
                    })">Delete</button>
                </div>
            </td>
        </tr>
    `,
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
  // Get unique categories for dropdown
  const categoryMap = new Map();
  productsData.forEach((p) => {
    const cat = getValueFromKeys(p, ["KETAGORI", "KATEGORI"], "")
      .toString()
      .trim();
    if (cat) {
      categoryMap.set(cat.toUpperCase(), cat);
    }
  });
  const categories = Array.from(categoryMap.values()).sort();

  const modalHTML = `
        <div id="productModal" class="modal">
            <div class="modal-content">
                <h2>Tambah Produk Baru</h2>
                <form id="productForm">
                    <div class="product-form-grid">
                        <div class="form-group">
                            <label>Kode SKU</label>
                            <input type="text" name="SKU" required placeholder="Contoh: PRD-001">
                        </div>
                        <div class="form-group">
                            <label>Satuan</label>
                            <input type="text" name="SATUAN" value="Pcs">
                        </div>
                        <div class="form-group full-width">
                            <label>Nama Produk</label>
                            <input type="text" name="NAMA PRODUK" required placeholder="Masukkan nama lengkap produk">
                        </div>
                        <div class="form-group">
                            <label>Kategori</label>
                            <select name="KATEGORI_SELECT" id="categorySelect" required>
                                <option value="">-- Pilih Kategori --</option>
                                ${categories
                                  .map(
                                    (cat) =>
                                      `<option value="${cat}">${cat}</option>`,
                                  )
                                  .join("")}
                                <option value="NEW_CATEGORY">+ Tambah Kategori Baru...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Stok Awal</label>
                            <input type="number" name="STOK_AWAL" value="0" min="0">
                        </div>
                        <div class="form-group" id="newCategoryGroup" style="display: none; grid-column: span 2;">
                            <label>Nama Kategori Baru</label>
                            <input type="text" name="NEW_KATEGORI" id="newCategoryInput" placeholder="Masukkan kategori baru...">
                        </div>
                        <div class="form-group">
                            <label>Stok Minimum</label>
                            <input type="number" name="STOK MINIMUM" value="0" min="0">
                        </div>
                        <div class="form-group">
                            <label>HPP</label>
                            <input type="number" name="HPP" value="0" min="0">
                        </div>
                        <div class="form-group">
                            <label>Harga Jual</label>
                            <input type="number" name="HARGA JUAL" value="0" min="0">
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-simpan">Simpan Produk</button>
                        <button type="button" class="btn-batal" onclick="closeModal()">Batal</button>
                    </div>
                </form>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const form = document.getElementById("productForm");
  const categorySelect = document.getElementById("categorySelect");
  const newCategoryGroup = document.getElementById("newCategoryGroup");
  const newCategoryInput = document.getElementById("newCategoryInput");
  const submitBtn = form.querySelector(".btn-simpan");

  // Handle category selection change
  categorySelect.addEventListener("change", () => {
    if (categorySelect.value === "NEW_CATEGORY") {
      newCategoryGroup.style.display = "block";
      newCategoryInput.required = true;
      newCategoryInput.focus();
    } else {
      newCategoryGroup.style.display = "none";
      newCategoryInput.required = false;
    }
  });

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

  // Handle Kategori
  const categorySelect = formData.get("KATEGORI_SELECT");
  if (categorySelect === "NEW_CATEGORY") {
    data["KATEGORI"] = formData.get("NEW_KATEGORI");
  } else {
    data["KATEGORI"] = categorySelect;
  }

  // Handle Stok Awal mapping
  const stokAwal = formData.get("STOK_AWAL") || 0;
  data["STOK AWAL"] = stokAwal;
  data["STOK LAPANGAN"] = stokAwal;

  // Other fields
  data["SKU"] = formData.get("SKU");
  data["NAMA PRODUK"] = formData.get("NAMA PRODUK");
  data["SATUAN"] = formData.get("SATUAN");
  data["STOK MINIMUM"] = formData.get("STOK MINIMUM");
  data["HPP"] = formData.get("HPP");
  data["HARGA JUAL"] = formData.get("HARGA JUAL");

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

async function showEditProductModal(rowIndex) {
  const product = productsData.find((p) => p._rowIndex === rowIndex);
  if (!product) return;

  // Get unique categories for dropdown
  const categoryMap = new Map();
  productsData.forEach((p) => {
    const cat = getValueFromKeys(p, ["KETAGORI", "KATEGORI"], "")
      .toString()
      .trim();
    if (cat) categoryMap.set(cat.toUpperCase(), cat);
  });
  const categories = Array.from(categoryMap.values()).sort();

  const currentCategory = getValueFromKeys(
    product,
    ["KETAGORI", "KATEGORI"],
    "",
  )
    .toString()
    .trim();

  const modalHTML = `
        <div id="productModal" class="modal">
            <div class="modal-content">
                <h2 class="modal-edit-header">Edit Produk</h2>
                <form id="editProductForm">
                    <div class="product-form-grid">
                        <div class="form-group">
                            <label>Kode SKU</label>
                            <input type="text" name="SKU" value="${
                              product["SKU"] || ""
                            }" required>
                        </div>
                        <div class="form-group">
                            <label>Satuan</label>
                            <input type="text" name="SATUAN" value="${
                              product["SATUAN"] || ""
                            }">
                        </div>
                        <div class="form-group full-width">
                            <label>Nama Produk</label>
                            <input type="text" name="NAMA PRODUK" value="${
                              product["NAMA PRODUK"] || ""
                            }" required>
                        </div>
                        <div class="form-group">
                            <label>Kategori</label>
                            <select name="KATEGORI_SELECT" id="categorySelectEdit" required>
                                <option value="">-- Pilih Kategori --</option>
                                ${categories
                                  .map(
                                    (cat) =>
                                      `<option value="${cat}" ${
                                        cat === currentCategory
                                          ? "selected"
                                          : ""
                                      }>${cat}</option>`,
                                  )
                                  .join("")}
                                <option value="NEW_CATEGORY">+ Tambah Kategori Baru...</option>
                            </select>
                        </div>
                        <div class="form-group" id="newCategoryGroupEdit" style="display: none; grid-column: span 2;">
                            <label>Nama Kategori Baru</label>
                            <input type="text" name="NEW_KATEGORI" id="newCategoryInputEdit" placeholder="Masukkan kategori baru...">
                        </div>
                        <div class="form-group">
                            <label>Stok Minimum</label>
                            <input type="number" name="STOK MINIMUM" value="${
                              product["STOK MINIMUM"] || 0
                            }" min="0">
                        </div>
                        <div class="form-group">
                            <label>HPP</label>
                            <input type="number" name="HPP" value="${
                              product["HPP"] || 0
                            }" min="0">
                        </div>
                        <div class="form-group">
                            <label>Harga Jual</label>
                            <input type="number" name="HARGA JUAL" value="${
                              product["HARGA JUAL"] || 0
                            }" min="0">
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-simpan btn-update">Update Produk</button>
                        <button type="button" class="btn-batal" onclick="closeModal()">Batal</button>
                    </div>
                </form>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const form = document.getElementById("editProductForm");
  const categorySelect = document.getElementById("categorySelectEdit");
  const newCategoryGroup = document.getElementById("newCategoryGroupEdit");
  const newCategoryInput = document.getElementById("newCategoryInputEdit");
  const submitBtn = form.querySelector(".btn-simpan");

  categorySelect.addEventListener("change", () => {
    if (categorySelect.value === "NEW_CATEGORY") {
      newCategoryGroup.style.display = "block";
      newCategoryInput.required = true;
      newCategoryInput.focus();
    } else {
      newCategoryGroup.style.display = "none";
      newCategoryInput.required = false;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengupdate...";

    try {
      await updateProduct(rowIndex, new FormData(form));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Produk";
    }
  });
}

async function updateProduct(rowIndex, formData) {
  const data = {};

  // Handle Kategori
  const categorySelect = formData.get("KATEGORI_SELECT");
  if (categorySelect === "NEW_CATEGORY") {
    data["KATEGORI"] = formData.get("NEW_KATEGORI");
  } else {
    data["KATEGORI"] = categorySelect;
  }

  // Other fields
  data["SKU"] = formData.get("SKU");
  data["NAMA PRODUK"] = formData.get("NAMA PRODUK");
  data["SATUAN"] = formData.get("SATUAN");
  data["STOK MINIMUM"] = formData.get("STOK MINIMUM");
  data["HPP"] = formData.get("HPP");
  data["HARGA JUAL"] = formData.get("HARGA JUAL");

  try {
    const result = await updateSheetRow(
      productService.sheetName,
      rowIndex,
      data,
    );
    if (result.success) {
      alert("Produk berhasil diupdate!");
      closeModal();
      await window.IDBCache.clear(productService.cacheKey);
      loadProducts();
    }
  } catch (error) {
    alert("Gagal mengupdate produk: " + error.message);
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

// Row-level Stok Lapang Logic
function showStokLapangModal(rowIndex) {
  const product = productsData.find((p) => p._rowIndex === rowIndex);
  if (!product) return;

  const modalHTML = `
        <div id="productModal" class="modal">
            <div class="modal-content">
                <h2 style="border-bottom-color: #9c27b0;">Update Stok Lapangan</h2>
                <div class="form-group">
                    <label>Produk</label>
                    <input type="text" value="${product["NAMA PRODUK"]} (${
                      product["SKU"]
                    })" disabled style="background: #f0f0f0;">
                </div>
                <div class="form-group">
                    <label>Stok Lapangan Aktual</label>
                    <input type="number" id="stokLapangAmount" value="${product["STOK LAPANG"] || 0}" placeholder="Masukkan stok aktual..." required>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="btn-simpan" style="background-color: #9c27b0;" onclick="processStokLapang(${rowIndex})">Update Stok Lapangan</button>
                    <button type="button" class="btn-batal" onclick="closeModal()">Batal</button>
                </div>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  document.getElementById("stokLapangAmount").focus();
}

async function processStokLapang(rowIndex) {
  const amountInput = document.getElementById("stokLapangAmount");
  const amount = parseFloat(amountInput.value);

  if (isNaN(amount) || amount < 0) {
    alert("Masukkan jumlah yang valid!");
    return;
  }

  const product = productsData.find((p) => p._rowIndex === rowIndex);
  if (!product) return;

  const saveBtn = document.querySelector(".modal .btn-simpan");
  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";

  // Set stok lapangan directly (replace, not add)
  const newStokLapang = amount;

  try {
    const result = await updateSheetRow(productService.sheetName, rowIndex, {
      "STOK LAPANG": newStokLapang,
    });
    if (result.success) {
      alert("Stok lapangan berhasil diupdate!");
      closeModal();
      await window.IDBCache.clear(productService.cacheKey);
      loadProducts();
    }
  } catch (error) {
    alert("Gagal update stok lapangan: " + error.message);
    saveBtn.disabled = false;
    saveBtn.textContent = "Update Stok Lapangan";
  }
}
