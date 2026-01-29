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
  const dateObj = new Date(data.info.tanggal);
  const options = { day: "2-digit", month: "short", year: "numeric" };
  const formattedDate = !isNaN(dateObj)
    ? dateObj.toLocaleDateString("id-ID", options).replace(/ /g, "-")
    : data.info.tanggal;
  setText("invTanggal", formattedDate);
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
