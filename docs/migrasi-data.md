# Migrasi data ke database baru

Rencana aktif. Menggantikan `docs/redesign/plan-open-items.md`, yang sudah selesai
seluruhnya (lima bagiannya sudah rilis).

Tujuan: memindahkan seluruh riwayat operasional kasir dan seluruh pembukuan Warung
Books April–Juli ke database Supabase yang baru, lalu membaca laporannya di aplikasi
yang berjalan.

**Tidak ada perubahan kode aplikasi dalam rencana ini.** Semua yang di bawah memakai
repository dan alur yang sudah ada.

---

## Sumber data

| Sumber | Isi | Cakupan |
|---|---|---|
| `backup-2026-09-03.json` (root repo, gitignored) | ekspor produksi lama, versi 3, 31 tabel | 2026-04-12 s/d 2026-09-03 |
| `scripts/migrasi/warungbooks-events.json` | hasil ekstraksi `warung.db` | 2026-04-01 s/d 2026-07-31 |

Target: proyek Supabase baru `ktcaaasmrryoxinsutzt`.

Batas data: **31 Agustus 2026**. Semua baris tanggal September dibuang.

---

## Keputusan yang sudah dikunci

1. Delapan belas tabel operasional yang tidak berubah dipindah apa adanya.
2. Pembukuan April–Juli diisi dari Warung Books, bukan dari tabel pengeluaran kasir
   lama — Warung Books adalah catatan yang sudah Adi audit satu per satu.
3. Pembukuan Agustus **tidak** termasuk rencana ini. Adi memasukkannya sendiri
   setelah migrasi.
4. Pendapatan online memakai alur kasir (diakui saat pencairan), bukan alur Warung
   Books (diakui saat penjualan).
5. Komisi dan potongan iklan dicatat menyatu dalam satu akun
   `Expenses:OpEx:KomisiOnline`. Memisahkannya butuh perubahan kode; ditunda.
6. Bulan dibiarkan terbuka. Adi mengunci sendiri lewat tombol, sekalian menguji
   fiturnya.
7. `staff.supabaseUserId` diisi **null** untuk keenam baris. Barisnya tetap ikut
   pindah karena seluruh riwayat merujuk ke sana, tetapi penunjuk ke pengguna auth
   proyek lama tidak dibawa — penunjuk basi lebih berbahaya daripada kolom kosong.
   Keenam akun itu belum bisa login sampai dihubungkan ulang; itu urusan nanti.
8. Settlement 29 Agustus yang selisih Rp 211 diseimbangkan saat penulisan data,
   lewat satu baris `settlement_deductions` bertanda jelas. Ledger-nya sama saja
   (potongan dan komisi masuk akun yang sama), tetapi penyesuaiannya terlihat.
9. Akun dev dibuat ulang setelah wipe — Adi menjalankan
   `scripts/dev-accounts.mjs create` sendiri, karena skrip itu menyentuh Supabase Auth.
10. Laporan yang dibaca hanya April, Mei, Juni, Juli — empat bulan yang Adi sudah
    punya pembandingnya. Agustus tetap dimuat dan tetap ditutup-kas, tetapi
    laporannya belum dibaca.

---

## Urutan pelaksanaan

### Fase 0 — pengaman

Ambil backup database baru lewat `/admin/backup` lebih dulu; isinya uji settlement
GoFood dan akun dev. Catat kredensial akun dev: wipe menghapus baris `Staff`, tetapi
pengguna auth Supabase tetap ada.

### Fase 1 — wipe dan migrate

Adi yang menjalankan, bukan Claude. Prosedurnya sama seperti 2026-09-03.
**Jangan pernah `db push`** — perintah itu menghapus kolom diam-diam agar database
cocok dengan schema.

### Fase 2 — konfigurasi pembukuan

- `ledger_accounts`: tiga akun kas (`Assets:Cash:Mandiri`, `:PakHar`, `:Warung`)
  beserta labelnya. Nama-nama ini sudah sama persis dengan default di
  `lib/accounting/accounts.ts`, jadi tidak ada penggantian nama.
- `expense_categories`: 67 kode dari Warung Books beserta bucket HPP/OpEx-nya.
- `sales_channel_accounts`: tunai → Warung, elektronik → Mandiri, online → Mandiri.
- `accounting_months`: 2026-04 s/d 2026-08, semua **tidak dikunci**.
- `accounting_settings`.
- `settings`: 17 baris dari backup. Ini sekaligus mengganti tarif komisi uji coba
  dengan tarif asli.

### Fase 3 — baris operasional

Tujuh belas tabel, urut mengikuti foreign key. Tabel operasional kedelapan belas,
`settings`, sudah dimuat di Fase 2 bersama konfigurasi lain.

```
categories, staff, menu_items, menu_variants, packages, package_items,
menu_item_online_prices, table_sessions, order_items, transactions,
cash_registers, attendance_records, notifications, suppliers,
online_settlements, settlement_items, settlement_deductions
```

- `id` dan timestamp dipertahankan apa adanya.
- Kolom `transactions.cogs` dibuang (sudah tidak ada di schema baru).
- `staff.supabaseUserId` diisi null (keputusan 7).
- Settlement 29 Agustus dapat tambahan satu baris potongan Rp 211 (keputusan 8).
- Batas 31 Agustus **merambat ke anak**: tidak boleh ada order item, settlement item,
  atau absensi yang induknya sudah dibuang.

### Fase 4 — entri pembukuan, April–Juli saja

Lewat repository asli, urut tanggal. Jangan pernah menulis `journal_entries` langsung.

| Sumber | Jumlah | Jalur |
|---|---|---|
| `ev_capital` | 2 | `CatatRepository.recordModal` |
| `ev_transfer` | 97 | `CatatRepository.recordTransfer` |
| `ev_expense` | **778** | `ExpenseRepository.recordPengeluaran` |

778, bukan 783: lima baris kategori `KOMISI` (total Rp 105.575) **dikeluarkan**.
Posting settlement kasir sudah membukukan `Expenses:OpEx:KomisiOnline` sendiri, jadi
memasukkannya berarti membebankan komisi dua kali.

### Fase 5 — penjualan

**Tutup kas harian, April–Agustus.** Satu entri per hari operasi, angkanya diturunkan
dari `transactions` yang baru diimpor lewat `sumDaySales`, diposting dengan
`SalesPostingRepository`. Setel `countedCash` sama dengan `expectedCash` supaya tidak
muncul baris selisih kas — Warung Books tidak mengenal konsep itu.

**Pencairan online.** Kelima settlement diposting lewat `SettlementPostingRepository`
pada tanggal pencairannya: 13, 16, dan 26 Mei, 13 Juli, dan 29 Agustus. Yang 29
Agustus baru seimbang setelah penyesuaian Rp 211 di keputusan 8. Setiap transaksi
online sampai Agustus sudah tercakup settlement, jadi tidak ada pendapatan online
yang menggantung.

### Fase 6 — giliran Adi

Jalankan `scripts/dev-accounts.mjs create` untuk akun dev. Lalu buka `/buku/laporan`,
baca April, Mei, Juni, dan Juli — hanya empat bulan itu, karena hanya itu yang punya
pembanding — dan bandingkan dengan berkas XLSX. Terakhir kunci bulannya lewat tombol.

---

## Yang tidak pernah diisi dari berkas

- `sequences` — dikelola repository. Mengimpornya adalah penyebab nomor jurnal mundur
  dan muncul dua entri bernomor 9 saat UAT September.
- `ledger_postings` — dihasilkan oleh kode tutup kas dan settlement.
- `journal_entries` dan `journal_lines` — hanya lewat repository.
- `balance_assertions` — kosong.

## Yang tidak ikut pindah

- Tiga belas tabel yang sudah dihapus dari schema: seluruh subsistem COGS
  (`ingredients`, `recipes`, `stock_opnames`, dan turunannya) serta pengeluaran
  pra-ledger (`expenses`, `expense_items`, `expense_templates`, `kas_pak_har`).
- Tabel `transactions` dan `postings` milik Warung Books — itu hasil turunan, bukan
  masukan. Kasir menurunkannya sendiri.
- `ev_sale` Warung Books — penjualan datang dari transaksi POS.
- Seluruh baris bertanggal September.

---

## Yang harus diperkirakan, bukan diperbaiki

**Laporan Mei dan Juli tidak akan sama dengan Warung Books pada baris pendapatan
online dan komisi.** Itu konsekuensi keputusan 4, bukan bug. April dan Juni tidak
terpengaruh karena tidak ada penjualan online. Warung Books mencatat online Rp 220.830
di Mei; kasir mencatat Rp 243.230 bruto dari settlement.

**Agustus tampak timpang** sampai Adi memasukkan pembukuannya: penjualan masuk lewat
tutup kas, tetapi belum ada biaya sama sekali.

---

---

## Verifikasi

- Jumlah baris per tabel dibanding backup.
- Buku besar seimbang untuk setiap bulan (aset = kewajiban + ekuitas).
- Laporan April–Juli dibaca di aplikasi yang berjalan, bukan di harness.
