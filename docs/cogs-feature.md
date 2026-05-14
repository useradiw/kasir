# Panduan Fitur COGS & Stok Bahan Baku

## Ringkasan

Fitur ini menghubungkan pembelian bahan baku ke resep menu, sehingga sistem bisa menghitung **HPP (Harga Pokok Penjualan / COGS)** per transaksi secara otomatis dan melacak **stok bahan baku** secara real-time.

---

## Cara Kerja — Alur Data

```
Pembelian (Expense) → ExpenseTemplate (identitas bahan) → RecipeIngredient (komposisi)
                                                                    ↓
                                          OrderItem (item terjual) → COGS + Deducted Stock
```

Setiap penjualan yang tersinkronisasi ke server akan otomatis:
1. Menghitung HPP berdasarkan resep item yang terjual × harga beli terkini per bahan
2. Mengurangi stok bahan sesuai kebutuhan resep
3. Menyimpan log pergerakan stok untuk audit

---

## Setup Awal (Wajib Dilakukan Berurutan)

### Langkah 1 — Buat Template Pengeluaran per Bahan Baku

**Di mana:** Admin → Keuangan → Template Pengeluaran

Setiap bahan baku harus punya satu template. Contoh:
- "Arang" (satuan: kg)
- "Daging Sapi" (satuan: kg)
- "Bumbu Rahasia" (satuan: pcs)

**Penting:** Gunakan nama yang konsisten dan jelas. Template ini adalah "identitas permanen" bahan. Setelah dibuat, jangan membuat template baru dengan nama berbeda untuk bahan yang sama — selalu gunakan template yang sudah ada.

### Langkah 2 — Catat Pembelian via Pengeluaran

**Di mana:** Admin → Keuangan → Pengeluaran, atau Kasir → Pengeluaran

Saat mencatat pengeluaran, pastikan setiap item bahan baku dipilih dari template (bukan diketik manual), dan isi:
- **Jumlah (amount):** berapa unit yang dibeli (misalnya: 10 kg)
- **Harga/unit (cost):** harga per unit dalam Rupiah (misalnya: 50.000/kg)

Saat pengeluaran disimpan, sistem otomatis:
- Menambah stok template tersebut sebesar jumlah yang dibeli
- Mencatat log pergerakan stok dengan tipe PURCHASE

### Langkah 3 — Buat Resep untuk Menu Item

**Di mana:** Admin → Inventori → Tab Resep

Untuk setiap menu yang ingin dihitung HPP-nya:
1. Klik "Buat Resep" → pilih menu item (dan varian jika perlu)
2. Tambah bahan: pilih dari Template Pengeluaran, masukkan jumlah per porsi
   - Contoh: Ayam Bakar → Daging Ayam 0.25 kg + Arang 0.1 kg + Bumbu 1 pcs
3. Simpan resep

**Catatan:** Hanya bahan yang terhubung ke Template Pengeluaran yang akan masuk perhitungan HPP dan stok. Bahan "custom" (tanpa template) tidak dihitung.

### Langkah 4 — Jalankan Backfill (Sekali Saja)

**Di mana:** Admin → Stok Bahan Baku → tombol "Backfill dari riwayat"

Ini mengisi stok awal dari semua riwayat pembelian yang sudah ada. Jalankan **satu kali saja** setelah setup. Sistem akan:
- Membaca semua ExpenseItem yang memiliki templateId
- Menjumlahkan total pembelian per template
- Mengisi currentStock dengan total tersebut

**Catatan:** Backfill hanya mengisi stok dari pembelian — tidak mengurangi stok dari penjualan historis (hanya penjualan baru yang akan mengurangi stok). Jika ingin stok akurat, perlu penyesuaian manual setelah backfill.

---

## Operasi Sehari-hari

### Catat Pembelian Bahan Baku
→ Pengeluaran → pastikan item menggunakan Template yang benar → Simpan  
*Sistem otomatis menambah stok dan mencatat log.*

### Lihat Stok Bahan Baku
**Di mana:** Admin → Stok Bahan Baku (`/admin/ingredients`)

Menampilkan:
- Stok saat ini per bahan
- Harga beli terkini
- Tanggal pembelian terakhir
- Indikator merah jika stok di bawah batas minimum

### Set Batas Minimum Stok
Di halaman Stok Bahan Baku → klik "Batas Min" → masukkan jumlah minimum → Simpan  
Bahan yang stoknya di bawah batas akan disorot merah sebagai peringatan.

### Penyesuaian Manual (Stok Opname / Pemborosan)
Di halaman Stok Bahan Baku → klik "Sesuaikan":
- Masukkan jumlah positif (+) untuk menambah stok (misalnya: hasil stok opname lebih dari catatan)
- Masukkan jumlah negatif (-) untuk mengurangi stok (misalnya: pemborosan, kerusakan)
- Isi catatan untuk alasan penyesuaian

### Lihat Log Pergerakan Stok
Di halaman Stok Bahan Baku → klik "Log" pada bahan yang ingin dilihat

Tipe log:
- **PURCHASE** — dari pencatatan pengeluaran pembelian
- **SALE** — dikurangi otomatis saat transaksi tersinkronisasi dari kasir
- **ADJUSTMENT** — penyesuaian manual, atau reversal saat pengeluaran diedit/dihapus
- **WASTE** — (belum diimplementasi di UI, tersedia di schema)

---

## HPP di Laporan

### Di Laporan (`/admin/reports`)
Laporan menampilkan (hanya OWNER):
- **HPP (COGS):** total harga pokok semua penjualan dalam periode
- **Laba Kotor:** Pendapatan − HPP
- **Margin Kotor (%):** (Laba Kotor / Pendapatan) × 100
- **Laba Bersih:** Pendapatan − Total Pengeluaran (seperti sebelumnya)

### Di Detail Transaksi (`/admin/transactions/[id]`)
Setiap transaksi yang memiliki resep akan menampilkan:
- Daftar bahan yang digunakan, jumlah, harga per unit, dan subtotal
- Total HPP transaksi tersebut
- Laba Kotor transaksi

### Di Tab Resep (`/admin/inventory` → Tab Resep)
Setiap resep menampilkan:
- **HPP:** biaya bahan per porsi (dari harga beli terkini)
- **Harga:** harga jual menu
- **Margin:** persentase margin kotor

Warna margin:
- Hijau: ≥ 60% (bagus)
- Kuning: 30–60% (perlu perhatian)
- Merah: < 30% (berbahaya)

---

## Tentang Perhitungan HPP

**Metode:** Dynamic — menggunakan harga beli terkini saat transaksi tersinkronisasi ke server.

**Rumus:**
```
HPP per item = Σ (jumlah_bahan_per_resep × harga_beli_terkini) × qty_item_terjual
HPP transaksi = Σ HPP semua item
```

**Harga beli terkini** = `cost` dari ExpenseItem terakhir yang memiliki templateId tersebut, diurutkan berdasarkan `expense.recordedAt` DESC.

**Package:** HPP paket = jumlah HPP dari semua member item dalam paket tersebut.

**Void:** Jika transaksi di-void, semua pengurangan stok dari transaksi tersebut akan dikembalikan (stock reversal), dan `cogs` di-set null.

---

## Peringatan Penting

1. **Gunakan Template secara konsisten.** Jika bahan yang sama dicatat dengan nama berbeda di ExpenseItem (tanpa template), pembelian tersebut tidak akan masuk ke stok dan HPP.

2. **Backfill hanya sekali.** Menjalankan backfill berkali-kali aman (sudah ada guard idempotent per template), tapi tidak perlu.

3. **Stok bisa negatif.** Sistem tidak memblokir penjualan meski stok habis — ia hanya mencatat. Pantau halaman Stok Bahan Baku secara rutin.

4. **HPP 0 bukan error.** Jika menu item tidak punya resep, atau resepnya hanya menggunakan bahan "custom" (tanpa template), HPP akan 0. Ini normal.

5. **Edit/hapus pengeluaran mempengaruhi stok.** Saat pengeluaran diedit atau dihapus, stok dari pembelian lama akan dikembalikan dulu, lalu stok baru dari pembelian yang diperbarui ditambahkan.

---

## Troubleshooting

**HPP selalu 0 di transaksi:**
- Cek apakah menu item memiliki resep di Tab Resep
- Cek apakah semua bahan dalam resep menggunakan Template (bukan custom)
- Cek apakah ada ekspense dengan template tersebut yang dicatat sebelum/saat penjualan

**Stok tidak bertambah saat catat pengeluaran:**
- Pastikan item pengeluaran dipilih dari Template (ada templateId), bukan diketik manual

**Stok tidak berkurang setelah penjualan:**
- COGS dan stock deduction hanya terjadi saat transaksi tersinkronisasi dari kasir ke server
- Cek apakah transaksi sudah tersinkronisasi (lihat SyncBadge di kasir)

**Stok tidak akurat setelah backfill:**
- Backfill hanya menghitung pembelian, tidak mengurangi stok dari penjualan historis
- Lakukan penyesuaian manual: hitung stok fisik aktual, sesuaikan menggunakan fitur "Sesuaikan" di halaman Stok Bahan Baku
