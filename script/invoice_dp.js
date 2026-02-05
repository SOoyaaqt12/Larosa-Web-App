document.addEventListener("DOMContentLoaded", () => {
  loadInvoiceData();
});

function loadInvoiceData() {
  const dataString = sessionStorage.getItem("invoiceData");
  if (!dataString) {
    alert("Data invoice tidak ditemukan!");
    window.location.href = "pelunasan.html";
    return;
  }

  try {
    const data = JSON.parse(dataString);
    renderInvoice(data);
  } catch (e) {
    console.error("Error parsing invoice data:", e);
    alert("Terjadi kesalahan saat memuat data invoice.");
  }
}

function renderInvoice(data) {
  // Helpers
  const formatCurrency = (val) => {
    return "Rp" + (parseFloat(val) || 0).toLocaleString("id-ID");
  };

  // Header Info
  setText("invNoPesanan", data.info.noPesanan);
  // Optional: Add (DP) suffix to Invoice No if desired, but user didn't explicitly ask.
  // Date Formatting
  // Date Formatting
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
  setText("invTanggal", formatDate(data.info.tanggal));
  setText("invKasir", data.info.kasir);
  setText("invPayment", data.info.payment);

  // Customer Info
  setText("invNamaPelanggan", data.customer.nama);
  setText("invNoHp", data.customer.noHp);
  setText("invAlamat", data.customer.alamat);

  // Smart City Lookup Fallback
  let city = data.customer.city;
  if (!city && window.Utils && window.Utils.getCityForCustomer) {
    city = window.Utils.getCityForCustomer(
      data.customer.nama,
      data.customer.noHp,
    );
  }
  setText("invKota", city);

  // Items
  const itemsBody = document.getElementById("invoiceItems");
  itemsBody.innerHTML = "";

  if (data.items && data.items.length > 0) {
    // Filter out empty items (rows without SKU or produk)
    const validItems = data.items.filter((item) => item.sku || item.produk);

    validItems.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.sku || "-"}</td>
        <td>${item.produk || "-"}</td>
        <td>${item.jumlah || 0}</td>
        <td>${item.satuan || "-"}</td>
        <td>${formatCurrency(item.harga)}</td>
        <td>${formatCurrency(item.total)}</td>
      `;
      itemsBody.appendChild(row);
    });
  }

  // Summary
  const totalItemCount = (data.items || []).reduce(
    (acc, item) => acc + (parseFloat(item.jumlah) || 0),
    0,
  );
  setText("invTotalItem", totalItemCount);

  setText("invSubtotal", formatCurrency(data.summary.subtotal));
  setText("invOngkir", formatCurrency(data.summary.ongkir));
  setText("invPacking", formatCurrency(data.summary.packing));
  setText("invDiskon", formatCurrency(data.summary.diskon));
  setText("invTotalTagihan", formatCurrency(data.summary.totalTagihan));

  // DP Specifics
  setText("invDP1", formatCurrency(data.summary.dp1));
  setText("invDP2", formatCurrency(data.summary.dp2));

  const sisa = data.summary.sisaTagihan;
  const sisaEl = document.getElementById("invSisaTagihan");

  sisaEl.textContent = formatCurrency(sisa);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || "-";
  }
}

function goBack() {
  window.history.back();
}
