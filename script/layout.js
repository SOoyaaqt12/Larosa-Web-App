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
            <a href="kasir.html"><div class="nav-item ${
              page === "kasir.html" ? "active" : ""
            }">Kasir</div></a>
            <a href="produk.html"><div class="nav-item ${
              page === "produk.html" ? "active" : ""
            }">Stok Produk</div></a>
            <a href="riwayat.html"><div class="nav-item ${
              page === "riwayat.html" ? "active" : ""
            }">Riwayat</div></a>
            <a href="kustomer.html"><div class="nav-item ${
              page === "kustomer.html" ? "active" : ""
            }">Data Pelanggan</div></a>
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
}

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
    default:
      return "Dashboard";
  }
}
