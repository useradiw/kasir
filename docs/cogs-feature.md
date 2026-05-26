# Panduan Stok Bahan, Supplier & Opname

## Apa yang Berubah

Sistem stok dan HPP sekarang berpusat pada **Bahan Baku** (Ingredient), bukan lagi Template Pengeluaran. Ini membawa beberapa kemampuan baru:

- **HPP rata-rata tertimbang (WMA)** — harga bahan dihitung otomatis dari semua pembelian, bukan hanya pembelian terakhir.
- **Supplier** — catat dari siapa Anda membeli, lihat riwayat per supplier.
- **Pack/Satuan Pembelian** — beli "1 dus" → otomatis dikonversi ke "12 pcs" di stok.
- **Opname Stok bulanan** — hitung fisik vs sistem, selisih masuk ke log otomatis.
- **Riwayat HPP per bahan** — grafik harga, daftar semua pembelian, semua pergerakan stok.
- **Kelas Satuan & satuan dasar terkunci** *(Mei 2026)* — tiap bahan punya kelas WEIGHT/VOLUME/COUNT; satuan dasar dikunci ke `mg`/`ml`/`pcs` agar HPP tidak pernah salah konversi.
- **Resep Menu pindah ke menu Bahan Baku → Resep Menu**, dengan **bulk-add textarea** (tempel nama+jumlah baris demi baris).
- **Resep Bahan Olahan dapat halaman index** sendiri (`/admin/bahan/resep-olahan`) — tidak lagi harus klik masuk ke detail bahan untuk menemukannya.

> Data lama tetap aman. Migrasi sudah menyalin semua Template lama menjadi Bahan Baku dengan ID yang sama, dan semua riwayat pembelian sudah diisi ulang sebagai IngredientPurchase.

---

## Ringkasan Alur

```
Pembelian (Expense)  ─►  Bahan (Ingredient)  ─►  Resep  ─►  Penjualan  ─►  HPP & Stok
        │                       ▲
        ▼                       │
    Supplier               Opname Stok
```

Setiap kali penjualan tersinkronisasi ke server:
1. Sistem membaca resep dari menu yang terjual
2. Stok bahan dikurangi sesuai resep × jumlah porsi
3. HPP dihitung dari **harga rata-rata bahan** × kuantitas

---

## Setup Awal

### 0. Satuan Dasar Global (Owner)
**Di mana:** Admin → Bahan Baku → Satuan & Konversi (`/admin/bahan/satuan`) — atau ikon ⚙ di header Daftar Bahan.

Tiga kelas: **WEIGHT** (default `mg`), **VOLUME** (default `ml`), **COUNT** (default `pcs`).
Override hanya bila perlu — dan diblokir bila ada bahan kelas itu yang punya stok/riwayat (proteksi agar HPP historis tidak rusak).

### 1. Bahan Baku
**Di mana:** Admin → Bahan Baku → Daftar Bahan (`/admin/ingredients`)

Tiap bahan punya:
- **Nama** — contoh: "Telur", "Gula Pasir"
- **Kategori** — Bahan / Kemasan / Perlengkapan / Lainnya (memudahkan filter)
- **Kelas Satuan** — WEIGHT / VOLUME / COUNT. Satuan dasar dikunci otomatis ikut kelas.
- **Batas Stok Min** (opsional) — peringatan jika stok ≤ angka ini
- **Supplier Default** (opsional) — autofill saat catat pengeluaran
- **Tag** (opsional) — chip filter di list (mis. `kering`, `frozen`)
- **Catatan** (opsional) — keterangan bebas

Klik tombol **+ Tambah** untuk membuat bahan baru. Klik baris untuk masuk ke halaman detail (Pembelian, Pemakaian, Resep, Pengaturan).

**Catatan:** Kelas & satuan dasar **terkunci** begitu bahan punya riwayat (pembelian, log, resep). Bila salah pilih, buat bahan baru atau opname-nol dulu.

### 2. Pack/Satuan Pembelian (opsional tapi disarankan)
**Di mana:** Halaman detail bahan → tab **Pengaturan** → kartu **Satuan Pack**

Pack adalah satuan saat beli. Contoh untuk bahan "Telur" (satuan dasar `pcs`):
- Pack `kg` → `baseQty = 16` (1 kg ≈ 16 butir)
- Pack `tray` → `baseQty = 30`
- Pack `pcs` → `baseQty = 1` (default)

Saat catat pengeluaran "2 kg telur Rp 60.000", sistem otomatis: `2 × 16 = 32 pcs` masuk ke stok dengan HPP `60.000 / 32 = Rp 1.875/pcs`.

Tandai satu pack sebagai **Default** — itu yang otomatis dipilih saat catat pengeluaran.

### 3. Supplier (opsional)
**Di mana:** Admin → Keuangan → Supplier (`/admin/suppliers`)

Daftar penjual/toko langganan. Saat catat pengeluaran, pilih supplier dari dropdown — riwayat per supplier bisa dilihat nanti.

### 4. Resep Menu
**Di mana:** Admin → Bahan Baku → Resep Menu (`/admin/bahan/resep-menu`)

1. **+ Buat Resep** → pilih menu (dan varian jika perlu)
2. Klik resep di daftar untuk expand
3. **Bulk-add** (disarankan): buka panel "▶ Tambah banyak bahan sekaligus", tempel baris `nama, jumlah` (satu per baris). Sistem fuzzy-match nama → preview table → klik **Simpan (N)**.
4. Atau **+ Tambah satu bahan (manual)** untuk pilih dari dropdown + qty
5. HPP per porsi langsung muncul; warna margin: hijau ≥60%, kuning 30–60%, merah <30%

### 5. Resep Bahan Olahan
**Di mana:** Admin → Bahan Baku → Resep Bahan Olahan (`/admin/bahan/resep-olahan`)

Bahan olahan = bahan yang dirakit dari bahan-bahan lain (sambal, kaldu, bumbu jadi).

1. **+ Buat Resep Olahan Baru** → pilih bahan induk → **Buka Editor** → masuk ke tab Resep bahan tersebut
2. Isi **Hasil/Batch** (jumlah induk per produksi)
3. Tambah komponen via bulk-add panel atau form single-add
4. **Catat Produksi** (Jumlah Batch × Hasil) → komponen berkurang, induk bertambah, HPP induk diperbarui WMA

Halaman index menampilkan dua bagian:
- **Bahan Olahan** — semua induk
- **Komponen Aktif** — bahan-bahan yang dipakai sebagai komponen di setidaknya satu resep

Catatan: komponen boleh beda kelas dari induk (mis. spice WEIGHT pada sauce VOLUME). Cost dihitung benar dalam rupiah; chip kuning *"kelas beda"* tampil sebagai konfirmasi visual.

---

## Operasi Harian

### Catat Pembelian
**Di mana:** `/expenses` (kasir/staff) atau Admin → Laporan → Pengeluaran (`/admin/expenses`)

1. Klik **Tambah Pengeluaran**
2. Pilih **Supplier** (opsional)
3. Ketik nama bahan — pilih dari daftar bahan (autocomplete). Pack default ikut terpilih.
4. Isi **Jumlah** (dalam satuan pack, mis. 2 dus) dan **Harga/satuan**
5. Centang opsi:
   - **Potong dari Kas** — kurangi saldo kas harian
   - **Catat ke Kas Pak Har** — masuk ke jurnal pemilik (mutual exclusive)
6. **Simpan**

Sistem otomatis:
- Tambah stok = `pack qty × baseQty pack`
- Update **HPP rata-rata tertimbang**: `(stok lama × hpp lama + total bayar) / stok baru`
- Catat **IngredientPurchase** dengan snapshot harga, supplier, dan stock-after

### Lihat Detail Bahan
Buka `/admin/ingredients/[id]` (klik baris di daftar bahan). Empat tab:

- **Pembelian** — grafik HPP, daftar pembelian dengan supplier, sumber, dan HPP rata-rata setelah tiap transaksi
- **Pemakaian** — semua log stok (PURCHASE, SALE, ADJUSTMENT, WASTE, ASSEMBLY)
- **Resep** — resep bahan olahan (hanya jika bahan ini diolah dari bahan lain)
- **Pengaturan** — edit info (nama, kategori, kelas terkunci-bila-history, tag, supplier default), kelola pack, sesuaikan stok manual, set HPP manual, catat pemborosan, nonaktifkan bahan

### Opname Stok (Bulanan)
**Di mana:** Admin → Keuangan → Opname Stok (`/admin/stock-opname`)

Dashboard akan menampilkan banner peringatan jika belum opname bulan ini.

1. Klik **+ Mulai Opname**
2. Untuk setiap bahan, isi **jumlah fisik** yang dihitung. Sistem otomatis hitung selisih vs stok tercatat.
3. Tambahkan **catatan** jika perlu
4. **Simpan Opname**

Apa yang terjadi setelah simpan:
- Stok sistem disetel ke jumlah hasil hitung fisik
- Selisih dicatat sebagai `ADJUSTMENT` (shrinkage) atau `OPNAME_GAIN` (kelebihan)
- Riwayat opname tersimpan dan bisa di-expand kapan saja

### Pemborosan / Waste
Halaman detail bahan → tab Pengaturan → **+ Catat Pemborosan**. Isi jumlah dan alasan (basi, tumpah, dst.). Stok berkurang, log `WASTE` tercatat.

### Penyesuaian Stok Manual
Halaman detail bahan → tab Pengaturan → **Sesuaikan Stok**. Masukkan nilai positif untuk tambah, negatif untuk kurangi. Selalu sertakan alasan.

---

## Tentang Perhitungan HPP

**Metode: Weighted Moving Average (WMA)**

Setiap pembelian memperbarui HPP rata-rata bahan:

```
HPP baru = (stok lama × HPP lama + total bayar pembelian) / (stok lama + jumlah dibeli)
```

Saat menu terjual:
```
HPP transaksi = Σ (kuantitas bahan dalam resep × HPP rata-rata bahan) × porsi
```

Catatan:
- HPP rata-rata adalah O(1) — disimpan langsung di kolom `averageUnitCost` pada tabel `ingredients`
- Edit/hapus pembelian: stok dikembalikan, tapi **HPP rata-rata tidak dihitung mundur** (untuk menjaga akurasi historis)
- Void transaksi: stok yang sudah dikurangi dikembalikan lewat `ADJUSTMENT` log

---

## Tips & Peringatan

- **Konsistensi nama bahan.** Hindari membuat dua bahan dengan nama mirip ("Telur" vs "Telor"). Gabungkan satu nama saja.
- **Stok bisa negatif.** Sistem tidak memblokir penjualan saat stok habis — pantau halaman Bahan Baku dan jangan abaikan badge "hampir habis".
- **Opname rutin.** Lakukan minimal sebulan sekali. Banner di dashboard akan mengingatkan.
- **Pack default.** Selalu set pack default untuk bahan yang sering dibeli dengan kemasan tertentu — bikin input pengeluaran lebih cepat.
- **HPP 0?** Kemungkinan: bahan belum pernah dibeli (averageUnitCost masih 0), atau resep menggunakan bahan custom (tanpa link ke Ingredient).

---

## Troubleshooting

**Stok tidak bertambah saat catat pengeluaran**
Pastikan item dipilih dari dropdown bahan, bukan diketik manual. Item tanpa `ingredientId` tidak akan masuk stok.

**HPP rata-rata terasa "salah"**
Cek tab Pembelian di halaman detail bahan — semua pembelian yang membentuk rata-rata terlihat di sana. Jika ada pembelian dengan harga ekstrem, itu yang menarik rata-rata.

**Stok tidak berkurang saat penjualan**
- COGS dan deduksi stok terjadi saat transaksi tersinkronisasi dari kasir ke server
- Cek apakah transaksi sudah sync (badge SyncBadge di kasir)
- Cek apakah menu yang terjual punya resep dengan bahan yang ter-link ke Ingredient

**Stok fisik tidak cocok dengan sistem**
Lakukan opname stok — selisih akan masuk ke log otomatis.
