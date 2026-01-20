document.addEventListener("DOMContentLoaded", () => {
  loadInvoiceData();
});

function loadInvoiceData() {
  const dataString = sessionStorage.getItem("invoiceData");
  if (!dataString) {
    alert("Data quotation tidak ditemukan!");
    window.location.href = "data_quotation.html";
    return;
  }

  try {
    const data = JSON.parse(dataString);
    renderInvoice(data);
  } catch (e) {
    console.error("Error parsing quotation data:", e);
    alert("Terjadi kesalahan saat memuat data quotation.");
  }
}

function renderInvoice(data) {
  // Helpers
  const formatCurrency = (val) => {
    return "Rp" + (parseFloat(val) || 0).toLocaleString("id-ID");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return dateString;
  };

  // Header Info
  setText("invNoPesanan", data.info.noPesanan);
  const dateObj = new Date(data.info.tanggal);
  const options = { day: "2-digit", month: "short", year: "numeric" };
  const formattedDate = !isNaN(dateObj)
    ? dateObj.toLocaleDateString("id-ID", options).replace(/ /g, "-")
    : data.info.tanggal;
  // setText("invTanggal", formattedDate);
  setText("invDibuat", formattedDate);
  setText("invKasir", data.info.kasir);
  setText("invTransaksi", data.info.transaksi);
  setText("invPayment", data.info.payment);

  // Customer Info
  setText("invNamaPelanggan", data.customer.nama);
  setText("invNoHp", data.customer.noHp);
  setText("invAlamat", data.customer.alamat);

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
  window.location.href = "data_quotation.html";
}
