import { requireAuth } from "@/lib/admin-auth";
import { AppShell } from "@/components/shell/app-shell";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import Link from "next/link";
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
    <AppShell role={role}>
      <div id="top" className="px-4 pb-1 pt-6">
        <Link href="/akun" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Akun
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Petunjuk Penggunaan</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Cara pakai tiap layar · diperbarui 30 Agustus 2026
        </p>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-6 pt-3">
      {/* TOC at top */}
      <BentoCard className="mb-6 flex flex-col gap-0.5">
        <CardLabel>Daftar Isi</CardLabel>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <a href="#kasir" className="text-foreground hover:text-primary transition-colors py-0.5">Kasir (POS)</a>
          <a href="#pengeluaran" className="text-foreground hover:text-primary transition-colors py-0.5">Pengeluaran</a>
          {hasCashAccess && (
            <a href="#kas-harian" className="text-foreground hover:text-primary transition-colors py-0.5">Kas Harian</a>
          )}
          {hasCashAccess && (
            <a href="#pencairan-online" className="text-foreground hover:text-primary transition-colors py-0.5">Pencairan Online</a>
          )}
          {isAdmin && (
            <a href="#admin-inventori" className="text-foreground hover:text-primary transition-colors py-0.5">Menu Management</a>
          )}
          {isAdmin && (
            <a href="#admin-supplier" className="text-foreground hover:text-primary transition-colors py-0.5">Supplier</a>
          )}
          {isAdmin && (
            <a href="#admin-transaksi" className="text-foreground hover:text-primary transition-colors py-0.5">Transaksi</a>
          )}
          {isOwner && (
            <a href="#admin-buku-kas" className="text-foreground hover:text-primary transition-colors py-0.5">Buku Kas &amp; Cek Saldo</a>
          )}
          {isOwner && (
            <a href="#admin-tutup-buku" className="text-foreground hover:text-primary transition-colors py-0.5">Tutup Buku</a>
          )}
          {isOwner && (
            <a href="#admin-akun-penjualan" className="text-foreground hover:text-primary transition-colors py-0.5">Akun Penjualan</a>
          )}
          {isOwner && (
            <a href="#admin-laporan-keuangan" className="text-foreground hover:text-primary transition-colors py-0.5">Laporan Keuangan</a>
          )}
          <a href="#akses-peran" className="text-foreground hover:text-primary transition-colors py-0.5">Akses Peran</a>
        </div>
      </BentoCard>

      {/* ── KASIR ── */}
      <section>
        <SectionHeading id="kasir">Kasir (POS)</SectionHeading>
        <p className="text-sm text-muted-foreground mb-4">
          Halaman utama untuk melayani transaksi pelanggan. Kasir bekerja secara{" "}
          <strong>offline</strong> — tetap berjalan tanpa internet dan data akan
          disinkronkan ke server secara otomatis saat koneksi tersedia.
        </p>

        <SubHeading id="kasir-sesi">Membuat sesi baru</SubHeading>
        <Steps>
          <li>Buka halaman <Link href="/kasir" className="cursor-pointer text-primary hover:underline">Kasir</Link> dari menu utama.</li>
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
      <section>
        <SectionHeading id="pengeluaran">Pengeluaran</SectionHeading>
        <p className="text-sm text-muted-foreground mb-4">
          Catat pengeluaran operasional harian. Tersedia untuk semua peran —
          catatan langsung masuk ke buku besar (ledger).
        </p>
        <Steps>
          <li>Buka <Link href="/buku/belanja" className="cursor-pointer text-primary hover:underline">Pengeluaran</Link> dari menu utama.</li>
          <li>Pilih <strong>Akun kas</strong> — dari mana uangnya keluar (mis. Kas Laci, Kas Pak Har).</li>
          <li>Pilih <strong>Kategori</strong> pengeluaran.</li>
          <li>Isi nama item, <strong>Qty</strong>, dan <strong>Harga satuan</strong> — jumlah total terisi otomatis (boleh disunting).</li>
          <li>Ketuk <strong>Simpan</strong>. Catatan langsung masuk ke buku besar.</li>
        </Steps>
      </section>

      {hasCashAccess && (
        <>
          <hr className="border-border my-8" />

          {/* ── KAS HARIAN ── */}
          <section>
            <SectionHeading id="kas-harian">Kas Harian</SectionHeading>
            <p className="text-sm text-muted-foreground mb-4">
              Catat saldo kas di awal dan akhir hari.
            </p>

            <SubHeading id="kas-harian-buka">Membuka kas</SubHeading>
            <Steps>
              <li>Buka <Link href="/kas" className="cursor-pointer text-primary hover:underline">Kas</Link> dari menu utama.</li>
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
          <section>
            <SectionHeading id="pencairan-online">Pencairan Online</SectionHeading>
            <p className="text-sm text-muted-foreground mb-4">
              Catat dan rekonsiliasi pencairan dari platform pesan-antar (GoFood, ShopeeFood, GrabFood).
            </p>
            <Steps>
              <li>Buka <Link href="/settlement" className="cursor-pointer text-primary hover:underline">Pencairan Online</Link> dari menu utama.</li>
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
              <Link href="/admin" className="cursor-pointer text-primary hover:underline">/admin</Link>.
              Dashboard menampilkan ringkasan hari ini (pendapatan, jumlah transaksi, item terlaris) secara otomatis.
            </p>

            {/* Menu Management */}
            <SubHeading id="admin-inventori">Menu Management</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Kelola kategori, menu, varian, paket, dan harga (regular &amp; online).
            </p>

            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Menambah item menu baru</p>
            <Steps>
              <li>Buka <Link href="/admin/inventory" className="cursor-pointer text-primary hover:underline">Menu Management</Link>.</li>
              <li>Pilih kategori atau buat kategori baru dengan tombol <strong>+ Kategori</strong>.</li>
              <li>Ketuk <strong>+ Item</strong>, isi nama dan harga dasar.</li>
              <li>Tambahkan varian harga jika ada (misal: Kecil / Besar).</li>
              <li>Aktifkan toggle <strong>Aktif</strong> agar item muncul di kasir, lalu simpan.</li>
            </Steps>

            <p className="text-xs font-medium text-muted-foreground mt-4 mb-1">Mengatur harga platform online &amp; bawa pulang</p>
            <Steps>
              <li>Buka <Link href="/admin/inventory" className="cursor-pointer text-primary hover:underline">Menu Management</Link>, lalu pilih tab <strong>Harga Online</strong> atau <strong>Bawa Pulang</strong>.</li>
              <li>Masukkan harga khusus untuk GoFood, ShopeeFood, GrabFood, atau pesanan bawa pulang (bisa berbeda dari harga reguler).</li>
              <li>Jika tidak diisi, harga reguler yang dipakai. Ketuk <strong>Simpan</strong>.</li>
            </Steps>

            {/* Supplier */}
            <SubHeading id="admin-supplier">Supplier</SubHeading>
            <p className="text-sm text-muted-foreground mb-2">
              Daftar penjual/toko langganan. Saat catat pengeluaran, pilih supplier dari dropdown — riwayat pembelian per supplier tersimpan otomatis.
            </p>
            <Steps>
              <li>Buka <Link href="/admin/suppliers" className="cursor-pointer text-primary hover:underline">Supplier</Link>.</li>
              <li>Ketuk <strong>+ Tambah</strong>, isi nama (wajib), nomor HP dan catatan (opsional).</li>
              <li>Untuk mengubah atau menonaktifkan: ketuk <strong>Edit</strong> atau <strong>Hapus</strong> di baris supplier.</li>
            </Steps>

            {/* Transaksi */}
            <SubHeading id="admin-transaksi">Transaksi</SubHeading>
            <Steps>
              <li>Buka <Link href="/admin/transactions" className="cursor-pointer text-primary hover:underline">Transaksi</Link>.</li>
              <li>Gunakan filter tanggal, metode pembayaran, atau status untuk mempersempit hasil.</li>
              <li>Ketuk baris transaksi untuk melihat detail lengkap (item, pembayaran, kasir).</li>
              <li>Untuk membatalkan transaksi, ketuk <strong>Void</strong> di halaman detail, isi alasan pembatalan, lalu konfirmasi. Notifikasi akan dikirim ke Owner.</li>
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
                  <li>Buka <Link href="/admin/menu-performance" className="cursor-pointer text-primary hover:underline">Performa Menu</Link>.</li>
                  <li>Pilih periode (harian / mingguan / bulanan / tahunan) dan navigasi tanggal dengan tombol panah atau date picker.</li>
                  <li>Tabel menampilkan setiap item menu beserta jumlah terjual dan pendapatan.</li>
                  <li>Ketuk judul kolom untuk mengurutkan. Gunakan kolom pencarian untuk memfilter nama menu.</li>
                </Steps>

                <SubHeading id="admin-buku-kas">Buku Kas &amp; Cek Saldo</SubHeading>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Buku Kas</strong> menampilkan catatan mutasi tiap akun kas selama satu
                  bulan: saldo awal, setiap transaksi yang masuk/keluar, dan saldo akhir.
                </p>
                <Steps>
                  <li>Buka <Link href="/buku/kas" className="cursor-pointer text-primary hover:underline">Buku Kas</Link>.</li>
                  <li>Tab <strong>Buku Kas</strong>: lihat mutasi tiap akun kas untuk bulan yang dipilih di pemilih bulan.</li>
                  <li>
                    Tab <strong>Cek Saldo</strong>: hitung uang fisik di setiap akun kas, lalu
                    catat hasilnya. Aplikasi akan membandingkan uang yang dihitung dengan saldo
                    buku besar dan menampilkan <strong>selisih</strong> jika ada perbedaan.
                  </li>
                  <li>Mencatat hasil hitung tidak mengubah buku besar — itu hanya bukti catatan uang yang benar-benar ada pada tanggal tersebut.</li>
                  <li>Akun yang belum pernah dihitung akan tertulis &quot;Belum pernah dihitung&quot;, bukan Rp 0.</li>
                </Steps>

                <SubHeading id="admin-akun-penjualan">Akun Penjualan</SubHeading>
                <p className="text-sm text-muted-foreground mb-2">
                  Penjualan baru masuk ke buku besar jika setiap cara bayar sudah
                  dipetakan ke akun kasnya. Pemetaan ini cukup dilakukan sekali.
                </p>
                <Steps>
                  <li>Buka <Link href="/buku/akun-penjualan" className="cursor-pointer text-primary hover:underline">Akun Penjualan</Link>.</li>
                  <li>Petakan ketiga saluran ke akun kas: <strong>Tunai</strong> (mis. Kas Laci), <strong>Elektronik (QRIS/transfer)</strong> (mis. Bank), dan <strong>Online</strong>.</li>
                  <li>Simpan. Selama masih ada yang belum dipetakan, penjualan tetap jalan seperti biasa — hanya belum masuk ke jurnal.</li>
                </Steps>

                <SubHeading id="admin-tutup-buku">Tutup Buku (Bulan)</SubHeading>
                <p className="text-sm text-muted-foreground mb-2">
                  Tutup buku mengunci sebuah bulan akuntansi supaya tidak ada entri baru yang bisa
                  diposting atau dibatalkan (void) di bulan itu — gunakan setelah laporan bulan
                  tersebut sudah final.
                </p>
                <Steps>
                  <li>Buka <Link href="/buku/bulan" className="cursor-pointer text-primary hover:underline">Bulan</Link>.</li>
                  <li>Ketuk <strong>Tutup Buku</strong> pada bulan yang ingin dikunci.</li>
                  <li>
                    Jika ada pemeriksaan validasi yang gagal, penguncian akan ditolak dan alasan
                    lengkapnya ditampilkan. Perbaiki dulu datanya, atau ketuk{" "}
                    <strong>Kunci Paksa (Abaikan Pemeriksaan)</strong> jika memang ingin mengunci
                    walau ada yang gagal.
                  </li>
                  <li>Untuk membuka kembali bulan yang sudah terkunci, ketuk <strong>Buka Kembali</strong>.</li>
                </Steps>
                <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground mb-2">
                  Penting: jika sebuah bulan sudah dikunci dan kasir tetap menutup kas untuk
                  tanggal di bulan itu, kas tetap bisa ditutup seperti biasa — tapi catatannya
                  TIDAK masuk ke buku besar. Hari itu akan tertulis &quot;Belum tercatat ke buku
                  besar&quot; di Kas Harian. Ini bukan bug — itu memang konsekuensi dari menutup
                  buku bulan tersebut. Untuk memulihkannya, Owner membuka kembali bulan itu
                  (Buka Kembali), lalu menekan tombol pemulihan pada tanda di Kas Harian agar
                  catatan hari itu masuk ke buku besar.
                </p>

                <SubHeading id="admin-kas-pak-har">Kas Pak Har</SubHeading>
                <p className="text-sm text-muted-foreground mb-2">
                  Halaman Kas Pak Har yang terpisah sudah tidak ada lagi. Uang
                  Pak Har sekarang dicatat sebagai pengeluaran biasa di{" "}
                  <Link href="/buku/belanja" className="cursor-pointer text-primary hover:underline">Pengeluaran</Link>{" "}
                  dengan memilih akun kas &quot;Kas Pak Har&quot; — saldonya
                  bisa dilihat dari buku besar di{" "}
                  <Link href="/buku/jurnal" className="cursor-pointer text-primary hover:underline">Jurnal</Link>.
                </p>

                <SubHeading id="admin-laporan">Laporan</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/reports" className="cursor-pointer text-primary hover:underline">Laporan</Link>.</li>
                  <li>Pilih rentang tanggal menggunakan date picker.</li>
                  <li>Grafik menampilkan pendapatan harian, breakdown per metode pembayaran, dan tipe layanan.</li>
                  <li>Pengeluaran Bahan Baku dihitung dari pengeluaran bahan baku di buku besar, bukan dari harga per item.</li>
                  <li>Gaji karyawan yang ditampilkan adalah perkiraan (gaji harian x hari hadir) — tidak dikurangkan dari laba bersih. Catat gaji sebagai pengeluaran agar ikut masuk buku besar dan laba bersih.</li>
                  <li>Ketuk <strong>Export PDF</strong> atau <strong>Export CSV</strong> untuk mengunduh laporan.</li>
                </Steps>
                <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground mt-3 mb-2">
                  Penting: laporan sekarang dibaca dari buku besar. Pengeluaran yang dicatat
                  sebelum tanggal perpindahan ke buku besar tidak lagi muncul di laporan mana
                  pun — datanya tetap tersimpan dan ter-backup, hanya tidak terlihat. Masukkan
                  kembali yang masih penting lewat Pengeluaran atau Saldo Awal.
                </p>

                <SubHeading id="admin-laporan-keuangan">Laporan Keuangan</SubHeading>
                <p className="text-sm text-muted-foreground mb-2">
                  Laporan keuangan bulanan yang disusun langsung dari buku besar — angkanya
                  selalu cocok dengan Jurnal, Buku Kas, dan tutup kas.
                </p>
                <Steps>
                  <li>Buka <Link href="/buku/laporan" className="cursor-pointer text-primary hover:underline">Laporan Keuangan</Link>.</li>
                  <li>Pilih bulan di pemilih bulan, lalu pilih tab yang dibutuhkan di bagian atas.</li>
                  <li>Ketuk <strong>Unduh CSV</strong> untuk mengunduh laporan bulan yang sedang dibuka.</li>
                </Steps>
                <Tips>
                  <li><strong>Laba Rugi</strong> — untung atau rugi bulan itu: penjualan dikurangi Pengeluaran Bahan Baku dan Pengeluaran Operasional.</li>
                  <li><strong>Neraca</strong> — harta, utang, dan modal toko pada akhir bulan.</li>
                  <li><strong>Arus Kas</strong> — dari mana uang masuk dan ke mana uang keluar selama sebulan.</li>
                  <li><strong>Perubahan Modal</strong> — berapa modal toko bertambah atau berkurang dibanding bulan sebelumnya.</li>
                  <li><strong>CALK</strong> — Catatan Atas Laporan Keuangan: catatan singkat per bagian laporan; tulis langsung di halamannya.</li>
                  <li><strong>Validasi</strong> — pemeriksaan otomatis bahwa semua laporan cocok satu sama lain; semua baris harus lolos.</li>
                </Tips>

                <SubHeading id="admin-staff">Kelola Staff</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/staff" className="cursor-pointer text-primary hover:underline">Kelola Staff</Link>.</li>
                  <li>Ketuk <strong>+ Staff</strong> untuk menambah anggota baru — isi nama, peran, dan email.</li>
                  <li>Sistem akan membuat akun login. Staff menggunakan email tersebut untuk masuk.</li>
                  <li>Untuk menonaktifkan staff, buka detail staff dan matikan toggle <strong>Aktif</strong>.</li>
                </Steps>

                <SubHeading id="admin-backup">Backup &amp; Restore</SubHeading>
                <Steps>
                  <li>Buka <Link href="/admin/backup" className="cursor-pointer text-primary hover:underline">Backup DB</Link>.</li>
                  <li>Ketuk <strong>Export</strong> untuk mengunduh snapshot penuh database (format JSON).</li>
                  <li>Untuk restore: pilih tab <strong>Restore</strong>, unggah file backup JSON yang sebelumnya diunduh, lalu konfirmasi.</li>
                  <li>Lakukan backup secara berkala sebagai cadangan data bisnis.</li>
                </Steps>

                <SubHeading id="admin-pengaturan">Pengaturan</SubHeading>
                <Steps>
                  <li>Buka <Link href="/settings" className="cursor-pointer text-primary hover:underline">Pengaturan</Link>.</li>
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
      <section>
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
                  ["Menu Management", true, true, false, false],
                  ["Supplier", true, true, false, false],
                  ["Transaksi & Void", true, true, false, false],
                  ["Pencairan Online (admin)", true, true, false, false],
                  ["Hapus Pencairan", true, false, false, false],
                  ["Sesi Login", true, true, false, false],
                  ["Absensi", true, true, false, false],
                  ["Performa Menu", true, false, false, false],
                  ["Jurnal / Buku Besar (Keuangan)", true, false, false, false],
                  ["Buku Kas & Cek Saldo", true, false, false, false],
                  ["Tutup Buku (Bulan)", true, false, false, false],
                  ["Akun Penjualan", true, false, false, false],
                  ["Laporan Keuangan", true, false, false, false],
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
      </div>
    </AppShell>
  );
}
