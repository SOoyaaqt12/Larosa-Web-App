/**
 * Dashboard - Real Data Implementation
 * Fetches data from Google Sheets and displays in dashboard
 */

// Sheet names
const KOSTUMER_SHEET = "KOSTUMER";
const PRODUK_SHEET = "PERSEDIAAN BARANG";
const INVOICE_SHEET = "INVOICE";
const PELUNASAN_SHEET = "DP/Pelunasan";
const VENDOR_SHEET = "VENDOR";

// Cache keys
const DASHBOARD_CACHE_KEY = "dashboard_data_cache";
const DASHBOARD_CACHE_TIMESTAMP_KEY = "dashboard_cache_timestamp";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Chart instances
let salesChart = null;
let categoryChart = null;

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
});

/**
 * Cache functions
 */
function getDashboardCache() {
  try {
    const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error("Error reading dashboard cache:", e);
  }
  return null;
}

function setDashboardCache(data) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(DASHBOARD_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.error("Error saving dashboard cache:", e);
  }
}

function isCacheValid() {
  try {
    const timestamp = localStorage.getItem(DASHBOARD_CACHE_TIMESTAMP_KEY);
    if (timestamp) {
      return Date.now() - parseInt(timestamp) < CACHE_DURATION;
    }
  } catch (e) {}
  return false;
}

/**
 * Load all dashboard data with caching
 */
async function loadDashboardData() {
  // Step 1: Show cached data immediately if available (using IndexedDB)
  const cached = await window.IDBCache?.get(DASHBOARD_CACHE_KEY);
  if (cached && cached.data) {
    console.log("Showing cached dashboard data");
    displayStats(
      cached.data.customers,
      cached.data.products,
      cached.data.invoices,
      cached.data.pelunasan,
      cached.data.vendors
    );
    renderSalesChart(cached.data.invoices);
    renderCategoryChart(cached.data.invoices);

    // If cache is still valid, don't fetch new data
    if (cached.valid) {
      console.log("Cache still valid, skipping refresh");
      return;
    }
  }

  // Step 2: Fetch fresh data in background
  try {
    const [customers, products, invoices, pelunasan, vendors] =
      await Promise.all([
        fetchSheetData(KOSTUMER_SHEET).catch(() => ({ data: [] })),
        fetchSheetData(PRODUK_SHEET).catch(() => ({ data: [] })),
        fetchSheetData(INVOICE_SHEET).catch(() => ({ data: [] })),
        fetchSheetData(PELUNASAN_SHEET).catch(() => ({ data: [] })),
        fetchSheetData(VENDOR_SHEET).catch(() => ({ data: [] })),
      ]);

    // Save to IndexedDB
    const dataToCache = {
      customers: customers.data,
      products: products.data,
      invoices: invoices.data,
      pelunasan: pelunasan.data,
      vendors: vendors.data,
    };
    await window.IDBCache?.set(DASHBOARD_CACHE_KEY, dataToCache);

    // Update display with fresh data
    displayStats(
      customers.data,
      products.data,
      invoices.data,
      pelunasan.data,
      vendors.data
    );
    renderSalesChart(invoices.data);
    renderCategoryChart(invoices.data);

    console.log("Dashboard data refreshed from server");
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
}

/**
 * Display stat cards with real data
 */
function displayStats(customers, products, invoices, pelunasan, vendors = []) {
  // Format number helper (no decimals)
  const formatNumber = (num) => {
    return Math.round(num).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    });
  };

  const formatCurrency = (num) => {
    return (
      "Rp" +
      Math.round(num).toLocaleString("id-ID", { maximumFractionDigits: 0 })
    );
  };

  // 1. Jumlah Pelanggan
  const jumlahPelanggan = customers.length;
  document.getElementById("statPelanggan").textContent =
    formatNumber(jumlahPelanggan);

  // 2. Jumlah Vendor
  const jumlahVendor = vendors.length;
  document.getElementById("statVendor").textContent =
    formatNumber(jumlahVendor);

  // 2. Barang Tersedia (sum of STOK SISTEM)
  let barangTersedia = 0;
  products.forEach((p) => {
    const stok = parseFloat(p["STOK SISTEM"]) || 0;
    barangTersedia += stok;
  });
  document.getElementById("statBarang").textContent =
    formatNumber(barangTersedia);

  // Group invoices by NO PESANAN/INVOICE to get unique transactions
  const invoiceGroups = groupByInvoice(invoices);

  // 3. Produk Terjual (sum of JUMLAH from INVOICE)
  let produkTerjual = 0;
  invoices.forEach((row) => {
    const jumlah = parseFloat(row["JUMLAH"]) || 0;
    produkTerjual += jumlah;
  });
  document.getElementById("statTerjual").textContent =
    formatNumber(produkTerjual);

  // 4. Penjualan (sum of TOTAL TAGIHAN from unique invoices)
  let totalPenjualan = 0;
  Object.keys(invoiceGroups).forEach((key) => {
    const mainRow = invoiceGroups[key][0];
    const total = parseFloat(mainRow["TOTAL TAGIHAN"]) || 0;
    totalPenjualan += total;
  });
  document.getElementById("statPenjualan").textContent =
    formatCurrency(totalPenjualan);

  // 5. Pendapatan Diterima Dimuka (DP 1 + DP 2 from pelunasan where SISA TAGIHAN > 0)
  const pelunasanGroups = groupByInvoice(pelunasan);
  let dpTotal = 0;
  Object.keys(pelunasanGroups).forEach((key) => {
    const mainRow = pelunasanGroups[key][0];
    const sisa = parseFloat(mainRow["SISA TAGIHAN"]) || 0;
    if (sisa > 0) {
      const dp1 = parseFloat(mainRow["DP 1"]) || 0;
      const dp2 = parseFloat(mainRow["DP 2"]) || 0;
      dpTotal += dp1 + dp2;
    }
  });
  document.getElementById("statDP").textContent = formatCurrency(dpTotal);
}

/**
 * Group data by invoice/order number
 */
function groupByInvoice(data) {
  const groups = {};
  const invoiceKeys = ["INVOICE", "NO PESANAN", "NO'PESANAN", "NO\nPESANAN"];
  let currentOrderNo = null;

  data.forEach((row) => {
    let noPesanan = null;
    for (const key of invoiceKeys) {
      if (row[key]) {
        noPesanan = row[key];
        break;
      }
    }

    if (noPesanan) {
      currentOrderNo = noPesanan;
      if (!groups[currentOrderNo]) {
        groups[currentOrderNo] = [];
      }
    }

    if (currentOrderNo) {
      groups[currentOrderNo].push(row);
    }
  });

  return groups;
}

/**
 * Render Sales Trend Chart
 */
function renderSalesChart(invoices) {
  // Group sales by date (last 30 days)
  const salesByDate = {};
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Group by invoice first
  const invoiceGroups = groupByInvoice(invoices);

  Object.keys(invoiceGroups).forEach((key) => {
    const mainRow = invoiceGroups[key][0];
    const tanggal = mainRow["TANGGAL"];
    if (!tanggal) return;

    const date = new Date(tanggal);
    if (isNaN(date.getTime())) return;

    // Format date as YYYY-MM-DD
    const dateKey = date.toISOString().split("T")[0];
    const total = parseFloat(mainRow["TOTAL TAGIHAN"]) || 0;

    if (!salesByDate[dateKey]) {
      salesByDate[dateKey] = 0;
    }
    salesByDate[dateKey] += total;
  });

  // Sort dates
  const sortedDates = Object.keys(salesByDate).sort();
  const last15Dates = sortedDates.slice(-15);

  // Prepare chart data
  const labels = last15Dates.map((d) => {
    const date = new Date(d);
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  });

  const data = last15Dates.map((d) => salesByDate[d] || 0);

  // Destroy existing chart if exists
  if (salesChart) {
    salesChart.destroy();
  }

  const salesCtx = document.getElementById("salesChart").getContext("2d");
  salesChart = new Chart(salesCtx, {
    type: "line",
    data: {
      labels: labels.length > 0 ? labels : ["No Data"],
      datasets: [
        {
          label: "Sales",
          data: data.length > 0 ? data : [0],
          borderColor: "#2d5a2d",
          backgroundColor: "rgba(45, 90, 45, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              if (value >= 1000000) {
                return "Rp" + (value / 1000000).toFixed(1) + "Jt";
              }
              return "Rp" + value.toLocaleString("id-ID");
            },
          },
        },
      },
    },
  });
}

/**
 * Render Category Chart
 */
function renderCategoryChart(invoices) {
  // Group by category
  const categoryData = {};

  invoices.forEach((row) => {
    const kategori = row["KATEGORI"] || "Lainnya";
    const jumlah = parseFloat(row["JUMLAH"]) || 0;

    if (!categoryData[kategori]) {
      categoryData[kategori] = 0;
    }
    categoryData[kategori] += jumlah;
  });

  // Sort by value and take top 8
  const sorted = Object.entries(categoryData)
    .filter(([k, v]) => k && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const labels = sorted.map(([k]) => k);
  const data = sorted.map(([, v]) => v);

  const colors = [
    "#ff9800",
    "#ff6b00",
    "#00bcd4",
    "#4caf50",
    "#8bc34a",
    "#ffeb3b",
    "#ffc107",
    "#f44336",
  ];

  // Destroy existing chart if exists
  if (categoryChart) {
    categoryChart.destroy();
  }

  const categoryCtx = document.getElementById("categoryChart").getContext("2d");
  categoryChart = new Chart(categoryCtx, {
    type: "doughnut",
    data: {
      labels: labels.length > 0 ? labels : ["No Data"],
      datasets: [
        {
          data: data.length > 0 ? data : [1],
          backgroundColor: colors.slice(0, Math.max(labels.length, 1)),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            generateLabels: function (chart) {
              const data = chart.data;
              if (
                !data.datasets[0].data ||
                data.datasets[0].data.length === 0
              ) {
                return [];
              }
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                const percentage =
                  total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return {
                  text: `${label} - ${percentage}%`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i,
                };
              });
            },
          },
        },
      },
    },
  });
}
