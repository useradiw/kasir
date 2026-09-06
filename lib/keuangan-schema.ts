import { z } from "zod";

// Money is integer Rupiah in the form; cast to BigInt at the action seam.
const rupiah = z.coerce.number().int("Harus bilangan bulat").nonnegative();
const rupiahPositive = z.coerce.number().int("Harus bilangan bulat").positive("Harus lebih dari 0");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");
const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Bulan tidak valid");
const kasAccount = z.string().startsWith("Assets:Cash:", "Akun kas tidak valid");

// ---- Kategori pengeluaran ----
export const categorySchema = z.object({
  code: z.string().min(1, "Kode wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  bucket: z.enum(["BAHAN_BAKU", "OPERASIONAL"]),
});
export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

// ---- Pengeluaran ----
export const pengeluaranSchema = z.object({
  date: isoDate,
  akun: kasAccount,
  item: z.string().min(1, "Item wajib diisi"),
  qty: z.coerce.number().positive("Qty harus lebih dari 0"),
  hargaSatuan: rupiah,
  jumlah: rupiahPositive,
  kategoriCode: z.string().min(1, "Kategori wajib dipilih"),
});

// ---- Catat siblings ----
export const transferSchema = z.object({
  date: isoDate,
  dari: kasAccount,
  ke: kasAccount,
  jumlah: rupiahPositive,
  catatan: z.string().optional(),
});
export const modalSchema = z.object({
  date: isoDate,
  nama: z.string().min(1, "Nama penyetor wajib diisi"),
  akun: kasAccount,
  jumlah: rupiahPositive,
  catatan: z.string().optional(),
});
export const priveSchema = z.object({
  date: isoDate,
  akun: kasAccount,
  jumlah: rupiahPositive,
  catatan: z.string().optional(),
});
export const saldoAwalSchema = z.object({
  date: isoDate,
  akun: kasAccount,
  jumlah: rupiahPositive,
});

// ---- Akun kas (cash-account registry) ----
export const cashAccountSchema = z.object({ label: z.string().min(1, "Nama akun kas wajib diisi") });
export const renameCashAccountSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });
export const setCashAccountActiveSchema = z.object({ id: z.string().min(1), active: z.boolean() });

// ---- Akun Penjualan (sales-channel -> kas account mapping) ----
export const salesChannelAccountSchema = z.object({
  channel: z.enum(["tunai", "elektronik", "online"]),
  account: kasAccount,
});

// ---- Bulan (accounting month picker) ----
export const monthSchema = z.object({ month: monthString });

// ---- CALK (Catatan Atas Laporan Keuangan) notes ----
export const calkNoteSchema = z.object({
  month: monthString,
  sectionKey: z.string().min(1),
  note: z.string().max(4000, "Catatan terlalu panjang"),
});

// ---- Cek Saldo (physically-counted balance assertion) — Slice 5 ----
export const cekSaldoSchema = z.object({
  account: kasAccount,
  date: isoDate,
  expected: rupiah,
  note: z.string().optional(),
});

// ---- Tutup buku (month lock/unlock) — Slice 5 ----
export const lockMonthSchema = z.object({
  month: monthString,
  force: z.boolean().default(false),
});
export const unlockMonthSchema = z.object({ month: monthString });

export type CategoryData = z.input<typeof categorySchema>;
export type PengeluaranData = z.input<typeof pengeluaranSchema>;
export type TransferData = z.input<typeof transferSchema>;
export type ModalData = z.input<typeof modalSchema>;
export type PriveData = z.input<typeof priveSchema>;
export type SaldoAwalData = z.input<typeof saldoAwalSchema>;
export type CalkNoteData = z.input<typeof calkNoteSchema>;
export type CekSaldoData = z.input<typeof cekSaldoSchema>;
export type LockMonthData = z.input<typeof lockMonthSchema>;
export type UnlockMonthData = z.input<typeof unlockMonthSchema>;
