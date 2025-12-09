let keranjangData = [];
let nomorUrut = 1;

document.getElementById("tanggalDibuat").valueAsDate = new Date();

function hitungTotalHarga() {
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  document.getElementById("totalHarga").value = jumlah * harga;
}

function tambahKeKeranjang() {
  const noSku = document.getElementById("noSku").value;
  const namaProduk = document.getElementById("namaProduk").value;
  const jumlah = parseFloat(document.getElementById("jumlah").value) || 0;
  const harga = parseFloat(document.getElementById("harga").value) || 0;
  const satuan = document.getElementById("satuan").value;
  const totalHarga =
    parseFloat(document.getElementById("totalHarga").value) || 0;

  if (!noSku || !namaProduk || jumlah <= 0 || harga <= 0) {
    alert("Mohon lengkapi semua data produk!");
    return;
  }

  keranjangData.push({
    no: nomorUrut++,
    sku: noSku,
    produk: namaProduk,
    jumlah: jumlah,
    satuan: satuan,
    harga: harga,
    total: totalHarga,
  });

  updateTabelKeranjang();
  hitungSubtotal();

  document.getElementById("noSku").value = "";
  document.getElementById("namaProduk").value = "";
  document.getElementById("jumlah").value = "";
  document.getElementById("harga").value = "";
  document.getElementById("satuan").value = "";
  document.getElementById("totalHarga").value = "";
}

function updateTabelKeranjang() {
  const tbody = document.getElementById("keranjangBody");
  tbody.innerHTML = "";

  keranjangData.forEach((item, index) => {
    const row = tbody.insertRow();
    row.innerHTML = `
                    <td>${item.no}</td>
                    <td>${item.sku}</td>
                    <td>${item.produk}</td>
                    <td>${item.jumlah}</td>
                    <td>${item.satuan}</td>
                    <td>Rp${item.harga.toLocaleString("id-ID")}</td>
                    <td>Rp${item.total.toLocaleString("id-ID")}</td>
                    <td><button class="btn-remove" onclick="hapusItem(${index})">Hapus</button></td>
                `;
  });
}

function hapusItem(index) {
  keranjangData.splice(index, 1);
  updateTabelKeranjang();
  hitungSubtotal();
}

function hitungSubtotal() {
  const subtotal = keranjangData.reduce((sum, item) => sum + item.total, 0);
  document.getElementById("subtotal").value = subtotal;
  hitungTotalTagihan();
}

function hitungTotalTagihan() {
  const subtotal = parseFloat(document.getElementById("subtotal").value) || 0;
  const ongkir = parseFloat(document.getElementById("ongkir").value) || 0;
  const packing = parseFloat(document.getElementById("packing").value) || 0;
  const diskon = parseFloat(document.getElementById("diskon").value) || 0;

  document.getElementById("totalTagihan").value =
    subtotal + ongkir + packing - diskon;
  hitungSisaTagihan();
}

function hitungSisaTagihan() {
  const totalTagihan =
    parseFloat(document.getElementById("totalTagihan").value) || 0;
  const dp1 = parseFloat(document.getElementById("dp1").value) || 0;
  const dp2 = parseFloat(document.getElementById("dp2").value) || 0;

  document.getElementById("sisaTagihan").value = totalTagihan - (dp1 + dp2);
}
