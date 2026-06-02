# Panduan HPP, Bahan Baku & Resep

Dokumen ini ditulis sebagai **langkah berurutan**. Baca dari atas ke bawah. Setiap langkah membangun di atas langkah sebelumnya. Lompati hanya langkah yang ditandai `(opsional)`.

## Mengapa fitur ini ada

Sistem mencatat **stok** dan **HPP (harga pokok) per bahan**, lalu memakai angka itu untuk menghitung COGS tiap pesanan secara otomatis. Dua prinsip yang membuat ini sederhana:

- **Satu satuan bebas per bahan.** Tiap bahan punya satu satuan yang Anda tentukan sendiri (`gram`, `ml`, `butir`, `pcs`, …). Satuan ini dipakai untuk **stok, resep, dan HPP** — sama di seluruh sistem. Tidak ada kelas satuan, tidak ada pack/konversi otomatis.
- **HPP = harga pembelian terakhir.** Setiap kali Anda mencatat pembelian, HPP bahan di-set ke harga per satuan pembelian itu. Bukan rata-rata. Sederhana dan mudah dilacak.

> Konversi dari satuan pasar (dus, karton, kg) ke satuan bahan Anda lakukan **sendiri saat mencatat pembelian** — sekali, saat Anda memang tahu angkanya. Contoh: beli "2 dus telur" → isi jumlah `60 butir`.

---

## Langkah 1 — Buat bahan baku

**Siapa:** Owner / Manager. **Di mana:** Admin → Bahan Baku → Daftar Bahan (`/admin/ingredients`) → tombol **+ Tambah**.

Isi:

- **Nama** — unik (hindari `Telur` vs `Telor`).
- **Kategori** — Bahan / Kemasan / Perlengkapan / Lainnya (filter saja).
- **Satuan** — ketik bebas: `gram`, `ml`, `butir`, `pcs`, `sdm`, … Pilih satuan terkecil yang masuk akal untuk resep.
- **Batas Stok Min** *(opsional)* — peringatan jika stok ≤ angka ini.
- **Supplier Default / Tag** *(opsional)*.

**Hasil:** bahan ada di sistem. Stok = 0, HPP = 0. Siap menerima pembelian.

---

## Langkah 2 — Catat pembelian

**Siapa:** Owner / Manager / Kasir. **Di mana:** `/expenses` (mobile) atau Admin → Laporan → Pengeluaran (`/admin/expenses`).

1. **Tambah Pengeluaran** → pilih Supplier *(opsional)*.
2. Ketik nama bahan → pilih dari autocomplete (jangan ketik bebas, agar tertaut ke bahan).
3. Isi **Jumlah** **dalam satuan bahan** (bukan jumlah dus). Untuk beli per dus/karton, konversi dulu: mis. 2 dus = `60` butir.
4. Isi **Biaya/satuan** (Rp per satuan bahan). Saat memilih bahan, kolom ini otomatis terisi HPP terakhir — sesuaikan jika harga berubah.
5. Centang **Kurangi dari Kas** dan/atau **Kas Pak Har**.
6. **Simpan**.

### Rumus

```
unitCost = totalBayar / jumlah          (totalBayar = jumlah × biaya/satuan)
HPP bahan = unitCost pembelian TERAKHIR  (berdasarkan tanggal)
stok += jumlah
```

Contoh: beli 60 butir telur Rp 120.000 → unitCost = 2.000/butir, HPP = 2.000/butir, stok +60.

**Hasil:** stok bertambah, HPP = harga pembelian ini, satu baris riwayat pembelian tercatat.

---

## Langkah 3 — (opsional) Set HPP manual

**Di mana:** Detail bahan → tab **Pengaturan** → **Set HPP Manual**.

Memaksa nilai HPP (mis. stok awal salah). Nilai ini menjadi "harga terakhir" sampai ada pembelian baru yang menggantikannya.

---

## Langkah 4 — Buat resep menu

**Siapa:** Owner / Manager. **Di mana:** Admin → Bahan Baku → Resep Menu (`/admin/bahan/resep-menu`).

1. **+ Buat Resep** → pilih menu (+ varian bila perlu).
2. Tambah bahan + **jumlah dalam satuan bahan** (mis. 2 butir telur, 100 gram tepung). Bisa lewat **bulk-add** (tempel baris `nama, jumlah`) atau satu per satu.

HPP per porsi dan margin langsung muncul (hijau ≥60%, kuning 30–60%, merah <30%).

---

## Langkah 5 — (opsional) Bahan olahan & produksi

**Di mana:** Admin → Bahan Baku → Resep Bahan Olahan (`/admin/bahan/resep-olahan`).

Bahan olahan = bahan yang dirakit dari bahan lain (sambal, kaldu, bumbu jadi).

1. Buat resep olahan → pilih bahan induk → isi **Hasil/Batch** (jumlah induk per satu produksi) → tambah komponen + jumlah.
2. **Catat Produksi** (jumlah batch). Komponen berkurang, induk bertambah, **HPP induk dihitung ulang dari biaya komponen saat itu**.

### Rumus produksi

```
totalBiaya = Σ (jumlahKomponen × n × HPPKomponen)     (n = jumlah batch)
HPP induk  = totalBiaya / (hasilPerBatch × n)
```

Komponen boleh beda satuan dari induk — biaya selalu dijumlah dalam rupiah.

---

## Langkah 6 — Penjualan menutup loop (otomatis)

Saat pesanan tersinkronisasi dari kasir, untuk tiap order:

```
COGS = Σ (jumlahBahanDiResep × jumlahPorsi × HPPBahan)
stok bahan turun otomatis (log SALE)
```

COGS disimpan sebagai snapshot di `Transaction.cogs` — tidak berubah meski HPP bergerak nanti.

---

## Langkah 7 — Opname stok rutin

**Di mana:** Admin → Keuangan → Opname Stok (`/admin/stock-opname`).

Isi jumlah fisik tiap bahan; sistem menyetel stok ke hasil hitung dan mencatat selisih (shrinkage / gain). Lakukan minimal sebulan sekali.

---

## Mengganti satuan sebuah bahan (Ubah Satuan)

**Di mana:** Detail bahan → tab **Pengaturan** → tautan **Ubah Satuan (konversi)** (muncul saat bahan sudah punya riwayat).

Gunakan saat satuan sebuah bahan perlu diganti (mis. dari `gram` ke `kg`) tanpa merusak data. Isi **satuan baru** dan **faktor** (berapa satuan lama dalam 1 satuan baru, mis. 1 kg = `1000` gram). Sistem **mengonversi semuanya sekaligus**: stok, HPP, dan semua resep yang memakai bahan ini.

```
stok      = stok / faktor
HPP       = HPP × faktor
jumlah di resep = jumlah / faktor
```

Total rupiah pembelian tidak berubah.

---

## Menautkan pembelian lama ke sebuah bahan

**Di mana:** Detail bahan → bagian pembelian belum tertaut.

Jika ada pengeluaran lama yang belum tertaut ke bahan, pilih bahannya lalu tautkan. Jika jumlah lama tercatat dalam satuan berbeda (mis. "2 dus"), perbaiki jumlahnya ke satuan bahan (mis. 60 butir) saat menautkan. Stok dan HPP ikut diperbarui.

---

## Memperbaiki pembelian yang salah

**Siapa:** Owner. **Di mana:** Detail bahan → tab **Pembelian** → **Edit** pada barisnya.

Perbaiki **jumlah** (dalam satuan bahan) dan **total bayar**. Stok disesuaikan dengan selisihnya, dan HPP bahan diambil dari pembelian terakhir. Pesanan historis (`Transaction.cogs`) tidak diubah. Hanya baris dari Pengeluaran (EXPENSE) yang bisa diedit.

---

## Troubleshooting

**Stok tidak bertambah saat catat pengeluaran.** Pastikan item dipilih dari autocomplete bahan (bukan teks bebas). Item tanpa bahan tertaut tidak masuk stok.

**Jumlah yang dimasukkan salah hitung.** Jumlah diisi dalam **satuan bahan**, bukan jumlah dus/karton. Beli 2 dus (isi 30) → masukkan 60.

**Stok tidak berkurang saat penjualan.** Deduksi terjadi saat order **sync** ke server. Pastikan menu punya resep dengan bahan tertaut.

**HPP terasa salah.** HPP = harga pembelian **terakhir**. Cek tab Pembelian — pembelian paling baru menentukan HPP. Pakai **Set HPP Manual** untuk menyetel ulang.

**HPP = 0.** Bahan belum pernah dibeli, atau resep memakai bahan tak tertaut.
