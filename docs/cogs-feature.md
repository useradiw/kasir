# Panduan HPP, Bahan Baku & Resep

Dokumen ini ditulis sebagai **langkah berurutan**. Baca dari atas ke bawah. Setiap langkah membangun di atas langkah sebelumnya — tidak ada konsep yang dipakai sebelum dijelaskan. Lompati hanya langkah yang ditandai `(opsional)`.

## Mengapa fitur ini ada

Sistem mencatat **stok** dan **HPP rata-rata tertimbang (Weighted Moving Average / WMA)** per bahan. Tujuannya: tiap pesanan yang terjual otomatis menghasilkan angka COGS yang akurat berdasarkan harga rata-rata bahan **saat itu**, bukan harga pembelian terakhir. Tiga konsep yang harus dipahami sebelum mulai:

- **Kelas Satuan** — tiap bahan punya kelas WEIGHT (berat), VOLUME (cairan), atau COUNT (jumlah). Kelas menentukan **satuan dasar** (`g` / `ml` / `pcs` per default) yang dipakai untuk menyimpan stok dan HPP. Kelas dikunci ketika bahan sudah punya riwayat.
- **Pack** — satuan saat **membeli** (mis. `dus`, `tray`, `kg`). Pack adalah jembatan antara "1 dus" yang ada di nota dan stok dasar yang disimpan sistem.
- **WMA** — HPP rata-rata di-update otomatis tiap kali ada pembelian baru, dengan rumus yang ditulis eksplisit di Langkah 4.

---

## Langkah 1 — Tetapkan satuan dasar global

**Siapa:** Owner. **Sekali setup, jarang diubah.**
**Di mana:** Admin → Bahan Baku → Satuan & Konversi (`/admin/bahan/satuan`).

Tiap kelas punya satu satuan dasar yang dipakai di seluruh sistem:

| Kelas | Default | Setting key |
|---|---|---|
| WEIGHT | `g` | `unit_base_weight` |
| VOLUME | `ml` | `unit_base_volume` |
| COUNT | `pcs` | `unit_base_count` |

Override hanya jika ada alasan kuat (mis. semua bahan WEIGHT Anda dalam `kg` dengan rupiah besar). Override **diblokir** ketika ada bahan dalam kelas itu yang sudah punya stok/pembelian — agar HPP historis tidak rusak. Untuk mengganti satuan satu bahan yang sudah terlanjur salah, gunakan **Konversi Satuan** (dijelaskan di akhir dokumen).

**Hasil setelah langkah ini:** sistem tahu satuan standar tiap kelas. Tiap bahan baru otomatis ikut standar ini.

---

## Langkah 2 — Buat bahan baku pertama

**Siapa:** Owner / Manager.
**Di mana:** Admin → Bahan Baku → Daftar Bahan (`/admin/ingredients`) → tombol **+ Tambah**.

Isi:

- **Nama** — unik, hindari duplikat (`Telur` vs `Telor`).
- **Kategori** — Bahan / Kemasan / Perlengkapan / Lainnya (filter saja).
- **Kelas Satuan** — pilih satu: WEIGHT / VOLUME / COUNT. Satuan dasar otomatis terkunci ke nilai dari Langkah 1.
- **Supplier Default** *(opsional)* — autofill saat catat pengeluaran.
- **Batas Stok Min** *(opsional)* — peringatan jika stok ≤ angka ini.
- **Tag** *(opsional)* — chip filter (mis. `kering`, `frozen`).

**Yang dikunci:** kelas + satuan dasar terkunci begitu ada riwayat (pembelian/log/resep/stok). Jika salah pilih, dua opsi: (a) buat bahan baru dan nonaktifkan yang lama, atau (b) gunakan **Konversi Satuan** (Owner-only, lihat bagian terakhir).

**Hasil setelah langkah ini:** bahan ada di sistem. Stok = 0. HPP rata-rata = 0. Belum bisa dipakai di resep secara berarti sampai ada pembelian (Langkah 4).

---

## Langkah 3 — Definisikan pack (satuan pembelian)

**Siapa:** Owner / Manager.
**Di mana:** Halaman detail bahan → tab **Pengaturan** → kartu **Satuan Pack**.

**Mengapa:** Anda beli "1 dus telur", bukan "30 pcs telur". Pack adalah jembatan dari satuan pasar ke satuan dasar.

Contoh untuk **Telur** (kelas COUNT, satuan dasar `pcs`):

| Label pack | `baseQty` | Arti |
|---|---|---|
| `pcs` | 1 | 1 pcs = 1 pcs (pack identitas) |
| `tray` | 30 | 1 tray = 30 pcs |
| `kg` | 16 | 1 kg ≈ 16 butir |

Tandai satu pack sebagai **Default** — itu yang otomatis terpilih saat catat pengeluaran. Label pack boleh berupa nama kemasan bebas berbahasa Indonesia (`dus`, `botol`, `bks`, `renteng`) selama bukan satuan ukuran kelas lain (mis. `kg` tidak boleh dipakai di bahan VOLUME).

**Hasil setelah langkah ini:** sistem siap menerima pembelian dalam satuan pasar dan otomatis mengonversi ke satuan dasar.

---

## Langkah 4 — Catat pembelian pertama

**Siapa:** siapa saja yang punya akses (Owner / Manager / Kasir / Staff).
**Di mana:** `/expenses` (mobile) atau Admin → Laporan → Pengeluaran (`/admin/expenses`).

Alur input:

1. **Tambah Pengeluaran**.
2. Pilih **Supplier** *(opsional)*.
3. Ketik nama bahan — pilih dari autocomplete bahan (bukan teks bebas). Pack default ikut terpilih.
4. Isi **Jumlah** (dalam satuan pack, mis. 2 dus) dan **Harga/satuan** (total bayar dalam Rp).
5. Centang **Potong dari Kas** dan/atau **Catat ke Kas Pak Har** sesuai sumber dana.
6. **Simpan**.

### Rumus yang dijalankan sistem

Ketika pembelian disimpan, tiga hitungan dijalankan **dalam satu transaksi**:

```
packBaseQty = baseQty pack yang dipilih              (dari Langkah 3)
baseQty     = packQty × packBaseQty                  (qty dalam satuan dasar)
unitCost    = totalCost / baseQty                    (Rp per satuan dasar)
newAvg      = (averageUnitCost lama × stok lama + totalCost)
              / (stok lama + baseQty)
```

Referensi kode: [lib/cogs-utils.ts:148–158](../lib/cogs-utils.ts).

Contoh: beli 2 kg telur Rp 60.000 (pack `kg`, baseQty=16):

```
baseQty  = 2 × 16            = 32 pcs
unitCost = 60.000 / 32        = Rp 1.875 / pcs
newAvg   = jika stok lama 0  → Rp 1.875 / pcs
```

**Hasil setelah langkah ini:** `averageUnitCost` terisi, stok bertambah, satu baris `IngredientPurchase` tercatat dengan snapshot harga + supplier + sumber.

---

## Langkah 5 — (opsional) Set HPP manual

**Siapa:** Owner / Manager.
**Di mana:** Detail bahan → tab **Pengaturan** → **Set HPP Manual**.

**Kapan dipakai:** WMA tidak masuk akal karena stok awal salah, atau Anda ingin memaksa nilai HPP untuk perhitungan margin. Sistem akan **menulis nilai itu langsung ke kolom `averageUnitCost`** dan mencatat baris `IngredientPurchase` dengan `source=ADJUSTMENT`.

**Peringatan penting:** Tidak ada kolom "HPP manual" terpisah. Manual override **ditulis ke kolom yang sama** dengan WMA. Pembelian berikutnya akan **kembali menghitung WMA** mulai dari angka manual ini. Jadi manual override hanya bertahan sampai pembelian/produksi berikutnya.

Referensi kode: [app/actions/admin/ingredients.ts:304–337](../app/actions/admin/ingredients.ts).

**Hasil setelah langkah ini:** `averageUnitCost` di-set ke nilai pilihan Anda; log `IngredientPurchase` (ADJUSTMENT) tertulis.

---

## Langkah 6 — Buat resep menu

**Siapa:** Owner / Manager.
**Di mana:** Admin → Bahan Baku → Resep Menu (`/admin/bahan/resep-menu`).

1. **+ Buat Resep** → pilih menu (+ varian jika perlu).
2. Klik resep di daftar untuk expand.
3. **Bulk-add** (disarankan): buka panel "▶ Tambah banyak bahan sekaligus", tempel baris `nama, jumlah` (satu per baris dalam satuan dasar bahan). Sistem fuzzy-match nama → preview table → klik **Simpan (N)**.
4. Atau **+ Tambah satu bahan (manual)** untuk pilih dari dropdown + qty.

HPP per porsi langsung muncul. Warna margin: hijau ≥60%, kuning 30–60%, merah <30%.

**Hasil setelah langkah ini:** kasir bisa jual menu ini; saat pesanan disimpan, sistem akan menghitung COGS otomatis (Langkah 8).

---

## Langkah 7 — (opsional) Bahan olahan & produksi

**Siapa:** Owner / Manager.
**Di mana:** Admin → Bahan Baku → Resep Bahan Olahan (`/admin/bahan/resep-olahan`).

**Bahan olahan** = bahan yang dirakit dari bahan-bahan lain (sambal, kaldu, bumbu jadi).

1. **+ Buat Resep Olahan Baru** → pilih bahan induk → **Buka Editor** → masuk ke tab Resep bahan tersebut.
2. Isi **Hasil/Batch** (jumlah induk yang dihasilkan per satu produksi).
3. Tambah komponen via bulk-add atau form single-add.
4. **Catat Produksi** (Jumlah Batch × Hasil) → komponen berkurang, induk bertambah, HPP induk diperbarui WMA.

### Rumus produksi

```
totalCost = Σ component.quantity × n × component.averageUnitCost
            (n = jumlah batch yang diproduksi)
newStock  = stok induk lama + (hasilPerBatch × n)
newAvg    = (averageUnitCost induk lama × stok induk lama + totalCost) / newStock
```

Referensi kode: [app/actions/admin/ingredient-recipes.ts:201–228](../app/actions/admin/ingredient-recipes.ts).

Komponen boleh beda kelas dari induk (mis. spice WEIGHT pada sauce VOLUME) — biaya selalu dijumlah dalam rupiah, tidak ada pencampuran satuan fisik. Chip kuning *"kelas beda"* tampil sebagai konfirmasi visual.

**Hasil setelah langkah ini:** bahan olahan punya stok + HPP rata-rata sendiri, siap dipakai sebagai bahan di resep menu (Langkah 6).

---

## Langkah 8 — Penjualan menutup loop (otomatis)

**Siapa:** otomatis dari kasir.
**Di mana:** terjadi saat order tersinkronisasi dari kasir ke server.

Untuk tiap order, sistem menjalankan:

```
untuk tiap orderItem (qty porsi) × tiap recipeIngredient:
  useQty = recipeIngredient.quantity × order.qty
  cogs  += useQty × ingredient.averageUnitCost
  stok bahan turun via IngredientLog (type=SALE)
```

Referensi kode: [lib/cogs-utils.ts:285–326](../lib/cogs-utils.ts). COGS disimpan di `Transaction.cogs` sebagai snapshot Rp — tidak akan berubah jika nanti HPP bergerak.

**Hasil setelah langkah ini:** pesanan tercatat lengkap dengan COGS yang akurat; stok turun otomatis; semua pergerakan masuk ke log.

---

## Langkah 9 — Opname stok rutin

**Siapa:** Owner / Manager.
**Di mana:** Admin → Keuangan → Opname Stok (`/admin/stock-opname`). Banner peringatan akan muncul di dashboard jika belum opname bulan ini.

1. **+ Mulai Opname**.
2. Untuk setiap bahan, isi **jumlah fisik** yang dihitung. Sistem otomatis hitung selisih vs stok tercatat.
3. Tambahkan **catatan** jika perlu.
4. **Simpan Opname**.

Yang terjadi setelah simpan:

- Stok sistem disetel ke jumlah hasil hitung fisik.
- Selisih dicatat sebagai `ADJUSTMENT` (shrinkage) atau `OPNAME_GAIN` (kelebihan).
- Riwayat opname tersimpan dan bisa di-expand kapan saja.

**Hasil setelah langkah ini:** stok sistem ↔ stok fisik tersinkron. Lakukan rutin minimal sebulan sekali.

---

## Memperbaiki pembelian yang salah pack / qty / total bayar

**Siapa:** Owner saja (DEVELOPER tidak bisa). **Per-baris, transaksional, tidak bisa di-undo.**
**Di mana:** Detail bahan → tab **Pembelian** → tombol **Edit** pada baris pembelian yang ingin diperbaiki.

### Kapan dipakai

Ada satu (atau lebih) pembelian yang dicatat dengan pack/qty/total bayar yang salah, sehingga stok atau HPP rata-rata jadi tidak masuk akal. Contoh nyata: bahan **Arang** (kelas WEIGHT, satuan dasar `g`) dengan pack `bks` yang sudah benar (`baseQty = 3300 g`), tapi pembelian historisnya tercatat tanpa pack (`packLabel = null`) — sehingga "2 bks Rp 20.000" tersimpan sebagai "2 g Rp 10.000/g" alih-alih "6600 g Rp 3,03/g".

Editing pack `bks.baseQty` saja **tidak** memperbaiki baris-baris historis, karena `IngredientPurchase.baseQty` dan `unitCost` adalah snapshot — ditulis sekali saat pembelian dicatat, tidak otomatis dihitung ulang. Tombol **Edit** baris ini menutup gap tersebut.

### Cara kerja

1. Buka detail bahan → tab **Pembelian**.
2. Cari baris yang salah → klik tombol **Edit** di kanan baris.
3. Dialog muncul. Pilih pack yang benar dari dropdown (atau `tanpa pack` kalau memang dalam satuan dasar), perbaiki qty dan total bayar bila perlu.
4. Preview "Hasil setelah disimpan" menampilkan baseQty dan harga per satuan dasar yang akan tertulis.
5. Klik **Simpan & replay**.

### Rumus yang dijalankan

Untuk baris yang diedit:

```
packBaseQty   = IngredientPack.baseQty (untuk pack baru) atau 1 (kalau tanpa pack)
baseQty       = packQty × packBaseQty
unitCost      = totalCost / baseQty
```

Lalu **replay** seluruh riwayat bahan ini secara kronologis:

```
stock = 0; avg = 0
untuk tiap event (purchase rows + non-paired log rows) urut waktu:
  jika purchase EXPENSE/OPNAME_GAIN/ASSEMBLY:
    newStock = stock + baseQty
    avg      = (avg × stock + totalCost) / newStock   (WMA)
    stock    = newStock
    update purchase.avgUnitCostAfter = avg, purchase.stockAfter = stock
  jika purchase ADJUSTMENT (manual HPP):
    avg      = unitCost
  jika log lain (SALE / WASTE / ADJUSTMENT-from-adjustStock / ASSEMBLY-konsumsi):
    stock   += quantity (signed)

Ingredient.currentStock    = stock akhir
Ingredient.averageUnitCost = avg akhir
Ingredient.lastUnitCost    = unitCost purchase terakhir
```

Referensi kode: [app/actions/admin/ingredient-purchases.ts](../app/actions/admin/ingredient-purchases.ts) → `editPurchase` + `replayIngredientHistory`.

### Yang ikut & yang tidak

- **Ikut diperbarui:** baris IngredientPurchase yang diedit (packLabel, packQty, baseQty, totalCost, unitCost), IngredientLog yang berpasangan (quantity, unitCost), ExpenseItem yang ditautkan (unit, amount, cost). Lalu replay menulis ulang `avgUnitCostAfter` + `stockAfter` di setiap purchase row dan finalize `Ingredient.currentStock` + `averageUnitCost` + `lastUnitCost`.
- **Tidak ikut diperbarui:** `Transaction.cogs` historis (sudah snapshot Rp di tiap order — kalau order lama dihitung dengan HPP yang lama, angka itu tetap). Resep menu / resep olahan tidak disentuh. Pack definition juga tidak diubah — hanya baris pembelian yang diedit.

### Batasan

- Hanya baris dengan `source = EXPENSE` (pembelian dari pengeluaran) yang bisa diedit. Baris `ADJUSTMENT` (set HPP manual), `ASSEMBLY` (produksi), dan `OPNAME_GAIN` (selisih opname) tidak bisa diedit lewat dialog ini — mereka punya jalur masing-masing.
- Tidak bisa di-undo. Audit log otomatis ditulis (`IngredientLog` type=ADJUSTMENT, quantity=0) mencatat siapa yang edit dan apa yang berubah.

---

## Troubleshooting

**Stok tidak bertambah saat catat pengeluaran.**
Pastikan item dipilih dari autocomplete bahan, bukan diketik manual. `ExpenseItem` tanpa `ingredientId` tidak masuk stok.

**HPP rata-rata terasa "salah".**
Cek tab Pembelian di detail bahan — semua pembelian yang membentuk rata-rata terlihat di sana. Jika ada pembelian dengan harga ekstrem (typo ratusan ribu jadi jutaan), itu yang menarik rata-rata.

**Stok tidak berkurang saat penjualan.**
COGS dan deduksi stok terjadi saat order **sync** dari kasir ke server. Cek badge SyncBadge di kasir. Cek juga menu punya resep dengan bahan ter-link ke Ingredient (`recipeIngredient.ingredientId`, bukan customName).

**Stok fisik tidak cocok dengan sistem.**
Lakukan Opname Stok (Langkah 9). Selisih masuk log otomatis.

**HPP rata-rata = 0.**
Bahan belum pernah dibeli (`averageUnitCost` masih default 0), atau resep menggunakan bahan custom tanpa link ke Ingredient. COGS akan jatuh ke 0 untuk bahan itu sampai pembelian pertama tercatat.

**Edit/hapus pembelian tidak menggeser HPP rata-rata mundur.**
Disengaja — WMA tidak dihitung mundur saat purchase di-edit/dihapus, untuk menjaga akurasi historis. Gunakan Set HPP Manual (Langkah 5) untuk menyetel ulang HPP jika perlu.
