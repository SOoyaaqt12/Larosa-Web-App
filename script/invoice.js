const ITEMS_PER_PAGE = 20;

document.addEventListener("DOMContentLoaded", () => {
  loadInvoiceData();
});

function loadInvoiceData() {
  const dataString = sessionStorage.getItem("invoiceData");
  if (!dataString) {
    alert("Data invoice tidak ditemukan!");
    return;
  }

  try {
    const data = JSON.parse(dataString);
    renderMultiPageInvoice(data);
  } catch (e) {
    console.error("Error parsing invoice data:", e);
    alert("Terjadi kesalahan saat memuat data invoice.");
  }
}

function renderMultiPageInvoice(data) {
  const pagesContainer = document.getElementById("pagesContainer");
  pagesContainer.innerHTML = "";

  const validItems = (data.items || []).filter(
    (item) => item.sku || item.produk,
  );
  const totalItems = validItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  // Helpers
  const formatCurrency = (val) =>
    "Rp" + (parseFloat(val) || 0).toLocaleString("id-ID");
  const formatDate = (dateVal) => {
    if (!dateVal) return "-";
    const str = String(dateVal).trim();
    const monthNames = [
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

    // If already in DD-Mon-YYYY format, return as-is
    const ddMonYYYY = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (ddMonYYYY) {
      return `${ddMonYYYY[1].padStart(2, "0")}-${ddMonYYYY[2]}-${ddMonYYYY[3]}`;
    }

    // If in ISO format (contains T)
    if (str.includes("T")) {
      const isoDate = str.split("T")[0];
      const parts = isoDate.split("-");
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const dayNum = parseInt(day, 10) + 1; // +1 for UTC+7 offset compensation
        return `${String(dayNum).padStart(2, "0")}-${monthNames[monthIdx]}-${year}`;
      }
    }

    // If in YYYY-MM-DD
    const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const monthIdx = parseInt(ymd[2], 10) - 1;
      return `${ymd[3]}-${monthNames[monthIdx]}-${ymd[1]}`;
    }

    return str;
  };

  for (let i = 0; i < totalPages; i++) {
    const isFirstPage = i === 0;
    const isLastPage = i === totalPages - 1;
    const startIndex = i * ITEMS_PER_PAGE;
    const pageItems = validItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const pageEl = document.createElement("div");
    pageEl.className = "invoice-container";
    if (i < totalPages - 1) pageEl.classList.add("page-break");

    const totalQty = validItems.reduce(
      (acc, item) => acc + (parseFloat(item.jumlah) || 0),
      0,
    );

    // Build Page HTML
    let pageHTML = `
      <!-- Header Content -->
      <div class="header-section">
        <div class="header-left">
          <div class="invoice-box">INVOICE</div>
          <div class="company-info">
            <strong>LAROSAPOT</strong><br />
            Jl. Perikanan Darat No 51, Kedung Waringin, Tanah Sareal, Bogor<br />
            Jawa Barat, 16164, Indonesia<br />
            081237798282<br />
            Larosapot@gmail.com
          </div>
        </div>
        <div class="header-right">
          <div class="header-logo">
            <img src="asset/image/larosa-logo.png" alt="Larosa Logo" />
          </div>
          <table class="info-table">
            <tr><td>No Pesanan</td><td>${data.info.noPesanan || "-"}</td></tr>
            <tr><td>Tanggal Dibuat</td><td>${formatDate(data.info.tanggal)}</td></tr>
            <tr><td>Rekening BCA</td><td><div style="margin-bottom: 5px">6380209720</div><div>Yudhi Aprianto</div></td></tr>
          </table>
        </div>
      </div>

      <hr class="divider" />

      <!-- Customer & Transaction Info -->
      <div class="info-section">
        <div class="info-left">
          <table class="details-table">
            <tr><td>Informasi Pelanggan:</td></tr>
            <tr><td style="font-weight:bold;">${data.customer.nama || "-"}</td></tr>
            <tr><td>${data.customer.noHp || "-"}</td></tr>
            <tr><td>${data.customer.alamat || "-"}</td></tr>
            <tr><td>${data.customer.city || (window.Utils && window.Utils.getCityForCustomer ? window.Utils.getCityForCustomer(data.customer.nama, data.customer.noHp) : "-")}</td></tr>
          </table>
        </div>
        <div class="info-right">
          <table class="details-table right-table">
            <tr><td>Kasir</td><td>${data.info.kasir || "-"}</td></tr>
            <tr><td>Transaksi</td><td>${data.info.transaksi || "-"}</td></tr>
            <tr><td>Payment</td><td>${data.info.payment || "-"}</td></tr>
          </table>
        </div>
      </div>

      <hr class="divider" />

      <!-- Items Table -->
      <div class="table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>NO.</th>
              <th>SKU</th>
              <th>PRODUK</th>
              <th>JUMLAH</th>
              <th>SATUAN</th>
              <th>HARGA</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems
              .map(
                (item, idx) => `
              <tr>
                <td>${startIndex + idx + 1}</td>
                <td>${item.sku || "-"}</td>
                <td>${item.produk || "-"}</td>
                <td>${item.jumlah || 0}</td>
                <td>${item.satuan || "-"}</td>
                <td>${formatCurrency(item.harga)}</td>
                <td>${formatCurrency(item.total)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>


      <!-- Footer Wrapper (Only on last page) -->
      <div class="footer-wrapper" style="${isLastPage ? "" : "display:none;"}">
        <hr class="divider thick" />
        <div class="footer-section">
          <div class="footer-left">
            <div class="notes">
              <strong>Keterangan:</strong>
              <ul>
                <li>Transfer ke BCA 6380209720; Yudhi Aprianto</li>
                <li>Diameter yang digunakan bibir terluar</li>
                <li>Selisih ukuran 1-2cm karena pengerjaan manual</li>
              </ul>
            </div>
            <div class="terms">
              <strong>Syarat dan Ketentuan:</strong>
              <ul>
                <li>Barang yang sudah dikirim tidak dapat ditukar/dikembalikan</li>
                <li>Khusus item PO pengerjaan 7-21 hari kerja</li>
                <li>Kerusakan item akibat perjalanan bukan tanggung jawab Larosa</li>
              </ul>
            </div>
          </div>
          <div class="footer-right">
            <table class="summary-table">
              <tr><td><strong>Sub Total (${totalQty} Item)</strong></td><td><strong>${formatCurrency(data.summary.subtotal)}</strong></td></tr>
              <tr><td>Ongkir</td><td>${formatCurrency(data.summary.ongkir)}</td></tr>
              <tr><td>Packing</td><td>${formatCurrency(data.summary.packing)}</td></tr>
              <tr><td>Diskon</td><td>${formatCurrency(data.summary.diskon)}</td></tr>
              <tr><td><strong>Total Tagihan</strong></td><td><strong>${formatCurrency(data.summary.totalTagihan)}</strong></td></tr>
              <tr><td>DP 1</td><td>${formatCurrency(data.summary.dp1)}</td></tr>
              <tr><td>DP 2</td><td>${formatCurrency(data.summary.dp2)}</td></tr>
              <tr><td><strong>Sisa Tagihan</strong></td><td><strong>${formatCurrency(data.summary.sisaTagihan)}</strong></td></tr>
            </table>
          </div>
        </div>
        <div class="bottom-bar"></div>
      </div>
    `;

    pageEl.innerHTML = pageHTML;
    pagesContainer.appendChild(pageEl);
  }
}

function goBack() {
  window.history.back();
}
