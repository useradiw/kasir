import { requireAuth } from "@/lib/admin-auth";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BackToTop } from "./back-to-top";

export const metadata = { title: "Petunjuk Penggunaan" };

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal list-outside ml-5 space-y-1.5 text-sm text-muted-foreground">
      {children}
    </ol>
  );
}

function Tips({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside ml-5 space-y-1 text-sm text-muted-foreground mt-2">
      {children}
    </ul>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold mt-10 mb-4 scroll-mt-28 border-b border-border pb-2">
      {children}
    </h2>
  );
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold mt-6 mb-2 scroll-mt-28">
      {children}
    </h3>
  );
}

function OwnerOnly() {
  return (
    <p className="text-sm text-muted-foreground italic border border-dashed border-border rounded-lg px-4 py-3">
      Fitur ini dikelola langsung oleh Owner.
    </p>
  );
}

export default async function PetunjukPage() {
  const staff = await requireAuth();
  const role = staff.role;
  const isOwner = role === "OWNER" || role === "DEVELOPER";
  const isAdmin = role === "OWNER" || role === "MANAGER" || role === "DEVELOPER";
  const hasCashAccess = role !== "STAFF";

  return (
    <Container id="top" sectionStyle="min-h-screen" className="py-8 max-w-2xl">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-1">Petunjuk Penggunaan</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Panduan cara menggunakan fitur-fitur aplikasi Kasir POS.
        <span className="block mt-1 text-xs">Diperbarui: 26 Mei 2026</span>
      </p>

      {/* TOC at top */}
      <nav className="border border-border rounded-lg p-4 mb-10 bg-muted/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Daftar Isi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
          <a href="#kasir" className="text-foreground hover:text-primary transition-colors py-0.5">Kasir (POS)</a>
          <a href="#pengeluaran" className="text-foreground hover:text-primary transition-colors py-0.5">Pengeluaran</a>
          {hasCashAccess && (
            <a href="#kas-harian" className="text-foreground hover:text-primary transition-colors py-0.5">Kas Harian</a>
          )}
          {hasCashAccess && (
            <a href="#pencairan-online" className="text-foreground hover:text-primary transition-colors py-0.5">Pencairan Online</a>
          )}
          {isAdmin && (
            <a href="#admin-inventori" className="text-foreground hover:text-primary transition-colors py-0.5">Inventori Menu</a>
          )}
          {isAdmin && (
            <a href="#admin-bahan-baku" className="text-foreground hover:text-primary transition-colors py-0.5">Bahan Baku & HPP</a>
          )}
          {isAdmin && (
            <a href="#admin-satuan" className="text-foreground hover:text-primary transition-colors py-0.5">Satuan Bahan</a>
          )}
          {isAdmin && (
            <a href="#admin-resep-menu" className="text-foreground hover:text-primary transition-colors py-0.5">Resep Menu</a>
          )}
          {isAdmin && (
            <a href="#admin-resep-olahan" className="text-foreground hover:text-primary transition-colors py-0.5">Resep Bahan Olahan</a>
          )}
          {isAdmin && (
            <a href="#admin-supplier" className="text-foreground hover:text-primary transition-colors py-0.5">Supplier</a>
          )}
          {isAdmin && (
            <a href="#admin-opname" className="text-foreground hover:text-primary transition-colors py-0.5">Opname Stok</a>
          )}
          {isAdmin && (
            <a href="#admin-transaksi" className="text-foreground hover:text-primary transition-colors py-0.5">Transaksi</a>
          )}
          {isAdmin && (
            <a href="#admin-pengeluaran" className="text-foreground hover:text-primary transition-colors py-0.5">Pengeluaran Admin</a>
          )}
          <a href="#akses-peran" className="text-foreground hover:text-primary transition-colors py-0.5">Akses Peran</a>
        </div>
      </nav>

      {/* ── KASIR ── */}
      <section id="kasir">
        <SectionHeading id="kasir">Kasir (POS)</SectionHeading>
        <p className="text-sm text-muted-foreground mb-4">
          Halaman utama untuk melayani transaksi pelanggan. Kasir bekerja secara{" "}
          <strong>offline</strong> — tetap berjalan tanpa internet dan data akan
          disinkronkan ke server secara otomatis saat koneksi tersedia.
        </p>

        <SubHeading id="kasir-sesi">Membuat sesi baru</SubHeading>
        <Steps>
          <li>Buka halaman <Link href="/kasir" className="text-primary hover:underline">Kasir</Link> dari menu utama.</li>
          <li>Ketuk <strong>Sesi Baru</strong>.</li>
          <li>Isi nama alias pelanggan (misal: &quot;Meja 3&quot; atau nama tamu), nomor HP opsional, dan pilih tipe layanan: <em>Dine-in, Take Away, GoFood, ShopeeFood, atau GrabFood</em>.</li>
          <li>Ketuk <strong>Buat Sesi</strong>.</li>
        </Steps>

        <SubHeading id="kasir-pesan">Menambah pesanan</SubHeading>
        <Steps>
          <li>Di dalam sesi, telusuri menu melalui tab kategori di bagian atas.</li>
          <li>Ketuk item untuk menambahkannya ke pesanan. Jika ada varian (ukuran, rasa), pilih varian terlebih dahulu.</li>
          <li>Untuk paket bundel, pilih dari tab Paket dan pilih komposisi item sesuai ketentuan.</li>
          <li>Ubah jumlah item dengan menekan tombol <strong>+</strong> / <strong>−</strong> di samping item.</li>
        </Steps>

        <SubHeading id="kasir-bayar">Memproses pembayaran</SubHeading>
        <Steps>
          <li>Ketuk ikon keranjang atau tombol <strong>Bayar</strong> untuk melihat ringkasan pesanan.</li>
          <li>Pilih metode pembayaran: <strong>Tunai</strong>, <strong>QRIS</strong>, atau <strong>Tunai + QRIS</strong> (split).</li>
          <li>Masukkan jumlah yang dibayarkan, lalu ketuk <strong>Konfirmasi</strong>.</li>
          <li>Struk akan muncul — ketuk <strong>Cetak</strong> untuk mencetak via Bluetooth (printer ESC/POS) atau simpan sebagai gambar.</li>
        </Steps>

        <SubHeading id="kasir-splitbill">Split bill</SubHeading>
        <Steps>
          <li>Di halaman ringkasan pesanan, ketuk <strong>Split Item</strong>.</li>
          <li>Seret atau ketuk item untuk memindahkan ke grup yang berbeda.</li>
          <li>Proses pembayaran tiap grup secara terpisah.</li>
        </Steps>
      </section>

      <hr className="border-border my-8" />

      {/* ── PENGELUARAN ── */}
      <section id="pengeluaran">
        <SectionHeading id="pengeluaran">Pengeluaran</SectionHeading>
        <p className="text-sm text-muted-foreground mb-4">
          Catat pengeluaran operasional harian. Tersedia untuk semua peran.
        </p>
        <Steps>
          <li>Buka <Link href="/expenses" className="text-primary hover:underline">Pengeluaran</Link> dari menu utama.</li>
          <li>Ketuk <strong>Tambah Pengeluaran</strong>.</li>
          <li>Pilih <strong>Supplier</strong> dari dropdown jika sudah dibuat (opsional).</li>
          <li>Mulai ketik nama bahan — pilih dari daftar Bahan Baku.</li>
          <li>Isi <strong>Jumlah dalam satuan bahan</strong> (mis. gram/butir), bukan jumlah dus. Untuk beli per dus/karton, konversi dulu: 2 dus = 60 butir. Lalu isi <strong>Harga/satuan</strong>.</li>
          <li>Centang <strong>Potongan Kas</strong> bila mengurangi saldo kas harian, atau <strong>Catat ke Kas Pak Har</strong> untuk jurnal pemilik.</li>
          <li>Ketuk <strong>Simpan</strong>.</li>
        </Steps>
        <Tips>
          <li>Saat item terhubung ke Bahan Baku, stok <strong>otomatis bertambah</strong> dan <strong>HPP</strong> di-set ke harga pembelian ini (harga terakhir).</li>
          <li>Jumlah selalu dalam satuan bahan — konversi dari dus/karton Anda lakukan sendiri sekali saat mencatat.</li>
        </Tips>
      </section>

      {hasCashAccess && (
        <>
          <hr className="border-border my-8" />

          {/* ── KAS HARIAN ── */}
          <section id="kas-harian">
            <SectionHeading id="kas-harian">Kas Harian</SectionHeading>
            <p className="text-sm text-muted-foreground mb-4">
              Catat saldo kas di awal dan akhir hari.
            </p>

            <SubHeading id="kas-harian-buka">Membuka kas</SubHeading>
            <Steps>
              <li>Buka <Link href="/cashregister" className="text-primary hover:underline">Kas Harian</Link> dari menu utama.</li>
              <li>Ketuk <strong>Buka Kas</strong>.</li>
              <li>Isi jumlah uang per denominasi yang ada di laci kas.</li>
              <li>Ketuk <strong>Simpan</strong> — total saldo awal akan tercatat.</li>
            </Steps>

            <SubHeading id="kas-harian-tutup">Menutup kas</SubHeading>
            <Steps>
              <li>Di akhir hari, kembali ke halaman Kas Harian.</li>
              <li>Ketuk <strong>Tutup Kas</strong>.</li>
              <li>Hitung dan isi jumlah uang tunai yang tersisa per denominasi.</li>
              <li>Ketuk <strong>Simpan</strong>.</li>
            </Steps>
          </section>
        </>
      )}

      {hasCashAccess && (
        <>
          <hr className="border-border my-8" />

          {/* ── PENCAIRAN ONLINE ── */}
          <section id="pencairan-online">
            <SectionHeading id="pencairan-online">Pencairan Online</SectionHeading>
            <p className="text-sm text-muted-foreground mb-4">
              Catat dan rekonsiliasi pencairan dari platform pesan-antar (GoFood, ShopeeFood, GrabFood).
            </p>
            <Steps>
              <li>Buka <Link href="/settlement" className="text-primary hover:underline">Pencairan Online</Link> dari menu utama.</li>
              <li>Ketuk <strong>Tambah Pencairan</strong>, pilih platform dan tanggal periode.</li>
              <li>Isi jumlah yang diterima dari platform.</li>
              <li>Tambahkan potongan jika ada (komisi, biaya marketing, dll.).</li>
              <li>Hubungkan transaksi online yang termasuk dalam periode ini menggunakan tombol <strong>Tambah Transaksi</strong>.</li>
              <li>Simpan.</li>
            </Steps>
          </section>
        </>
      )}

      {isAdmin && (
        <>
          <hr className="border-border my-8" />

          {/* ── PANEL ADMIN ── */}
          <section id="admin">
            <SectionHeading id="admin">Panel Admin</SectionHeading>
            <p className="text-sm text-muted-foreground mb-6">
              Akses panel admin melalui{" "}
              <Link href="/admin" className="text-primary hover:underline">/admin</Link>.
              Dashboard menampilkan ringkasan hari ini (pendapatan, jumlah transaksi, item terlaris) secara otomatis.
            </p>

            {/* Inventori (menu only) */}
            <SubHeading id="admin-inventori">Inventori Menu</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Kelola kategori, menu, varian, paket, dan harga (regular &amp; online).
              <strong> Resep menu</strong> sekarang dipindah ke menu <em>Bahan Baku → Resep Menu</em>.
            </p>

            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Menambah item menu baru</p>
            <Steps>
              <li>Buka <Link href="/admin/inventory" className="text-primary hover:underline">Inventori Menu</Link>.</li>
              <li>Pilih kategori atau buat kategori baru dengan tombol <strong>+ Kategori</strong>.</li>
              <li>Ketuk <strong>+ Item</strong>, isi nama dan harga dasar.</li>
              <li>Tambahkan varian harga jika ada (misal: Kecil / Besar).</li>
              <li>Aktifkan toggle <strong>Aktif</strong> agar item muncul di kasir, lalu simpan.</li>
            </Steps>

            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Mengatur harga platform online</p>
            <Steps>
              <li>Di halaman detail item, buka bagian <strong>Harga Online</strong>.</li>
              <li>Masukkan harga khusus untuk GoFood, ShopeeFood, atau GrabFood (bisa berbeda dari harga reguler).</li>
              <li>Simpan.</li>
            </Steps>

            {/* Bahan Baku */}
            <SubHeading id="admin-bahan-baku">Bahan Baku &amp; HPP</SubHeading>
            <p className="text-sm text-muted-foreground mb-3">
              Daftar pusat semua bahan, kemasan, dan perlengkapan. Setiap pembelian
              memperbarui stok dan menyetel <strong>HPP = harga pembelian terakhir</strong>,
              jadi laporan HPP selalu memakai harga terkini. Menu Bahan Baku ada di nav
              group sendiri: <em>Bahan Baku</em> (Daftar Bahan, Resep Menu, Resep Bahan
              Olahan, Supplier, Opname Stok).
            </p>

            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Tambah bahan baru</p>
            <Steps>
              <li>Buka <Link href="/admin/ingredients" className="text-primary hover:underline">Daftar Bahan</Link>.</li>
              <li>Ketuk <strong>+ Tambah</strong> dan isi: nama, kategori (Bahan/Kemasan/Perlengkapan/Lainnya), <strong>Satuan</strong> (ketik bebas: <code>gram</code>, <code>ml</code>, <code>butir</code>, <code>pcs</code>…), batas stok minimum (opsional), supplier default (opsional), dan tag (opsional, pisah koma).</li>
              <li>Satuan ini dipakai untuk stok, resep, dan HPP — sama di seluruh sistem. Pilih satuan terkecil yang praktis.</li>
              <li>Klik baris bahan untuk masuk ke halaman detail.</li>
            </Steps>

            <Tips>
              <li>Untuk mengganti satuan bahan yang sudah punya riwayat, pakai <strong>Ubah Satuan (konversi)</strong> di tab Pengaturan — stok, HPP, dan semua resep ikut dikonversi otomatis.</li>
              <li>Filter tag (chip kecil di atas daftar) memudahkan mencari bahan: misal <code>#frozen</code>, <code>#kering</code>.</li>
            </Tips>

            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Pembelian per dus / karton</p>
            <p className="text-sm text-muted-foreground">
              Tidak ada pack/konversi otomatis. Saat mencatat pembelian, isi <strong>jumlah dalam satuan bahan</strong>. Untuk beli per dus, konversi dulu: mis. 2 dus telur = <code>60</code> butir. Anda hitung sekali, saat memang tahu angkanya.
            </p>

            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Halaman detail bahan</p>
            <Tips>
              <li><strong>Tab Pembelian</strong> — daftar semua pembelian dengan supplier, sumber, dan tombol <strong>Edit</strong> (Owner) untuk memperbaiki jumlah/total bayar.</li>
              <li><strong>Tab Pemakaian</strong> — semua log stok (PURCHASE, SALE, ADJUSTMENT, WASTE) dari mana pun.</li>
              <li><strong>Tab Pengaturan</strong> — edit info, Ubah Satuan, Set HPP Manual, sesuaikan stok, catat pemborosan, nonaktifkan bahan.</li>
            </Tips>

            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Koreksi stok manual</p>
            <Steps>
              <li>Buka halaman detail bahan → tab <strong>Pengaturan</strong>.</li>
              <li>Untuk koreksi umum: ketuk <strong>Sesuaikan Stok</strong>, isi nilai (positif = tambah, negatif = kurangi).</li>
              <li>Untuk pemborosan/kerusakan: ketuk <strong>+ Catat Pemborosan</strong>, isi jumlah dan alasan.</li>
            </Steps>

            <Tips>
              <li>HPP = <strong>harga pembelian terakhir</strong> (berdasarkan tanggal), bukan rata-rata.</li>
              <li>Edit/hapus pengeluaran mengembalikan stok dan menghitung ulang HPP dari pembelian yang tersisa.</li>
            </Tips>

            <Link
              href="/petunjuk/cogs"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline font-medium"
            >
              Baca panduan lengkap Bahan, Supplier &amp; Opname →
            </Link>

            {/* Satuan */}
            <SubHeading id="admin-satuan">Satuan Bahan</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Setiap bahan punya <strong>satu satuan bebas</strong> yang Anda tentukan
              (<code>gram</code>, <code>ml</code>, <code>butir</code>, <code>pcs</code>, …).
              Satuan itu dipakai untuk stok, resep, dan HPP sekaligus — konsisten di seluruh sistem.
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Aturan</p>
            <Tips>
              <li>Resep memakai satuan bahan yang sama. Mis. kopi dalam <code>gram</code>: tulis 18 untuk 18 g.</li>
              <li>Konversi dari satuan pasar (dus/karton/kg) Anda lakukan sendiri saat mencatat pembelian — tidak ada pack otomatis.</li>
              <li>Mencampur bahan beda satuan dalam satu resep <strong>aman</strong> — sistem menjumlah rupiah, bukan satuan fisik.</li>
            </Tips>
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Mengganti satuan (Ubah Satuan)</p>
            <Steps>
              <li>Buka detail bahan → tab <strong>Pengaturan</strong> → tautan <strong>Ubah Satuan (konversi)</strong>.</li>
              <li>Isi satuan baru dan <strong>faktor</strong> (berapa satuan lama dalam 1 satuan baru, mis. 1 kg = 1000 gram).</li>
              <li>Sistem mengonversi stok, HPP, dan semua resep yang memakai bahan ini sekaligus. Total rupiah tidak berubah.</li>
            </Steps>

            {/* Resep Menu */}
            <SubHeading id="admin-resep-menu">Resep Menu</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Komposisi bahan per menu/varian. Ini sumber perhitungan HPP &amp; pengurang stok saat penjualan.
              Halaman pindah dari Inventori → Bahan Baku.
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Membuat resep baru</p>
            <Steps>
              <li>Buka <Link href="/admin/bahan/resep-menu" className="text-primary hover:underline">Resep Menu</Link>.</li>
              <li>Ketuk <strong>+ Buat Resep</strong>, pilih menu item (dan varian bila ada), lalu <strong>Buat Resep</strong>.</li>
              <li>Klik resep tersebut di daftar untuk expand → tambah bahan.</li>
            </Steps>
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Tambah banyak bahan sekaligus (bulk)</p>
            <Steps>
              <li>Di dalam resep, buka panel <strong>&quot;▶ Tambah banyak bahan sekaligus&quot;</strong>.</li>
              <li>Tempel daftar bahan, satu per baris, format <code>nama bahan, jumlah</code>. Contoh:
                <pre className="text-xs bg-muted/40 rounded p-2 mt-1 leading-relaxed">{`Susu UHT, 180\nKopi Arabika, 18000\nCup Plastik 16oz, 1`}</pre>
              </li>
              <li>Sistem mencari bahan secara fuzzy. Baris yang cocok ditandai hijau dengan satuannya; yang tidak cocok ditandai merah dengan alasan.</li>
              <li>Perbaiki baris merah (atau hapus), lalu ketuk <strong>Simpan (N)</strong> — semua baris masuk dalam satu transaksi.</li>
            </Steps>
            <Tips>
              <li>Tombol &quot;+ Tambah satu bahan (manual)&quot; tetap tersedia untuk kasus khusus (bahan lepas tanpa link).</li>
              <li>Jumlah selalu dalam satuan bahan tersebut (lihat info di dropdown).</li>
            </Tips>

            {/* Resep Bahan Olahan */}
            <SubHeading id="admin-resep-olahan">Resep Bahan Olahan</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Bahan olahan = bahan yang dirakit dari bahan-bahan lain (sambal, kaldu, bumbu jadi).
              Setiap produksi (assembly) memotong stok komponen dan menambah stok induk;
              HPP induk dihitung ulang dari biaya komponen saat produksi.
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Membuat resep olahan baru</p>
            <Steps>
              <li>Buka <Link href="/admin/bahan/resep-olahan" className="text-primary hover:underline">Resep Bahan Olahan</Link>.</li>
              <li>Ketuk <strong>+ Buat Resep Olahan Baru</strong>, pilih bahan yang akan menjadi <em>induk/hasil</em> (mis. &quot;Sambal Pecel&quot;), klik <strong>Buka Editor</strong>.</li>
              <li>Di tab Resep bahan tersebut, isi <strong>Hasil/Batch</strong> (jumlah yang dihasilkan tiap kali produksi), lalu tambah komponen.</li>
            </Steps>
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Tambah banyak komponen sekaligus</p>
            <Steps>
              <li>Buka panel <strong>&quot;▶ Tambah banyak komponen sekaligus&quot;</strong> di tab Resep bahan.</li>
              <li>Tempel baris <code>nama bahan, jumlah</code> seperti pada Resep Menu.</li>
              <li>Komponen boleh beda satuan dari induk — biaya selalu dijumlah dalam rupiah.</li>
            </Steps>
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Mencatat produksi (assembly)</p>
            <Steps>
              <li>Setelah komponen lengkap, isi <strong>Jumlah Batch</strong> di kartu Produksi, lalu <strong>Catat Produksi</strong>.</li>
              <li>Stok komponen otomatis berkurang; stok bahan induk bertambah <code>yieldQty × batch</code>; HPP induk dihitung ulang dari biaya komponen.</li>
            </Steps>
            <Tips>
              <li>Halaman daftar Bahan menampilkan chip biru <em>&quot;olahan&quot;</em> pada bahan yang punya resep olahan.</li>
              <li>Bagian &quot;Komponen Aktif&quot; di halaman Resep Bahan Olahan menunjukkan bahan-bahan yang dipakai sebagai komponen — klik untuk lihat detailnya.</li>
            </Tips>

            {/* Supplier */}
            <SubHeading id="admin-supplier">Supplier</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Daftar penjual/toko langganan. Saat catat pengeluaran, pilih supplier dari dropdown — riwayat pembelian per supplier tersimpan otomatis.
            </p>
            <Steps>
              <li>Buka <Link href="/admin/suppliers" className="text-primary hover:underline">Supplier</Link>.</li>
              <li>Ketuk <strong>+ Tambah</strong>, isi nama (wajib), nomor HP dan catatan (opsional).</li>
              <li>Untuk mengubah atau menonaktifkan: ketuk <strong>Edit</strong> atau <strong>Hapus</strong> di baris supplier.</li>
            </Steps>

            {/* Opname */}
            <SubHeading id="admin-opname">Opname Stok</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Hitung fisik stok bahan dan bandingkan dengan catatan sistem. Lakukan minimal sebulan sekali — dashboard akan memunculkan peringatan jika belum opname bulan ini.
            </p>
            <Steps>
              <li>Buka <Link href="/admin/stock-opname" className="text-primary hover:underline">Opname Stok</Link>.</li>
              <li>Ketuk <strong>+ Mulai Opname</strong>.</li>
              <li>Untuk setiap bahan, isi <strong>jumlah fisik</strong> hasil hitung. Selisih vs sistem ditampilkan di samping.</li>
              <li>Tambah catatan opname (opsional), lalu ketuk <strong>Simpan Opname</strong>.</li>
              <li>Stok sistem disetel ke jumlah fisik; selisih masuk ke log sebagai ADJUSTMENT (kurang) atau OPNAME_GAIN (lebih).</li>
            </Steps>
            <Tips>
              <li>Riwayat opname tersimpan dan bisa di-expand kapan saja untuk lihat detail penyesuaian per bahan.</li>
            </Tips>

            {/* Transaksi */}
            <SubHeading id="admin-transaksi">Transaksi</SubHeading>
            <Steps>
              <li>Buka <Link href="/admin/transactions" className="text-primary hover:underline">Transaksi</Link>.</li>
              <li>Gunakan filter tanggal, metode pembayaran, atau status untuk mempersempit hasil.</li>
              <li>Ketuk baris transaksi untuk melihat detail lengkap (item, pembayaran, kasir).</li>
              <li>Untuk membatalkan transaksi, ketuk <strong>Void</strong> di halaman detail, isi alasan pembatalan, lalu konfirmasi. Notifikasi akan dikirim ke Owner.</li>
            </Steps>

            {/* Pengeluaran Admin */}
            <SubHeading id="admin-pengeluaran">Pengeluaran (Admin)</SubHeading>
            <Steps>
              <li>Buka <Link href="/admin/expenses" className="text-primary hover:underline">Pengeluaran</Link> di panel admin.</li>
              <li>Atur filter rentang tanggal untuk melihat pengeluaran pada periode tertentu.</li>
              <li>Lihat ringkasan total per kategori template di bagian atas halaman.</li>
            </Steps>

            {/* Sesi & Absensi — brief */}
            <SubHeading id="admin-sesi">Sesi Login &amp; Absensi</SubHeading>
            <Tips>
              <li><strong>Sesi Login</strong> — lihat log sesi historis semua staff, lengkap dengan info pelanggan dan status pembayaran.</li>
              <li><strong>Absensi</strong> — tandai kehadiran staff per hari (Hadir / Tidak Hadir). Lihat rekap bulanan di bagian atas halaman.</li>
            </Tips>

            {/* Owner-only sections */}
            {isOwner ? (
              <>
                <SubHeading id="admin-performa-menu">Performa Menu</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/menu-performance" className="text-primary hover:underline">Performa Menu</Link>.</li>
                  <li>Pilih periode (harian / mingguan / bulanan / tahunan) dan navigasi tanggal dengan tombol panah atau date picker.</li>
                  <li>Tabel menampilkan setiap item menu beserta: jumlah terjual, pendapatan, HPP/porsi, total HPP, laba kotor, dan margin %.</li>
                  <li>Ketuk judul kolom untuk mengurutkan. Gunakan kolom pencarian untuk memfilter nama menu.</li>
                  <li>Item tanpa resep tetap muncul, namun kolom HPP dan Margin kosong.</li>
                </Steps>

                <SubHeading id="admin-kas-pak-har">Kas Pak Har</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/kas-pak-har" className="text-primary hover:underline">Kas Pak Har</Link>.</li>
                  <li>Untuk setoran: ketuk <strong>Setor</strong>, isi jumlah dan keterangan.</li>
                  <li>Untuk penarikan: ketuk <strong>Tarik</strong>, isi jumlah.</li>
                  <li>Potongan dari pengeluaran yang ditandai &quot;Kas Pak Har&quot; masuk otomatis.</li>
                  <li>Saldo berjalan ditampilkan di bagian atas halaman.</li>
                </Steps>

                <SubHeading id="admin-laporan">Laporan</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/reports" className="text-primary hover:underline">Laporan</Link>.</li>
                  <li>Pilih rentang tanggal menggunakan date picker.</li>
                  <li>Grafik menampilkan pendapatan harian, breakdown per metode pembayaran, dan tipe layanan.</li>
                  <li>Ketuk <strong>Export PDF</strong> atau <strong>Export CSV</strong> untuk mengunduh laporan.</li>
                </Steps>

                <SubHeading id="admin-staff">Kelola Staff</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/staff" className="text-primary hover:underline">Kelola Staff</Link>.</li>
                  <li>Ketuk <strong>+ Staff</strong> untuk menambah anggota baru — isi nama, peran, dan email.</li>
                  <li>Sistem akan membuat akun login. Staff menggunakan email tersebut untuk masuk.</li>
                  <li>Untuk menonaktifkan staff, buka detail staff dan matikan toggle <strong>Aktif</strong>.</li>
                </Steps>

                <SubHeading id="admin-backup">Backup &amp; Restore</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/backup" className="text-primary hover:underline">Backup DB</Link>.</li>
                  <li>Ketuk <strong>Export</strong> untuk mengunduh snapshot penuh database (format JSON).</li>
                  <li>Untuk restore: pilih tab <strong>Restore</strong>, unggah file backup JSON yang sebelumnya diunduh, lalu konfirmasi.</li>
                  <li>Lakukan backup secara berkala sebagai cadangan data bisnis.</li>
                </Steps>

                <SubHeading id="admin-pengaturan">Pengaturan</SubHeading>
                <Steps>
                  <li>Buka <Link href="/settings" className="text-primary hover:underline">Pengaturan</Link>.</li>
                  <li>Edit nama toko, alamat, dan nomor telepon yang tampil di struk.</li>
                  <li>Atur persentase <strong>Pajak</strong> dan <strong>Service Charge</strong> default.</li>
                  <li>Simpan perubahan.</li>
                </Steps>
              </>
            ) : (
              <>
                <SubHeading id="admin-owner-only">Fitur Lainnya</SubHeading>
                <OwnerOnly />
              </>
            )}
          </section>
        </>
      )}

      <hr className="border-border my-8" />

      {/* ── AKSES PERAN ── */}
      <section id="akses-peran">
        <SectionHeading id="akses-peran">Akses Peran</SectionHeading>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border px-3 py-2 text-left font-semibold">Fitur</th>
                <th className="border border-border px-3 py-2 text-center font-semibold text-purple-600">Owner</th>
                <th className="border border-border px-3 py-2 text-center font-semibold text-blue-600">Manager</th>
                <th className="border border-border px-3 py-2 text-center font-semibold text-green-600">Kasir</th>
                <th className="border border-border px-3 py-2 text-center font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Aplikasi Kasir (POS)", true, true, true, false],
                  ["Catat Pengeluaran", true, true, true, true],
                  ["Kas Harian (buka/tutup)", true, true, true, false],
                  ["Pencairan Online", true, true, true, false],
                  ["Profil Pengguna", true, true, true, true],
                  ["Panel Admin (Dashboard)", true, true, true, false],
                  ["Inventori & Resep", true, true, false, false],
                  ["Bahan Baku & HPP", true, true, false, false],
                  ["Supplier", true, true, false, false],
                  ["Opname Stok", true, true, false, false],
                  ["Transaksi & Void", true, true, false, false],
                  ["Pengeluaran (admin)", true, true, false, false],
                  ["Pencairan Online (admin)", true, true, false, false],
                  ["Hapus Pencairan", true, false, false, false],
                  ["Sesi Login", true, true, false, false],
                  ["Absensi", true, true, false, false],
                  ["Performa Menu", true, false, false, false],
                  ["Kas Pak Har", true, true, false, false],
                  ["Laporan", true, true, false, false],
                  ["Kelola Staff", true, false, false, false],
                  ["Notifikasi sistem", true, false, false, false],
                  ["Backup & Restore", true, false, false, false],
                  ["Pengaturan", true, false, false, false],
                ] as [string, boolean, boolean, boolean, boolean][]
              ).map(([feature, owner, manager, cashier, s]) => (
                <tr key={feature} className="even:bg-muted/30">
                  <td className="border border-border px-3 py-1.5">{feature}</td>
                  <td className="border border-border px-3 py-1.5 text-center">{owner ? "✓" : ""}</td>
                  <td className="border border-border px-3 py-1.5 text-center">{manager ? "✓" : ""}</td>
                  <td className="border border-border px-3 py-1.5 text-center">{cashier ? "✓" : ""}</td>
                  <td className="border border-border px-3 py-1.5 text-center">{s ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground mt-10 pt-6 border-t border-border">
        Masuk sebagai <strong>{staff.name ?? staff.role}</strong> ({role}).
      </p>

      <BackToTop />
    </Container>
  );
}
