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
        <span className="block mt-1 text-xs">Diperbarui: 28 Juli 2026</span>
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
            <a href="#admin-supplier" className="text-foreground hover:text-primary transition-colors py-0.5">Supplier</a>
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
          <li>Isi nama item, <strong>Jumlah</strong> beserta satuannya (mis. gram/butir/dus — bebas), lalu <strong>Total bayar</strong>.</li>
          <li>Centang <strong>Potongan Kas</strong> bila mengurangi saldo kas harian, atau <strong>Catat ke Kas Pak Har</strong> untuk jurnal pemilik.</li>
          <li>Ketuk <strong>Simpan</strong>.</li>
        </Steps>
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
                  <li>Tabel menampilkan setiap item menu beserta jumlah terjual dan pendapatan.</li>
                  <li>Ketuk judul kolom untuk mengurutkan. Gunakan kolom pencarian untuk memfilter nama menu.</li>
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
                  ["Inventori Menu", true, true, false, false],
                  ["Supplier", true, true, false, false],
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
