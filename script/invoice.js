document.addEventListener("DOMContentLoaded", () => {
  loadInvoiceData();
});

function loadInvoiceData() {
  const dataString = sessionStorage.getItem("invoiceData");
  if (!dataString) {
    alert("Data invoice tidak ditemukan!");
    // window.location.href = 'kasir.html';
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

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Expecting DD-Mon-YYYY from kasir.js, or adjust if needed
    // The sheet format is already nice (e.g. 16-Dec-2025)
    return dateString;
  };

  // Header Info
  setText("invNoPesanan", data.info.noPesanan);
  setText("invTanggal", data.info.tanggal);
  setText("invKasir", data.info.kasir);
  setText("invTransaksi", data.info.transaksi); // "Online" or "Offline" (from button?) -> Usually logic from status
  // Logic: if button Lunas clicked -> Lunas.
  // We might need to pass transaction type or payment method more clearly
  setText("invPayment", data.info.payment);

  // Customer Info
  setText("invNamaPelanggan", data.customer.nama);
  setText("invNoHp", data.customer.noHp);
  setText("invAlamat", data.customer.alamat);
  // Note: Kota/Channel not always displayed in invoice body based on design,
  // but address usually includes city.

  // Items
  const itemsBody = document.getElementById("invoiceItems");
  itemsBody.innerHTML = "";

  if (data.items && data.items.length > 0) {
    data.items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.sku}</td>
        <td>${item.produk}</td>
        <td>${item.jumlah}</td>
        <td>${item.satuan}</td>
        <td>${formatCurrency(item.harga)}</td>
        <td>${formatCurrency(item.total)}</td>
      `;
      itemsBody.appendChild(row);
    });
  }

  // Summary
  setText("invSubtotal", formatCurrency(data.summary.subtotal));
  setText("invOngkir", formatCurrency(data.summary.ongkir));
  setText("invPacking", formatCurrency(data.summary.packing));
  setText("invDiskon", formatCurrency(data.summary.diskon));
  setText("invTotalTagihan", formatCurrency(data.summary.totalTagihan));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || "-";
  }
}

function goBack() {
  window.location.href = "kasir.html";
}
