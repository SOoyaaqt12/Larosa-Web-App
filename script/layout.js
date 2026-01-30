document.addEventListener("DOMContentLoaded", () => {
  injectLayout();
});

// Handle bfcache - when user navigates back to page
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // Page was restored from bfcache, re-check auth immediately
    if (typeof isLoggedIn === "function" && !isLoggedIn()) {
      window.location.replace("index.html");
      return;
    }
    // Reinject layout if needed
    injectLayout();
  }
});

function injectLayout() {
  // Check authentication first - redirect to login if not authenticated
  if (typeof isLoggedIn === "function" && !isLoggedIn()) {
    window.location.replace("index.html"); // Use replace to prevent back button
    return;
  }

  // Show the page now that auth is verified
  if (typeof showPage === "function") {
    showPage();
  }

  // Check if already injected
  if (document.querySelector(".sidebar")) {
    return;
  }

  // Inject Layout CSS
  if (!document.querySelector('link[href="style/layout.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "style/layout.css";
    document.head.appendChild(link);
  }

  const path = window.location.pathname;
  const page = path.split("/").pop() || "index.html";

  const sidebarHTML = `
    <div class="sidebar">
        <div class="logo-section">
            <div class="logo">
                <img src="asset/image/larosa-logo.png" alt="Larosa Pot" style="width: 100%; height: 100%; object-fit: contain;">
            </div>
            <div class="brand-name">LAROSAPOT</div>
        </div>
        
        <div class="nav-menu">
            <a href="dashboard.html"><div class="nav-item ${
              page === "dashboard.html" ? "active" : ""
            }">Dashboard</div></a>
            <a href="kustomer.html"><div class="nav-item ${
              page === "kustomer.html" ? "active" : ""
            }">Data Pelanggan</div></a>
            <!-- Transaksi Dropdown -->
            <div class="menu-item ${
              page === "kasir.html" || page === "quotation.html" ? "open" : ""
            }">
                <div class="menu-header" onclick="toggleSubmenu(this)">
                    <div style="display:flex; align-items:center; gap:0;">
                        Transaksi
                    </div>
                    <span class="menu-arrow">▶</span>
                </div>
                <div class="submenu">
                    <a href="kasir.html" class="${
                      page === "kasir.html" ? "active" : ""
                    }">Kasir</a>
                    <a href="quotation.html" class="${
                      page === "quotation.html" ? "active" : ""
                    }">Quotation</a>
                </div>
            </div>
            <!-- Riwayat Dropdown -->
            <div class="menu-item ${
              page === "riwayat.html" ||
              page === "pelunasan.html" ||
              page === "data_quotation.html"
                ? "open"
                : ""
            }">
                <div class="menu-header" onclick="toggleSubmenu(this)">
                    <div style="display:flex; align-items:center; gap:0;">
                        Riwayat
                    </div>
                    <span class="menu-arrow">▶</span>
                </div>
                <div class="submenu">
                    <a href="riwayat.html" class="${
                      page === "riwayat.html" ? "active" : ""
                    }">Transaksi</a>
                    <a href="pelunasan.html" class="${
                      page === "pelunasan.html" ? "active" : ""
                    }">Pelunasan</a>
                    <a href="data_quotation.html" class="${
                      page === "data_quotation.html" ? "active" : ""
                    }">Data Quotation</a>
                </div>
            </div>
            <a href="produk.html"><div class="nav-item ${
              page === "produk.html" ? "active" : ""
            }">Stok Produk</div></a>
            <a href="vendor.html"><div class="nav-item ${
              page === "vendor.html" ? "active" : ""
            }">Data Vendor</div></a>
        </div>

        <div class="nav-bottom">
           <a href="#" onclick="logout(); return false;" style="text-decoration: none;"><div class="nav-item logout">
                <span>Logout</span>
                <span>➜</span>
            </div></a>
            <div class="nav-item settings">
                <span>Settings</span>
                <span>⚙</span>
            </div>
        </div>
    </div>`;

  const headerHTML = `
        <div class="header">
            <h1>${getPageTitle(page)}</h1>
            <div class="user-avatar"></div>
        </div>
    `;

  document.body.insertAdjacentHTML("afterbegin", sidebarHTML);

  const mainContent = document.querySelector(".main-content");
  if (mainContent && !mainContent.querySelector(".header")) {
    mainContent.insertAdjacentHTML("afterbegin", headerHTML);
  }

  // Inject Global Loader
  if (!document.querySelector(".global-loader")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="global-loader"><div class="spinner"></div></div>`,
    );
  }
}

// Global Loader Control
window.showGlobalLoader = function () {
  const loader = document.querySelector(".global-loader");
  if (loader) loader.classList.add("visible");
};

// Sidebar Toggle Logic
window.toggleSubmenu = function (header) {
  const menuItem = header.parentElement;
  menuItem.classList.toggle("open");
};

window.hideGlobalLoader = function () {
  const loader = document.querySelector(".global-loader");
  if (loader) loader.classList.remove("visible");
};

function getPageTitle(page) {
  switch (page) {
    case "dashboard.html":
      return "Dashboard";
    case "kasir.html":
      return "Kasir";
    case "produk.html":
      return "Stok Produk";
    case "riwayat.html":
      return "Riwayat Transaksi";
    case "kustomer.html":
      return "Data Pelanggan";
    case "invoice.html":
      return "Invoice";
    case "quotation.html":
      return "Quotation";
    case "data_quotation.html":
      return "Data Quotation";
    case "quotation_view.html":
      return "Quotation View";
    case "vendor.html":
      return "Data Vendor";
    case "pelunasan.html":
      return "Pelunasan";
    default:
      return "Dashboard";
  }
}
