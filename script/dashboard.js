/**
 * Dashboard - Advanced Analytics Implementation
 * Handles dynamic charting with filtering and single-container switcher
 */

// Global State
let mainChart = null;
let rawData = {
  customers: [],
  products: [],
  invoices: [],
  pelunasan: [],
  vendors: [],
};
let currentChartType = "omsetHarian";

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupFilterListeners();
  loadDashboardData();
});

function setupFilterListeners() {
  const filterYear = document.getElementById("filterYear");
  const filterMonth = document.getElementById("filterMonth");

  if (filterYear) filterYear.addEventListener("change", refreshCurrentChart);
  if (filterMonth) filterMonth.addEventListener("change", refreshCurrentChart);
}

/**
 * Load all dashboard data with caching
 */
async function loadDashboardData() {
  // Step 1: Try to show cached data immediately
  const cached = await window.IDBCache?.get("dashboard_data_cache");
  if (cached && cached.data) {
    rawData = cached.data;
    updateDashboardUI();
    if (cached.valid) return;
  }

  // Step 2: Fetch fresh data
  try {
    const sheets = [
      "KOSTUMER",
      "PERSEDIAAN BARANG",
      "INVOICE",
      "DP/Pelunasan",
      "VENDOR",
    ];
    const results = await Promise.all(
      sheets.map((s) => fetchSheetData(s).catch(() => ({ data: [] }))),
    );

    rawData = {
      customers: results[0].data,
      products: results[1].data,
      invoices: results[2].data,
      pelunasan: results[3].data,
      vendors: results[4].data,
    };

    // Save to cache
    await window.IDBCache?.set("dashboard_data_cache", rawData);

    updateDashboardUI();
    console.log("Dashboard data refreshed from server");
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
}

/**
 * Refresh UI Components
 */
function updateDashboardUI() {
  displayStats();
  populateYearFilter();
  refreshCurrentChart();
}

/**
 * Display Top Stat Cards
 */
function displayStats() {
  const { customers, products, invoices, vendors } = rawData;

  const formatNum = (n) => Math.round(n).toLocaleString("id-ID");
  const formatCurr = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");

  // Stats
  document.getElementById("statPelanggan").textContent = formatNum(
    customers.length,
  );
  document.getElementById("statVendor").textContent = formatNum(vendors.length);

  // Available Stock
  const stock = products.reduce(
    (acc, p) => acc + (parseFloat(p["STOK SISTEM"]) || 0),
    0,
  );
  document.getElementById("statBarang").textContent = formatNum(stock);

  // Sold Items
  const sold = invoices.reduce(
    (acc, row) => acc + (parseFloat(row["JUMLAH"]) || 0),
    0,
  );
  document.getElementById("statTerjual").textContent = formatNum(sold);

  // Grouped Invoices for Money Calcs
  const groups = groupByInvoice(invoices);
  let omset = 0;
  let pendapatan = 0;

  Object.values(groups).forEach((rows) => {
    const main = rows[0];
    const sub = parseFloat(main["SUB TOTAL"]) || 0;
    const ongkir = parseFloat(main["ONGKIR"]) || 0;
    const packing = parseFloat(main["PACKING"]) || 0;

    omset += sub;
    pendapatan += sub + ongkir + packing;
  });

  document.getElementById("statOmset").textContent = formatCurr(omset);
  document.getElementById("statPendapatan").textContent =
    formatCurr(pendapatan);
}

/**
 * Filter Management
 */
function populateYearFilter() {
  const filterYear = document.getElementById("filterYear");
  if (!filterYear) return;

  const years = new Set();
  rawData.invoices.forEach((row) => {
    const dateStr = row["TANGGAL"];
    if (dateStr) {
      const date = parseInvoiceDate(dateStr);
      if (date) years.add(date.getFullYear());
    }
  });

  const sortedYears = Array.from(years).sort((a, b) => b - a);

  // Keep "All" and add new
  const currentValue = filterYear.value;
  filterYear.innerHTML = '<option value="all">Semua Tahun</option>';
  sortedYears.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    filterYear.appendChild(opt);
  });

  if (currentValue && years.has(parseInt(currentValue))) {
    filterYear.value = currentValue;
  }
}

function getFilteredData() {
  const yearFilter = document.getElementById("filterYear").value;
  const monthFilter = document.getElementById("filterMonth").value;

  return rawData.invoices.filter((row) => {
    const dateStr = row["TANGGAL"];
    if (!dateStr) return false;

    const date = parseInvoiceDate(dateStr);
    if (!date) return false;

    const matchesYear =
      yearFilter === "all" || date.getFullYear().toString() === yearFilter;
    const matchesMonth =
      monthFilter === "all" || date.getMonth().toString() === monthFilter;

    return matchesYear && matchesMonth;
  });
}

/**
 * Chart Switching Logic
 */
function switchChart(type) {
  currentChartType = type;

  // Update UI Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick").includes(`'${type}'`)) {
      btn.classList.add("active");
    }
  });

  refreshCurrentChart();
}

function refreshCurrentChart() {
  const data = getFilteredData();
  const ctx = document.getElementById("mainChart").getContext("2d");

  if (mainChart) mainChart.destroy();

  let chartConfig = null;

  switch (currentChartType) {
    case "omsetHarian":
      chartConfig = getConfigOmsetHarian(data);
      break;
    case "omsetSales":
      chartConfig = getConfigOmsetSales(data);
      break;
    case "omsetProduk":
      chartConfig = getConfigOmsetProduk(data);
      break;
    case "qtyProduk":
      chartConfig = getConfigQtyProduk(data);
      break;
    case "biayaProduk":
      chartConfig = getConfigBiayaProduk(data);
      break;
    case "kotaCust":
      chartConfig = getConfigKotaCust(data);
      break;
  }

  if (chartConfig) {
    mainChart = new Chart(ctx, chartConfig);
  }
}

/**
 * CHART CONFIGURATORS
 */

function getConfigOmsetHarian(invoices) {
  const groups = groupByInvoice(invoices);
  const dailyData = {};

  Object.values(groups).forEach((rows) => {
    const main = rows[0];
    const date = parseInvoiceDate(main["TANGGAL"]);
    if (!date) return;

    const key = date.toISOString().split("T")[0];
    dailyData[key] =
      (dailyData[key] || 0) + (parseFloat(main["SUB TOTAL"]) || 0);
  });

  const sortedKeys = Object.keys(dailyData).sort();
  const labels = sortedKeys.map((k) => {
    const d = new Date(k);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  });
  const values = sortedKeys.map((k) => dailyData[k]);

  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Omset Harian",
          data: values,
          borderColor: "#7da869",
          backgroundColor: "rgba(125, 168, 105, 0.2)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) =>
              "Rp" +
              (v >= 1000000
                ? (v / 1000000).toFixed(1) + "Jt"
                : v.toLocaleString()),
          },
        },
      },
    },
  };
}

function getConfigOmsetSales(invoices) {
  const groups = groupByInvoice(invoices);
  const salesData = {};

  Object.values(groups).forEach((rows) => {
    const main = rows[0];
    const sales = main["KASIR"] || "Unknown";
    salesData[sales] =
      (salesData[sales] || 0) + (parseFloat(main["SUB TOTAL"]) || 0);
  });

  const sorted = Object.entries(salesData).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map((s) => s[0]);
  const values = sorted.map((s) => s[1]);

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Omset",
          data: values,
          backgroundColor: "#6b8e5f",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            callback: (v) =>
              "Rp" +
              (v >= 1000000
                ? (v / 1000000).toFixed(1) + "Jt"
                : v.toLocaleString()),
          },
        },
      },
    },
  };
}

function getConfigOmsetProduk(invoices) {
  const productData = {};
  invoices.forEach((row) => {
    const sku = row["SKU"] || row["PRODUK"];
    if (!sku) return;
    productData[sku] =
      (productData[sku] || 0) + (parseFloat(row["TOTAL"]) || 0);
  });

  const top10 = Object.entries(productData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    type: "bar",
    data: {
      labels: top10.map((i) => i[0]),
      datasets: [
        {
          label: "Omset Produk",
          data: top10.map((i) => i[1]),
          backgroundColor: "#7da869",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  };
}

function getConfigQtyProduk(invoices) {
  const productQty = {};
  invoices.forEach((row) => {
    const sku = row["SKU"] || row["PRODUK"];
    if (!sku) return;
    productQty[sku] = (productQty[sku] || 0) + (parseFloat(row["JUMLAH"]) || 0);
  });

  const top10 = Object.entries(productQty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    type: "bar",
    data: {
      labels: top10.map((i) => i[0]),
      datasets: [
        {
          label: "Qty Terjual",
          data: top10.map((i) => i[1]),
          backgroundColor: "#a5d6a7",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  };
}

function getConfigBiayaProduk(invoices) {
  // Use product HPP from product list if available, or just use total if we don't have HPP here
  const costData = {};

  // Create a map of sku to HPP from rawData.products
  const hppMap = {};
  rawData.products.forEach((p) => {
    const sku = p["SKU"];
    if (sku)
      hppMap[sku] = parseFloat(String(p["HPP"]).replace(/[^0-9.-]+/g, "")) || 0;
  });

  invoices.forEach((row) => {
    const sku = row["SKU"];
    if (!sku) return;
    const qty = parseFloat(row["JUMLAH"]) || 0;
    const hpp = hppMap[sku] || 0;
    costData[sku] = (costData[sku] || 0) + qty * hpp;
  });

  const sorted = Object.entries(costData)
    .filter((i) => i[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return {
    type: "doughnut",
    data: {
      labels: sorted.map((i) => i[0]),
      datasets: [
        {
          data: sorted.map((i) => i[1]),
          backgroundColor: [
            "#2e7d32",
            "#388e3c",
            "#43a047",
            "#4caf50",
            "#66bb6a",
            "#81c784",
            "#a5d8a7",
            "#c8e6c9",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } },
    },
  };
}

function getConfigKotaCust(invoices) {
  const cityData = {};
  const groups = groupByInvoice(invoices);

  Object.values(groups).forEach((rows) => {
    const main = rows[0];
    const city = main["Kota"] || main["KOTA"] || "Lainnya";
    cityData[city] = (cityData[city] || 0) + 1;
  });

  const sorted = Object.entries(cityData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    type: "pie",
    data: {
      labels: sorted.map((i) => i[0]),
      datasets: [
        {
          data: sorted.map((i) => i[1]),
          backgroundColor: [
            "#2e7d32",
            "#1b5e20",
            "#4caf50",
            "#81c784",
            "#a5d6a7",
            "#c8e6c9",
            "#e8f5e9",
            "#004d40",
            "#00796b",
            "#009688",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } },
    },
  };
}

/**
 * Helpers
 */
function groupByInvoice(data) {
  const groups = {};
  const invoiceKeys = ["INVOICE", "NO PESANAN"];
  let currentKey = null;

  data.forEach((row) => {
    let key = null;
    for (const k of invoiceKeys) {
      if (row[k]) {
        key = row[k];
        break;
      }
    }

    if (key) {
      currentKey = key;
      if (!groups[currentKey]) groups[currentKey] = [];
    }
    if (currentKey) groups[currentKey].push(row);
  });
  return groups;
}

function parseInvoiceDate(dateStr) {
  if (!dateStr) return null;
  // Format DD-MMM-YYYY or YYYY-MM-DD
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts[0].length === 4) return new Date(dateStr); // YYYY-MM-DD

    // DD-MMM-YYYY
    const day = parseInt(parts[0]);
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
    const month = months.indexOf(parts[1]);
    const year = parseInt(parts[2]);
    if (month !== -1) return new Date(year, month, day);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Global Exports
window.switchChart = switchChart;
window.refreshCurrentChart = refreshCurrentChart;
