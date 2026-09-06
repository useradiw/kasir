/**
 * calk.ts — CALK (Catatan Atas Laporan Keuangan), SAK EMKM style notes.
 *
 * Pure, no Prisma — every generated figure is derived ONLY from the
 * `laporan` object the caller already built (getLaporanKeuangan); this
 * module never re-queries. Notes are free-text, owner-editable, persisted
 * separately (see calkNotesRepository.ts) and passed in here.
 *
 * `CalkInput` is a deliberately narrow structural subset of
 * `LaporanKeuangan` (app/actions/admin/queries/laporan-keuangan-queries.ts)
 * so this file stays import-free of that "use server" module — any object
 * with the right shape (numbers already converted from bigint) satisfies it.
 */

export interface CalkGeneratedValue {
  label: string;
  value: string | number;
}

export interface CalkSection {
  key: string;
  title: string;
  generated: CalkGeneratedValue[];
  /** Owner-editable free text for this section; "" when never annotated. */
  note: string;
}

export interface CalkResult {
  sections: CalkSection[];
}

export interface CalkInput {
  period: { dateFrom: string; dateTo: string };
  labaRugi: {
    pendapatan: { tunai: number; qris: number; online: number; total: number };
    pengeluaran_bahan_baku: { lines: { label: string; amount: number }[]; total: number };
    pengeluaran_operasional: { lines: { label: string; amount: number }[]; total: number };
  };
  neraca: {
    aset: { lines: { account: string; label: string; amount: number }[] };
  };
  perubahanModal: {
    modal_awal: number;
    tambahan_modal: number;
    laba_bersih: number;
    /** Debit-positive engine convention (see changesInEquity.ts) — this
     *  module negates it for display, matching lib/laporan-csv.ts. */
    prive: number;
    modal_akhir: number;
  };
}

/**
 * Build the six CALK sections. Generated values come only from `laporan`;
 * `notes` is sectionKey -> free text (missing key == no note yet, "" is the
 * intended default — see calkNotesRepository.ts).
 */
export function buildCalk(laporan: CalkInput, notes: Record<string, string> = {}): CalkResult {
  const noteFor = (key: string) => notes[key] ?? "";

  const kasLines = laporan.neraca.aset.lines.filter((l) => l.account.startsWith("Assets:Cash:"));

  const sections: CalkSection[] = [
    {
      key: "dasar-penyusunan",
      title: "Dasar Penyusunan Laporan Keuangan",
      generated: [
        { label: "Dasar pencatatan", value: "Kas (cash basis)" },
        { label: "Mata uang penyajian", value: "Rupiah (Rp)" },
        { label: "Periode laporan", value: `${laporan.period.dateFrom} s/d ${laporan.period.dateTo}` },
      ],
      note: noteFor("dasar-penyusunan"),
    },
    {
      key: "kebijakan-akuntansi",
      title: "Ikhtisar Kebijakan Akuntansi Penting",
      generated: [
        { label: "Pengakuan beban", value: "Beban dicatat langsung saat terjadi, bukan sebagai persediaan/aset" },
        { label: "Pengeluaran Bahan Baku", value: "Berasal dari pembelian bahan baku yang dicatat sebagai pengeluaran" },
        { label: "Pengakuan pendapatan", value: "Diakui saat kas diterima; penjualan online diakui saat pencairan dana, bukan saat pesanan dibuat" },
      ],
      note: noteFor("kebijakan-akuntansi"),
    },
    {
      key: "rincian-kas",
      title: "Rincian Kas dan Setara Kas",
      generated: kasLines.map((l) => ({ label: l.label, value: l.amount })),
      note: noteFor("rincian-kas"),
    },
    {
      key: "rincian-pendapatan",
      title: "Rincian Pendapatan",
      generated: [
        { label: "Tunai", value: laporan.labaRugi.pendapatan.tunai },
        { label: "QRIS", value: laporan.labaRugi.pendapatan.qris },
        { label: "Online", value: laporan.labaRugi.pendapatan.online },
        { label: "Total Pendapatan", value: laporan.labaRugi.pendapatan.total },
      ],
      note: noteFor("rincian-pendapatan"),
    },
    {
      key: "rincian-beban",
      title: "Rincian Beban",
      generated: [
        ...laporan.labaRugi.pengeluaran_bahan_baku.lines.map((l) => ({ label: `Bahan Baku - ${l.label}`, value: l.amount })),
        { label: "Total Pengeluaran Bahan Baku", value: laporan.labaRugi.pengeluaran_bahan_baku.total },
        ...laporan.labaRugi.pengeluaran_operasional.lines.map((l) => ({ label: l.label, value: l.amount })),
        { label: "Total Pengeluaran Operasional", value: laporan.labaRugi.pengeluaran_operasional.total },
      ],
      note: noteFor("rincian-beban"),
    },
    {
      key: "ekuitas",
      title: "Ekuitas",
      generated: [
        { label: "Modal Awal", value: laporan.perubahanModal.modal_awal },
        { label: "Tambahan Modal", value: laporan.perubahanModal.tambahan_modal },
        { label: "Laba Bersih", value: laporan.perubahanModal.laba_bersih },
        // Displayed as an outflow (negative), matching lib/laporan-csv.ts.
        { label: "Prive", value: -laporan.perubahanModal.prive },
        { label: "Modal Akhir", value: laporan.perubahanModal.modal_akhir },
      ],
      note: noteFor("ekuitas"),
    },
  ];

  return { sections };
}
