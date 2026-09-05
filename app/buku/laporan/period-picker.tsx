"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Segmented } from "@/components/shell/sheet";
import { resolvePeriod, yearOf, type PeriodScale } from "@/lib/laporan-period";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const MONTHS_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const SCALES: { value: PeriodScale; label: string }[] = [
  { value: "bulan", label: "Bulanan" },
  { value: "tahun", label: "Tahunan" },
];

/**
 * The Laporan period picker: a trigger in the page header plus the app's
 * existing Dialog.
 *
 * Design decisions, from the UI audit on 2026-09-05 (docs/design.md plus the
 * ui-ux-designer checklist). Each of these is load-bearing — please read before
 * "tidying" any of it:
 *
 * - It reuses `Dialog` rather than a hand-rolled bottom sheet. base-ui gives
 *   Escape-to-close, a focus trap, `aria-modal`, and focus returning to the
 *   trigger. The first version was a div with an onClick scrim and none of that.
 * - Months with no accounting-month row are marked with a DOT and full-opacity
 *   muted text, never `opacity-50`. Measured: `--muted-foreground` on
 *   `--popover` is 5.37:1, but at 50% opacity it collapses to 2.38:1, well
 *   under the 4.5:1 floor. They stay tappable, because the ledger reports by
 *   date and an empty month is a legitimate (and self-explanatory) answer.
 * - Cells are a full 44px tall — the HIG minimum docs/design.md sets.
 * - Changing period is a NAVIGATION, so it runs in a transition and the pressed
 *   cell shows the pending state. The audit calls for feedback on the control
 *   itself, not a global overlay.
 * - Month locking is deliberately NOT shown. A lock stops posting, not reading;
 *   surfacing it here would be noise. It belongs on /buku/bulan.
 */
export function PeriodPicker({
  activePeriod,
  monthKeys,
  years,
}: {
  activePeriod: string;
  /** Accounting months that exist, as "YYYY-MM". Used only to mark which
   *  months already have a book — never to gate what can be opened. */
  monthKeys: string[];
  years: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);

  const active = resolvePeriod(activePeriod);
  const [scale, setScale] = useState<PeriodScale>(active.scale);
  const [year, setYear] = useState(() => Number(yearOf(activePeriod)));

  // Years worth offering: those with a book, plus whatever is on screen, so the
  // stepper can never strand the user on a year the list does not contain.
  const knownYears = [...new Set([...years, yearOf(activePeriod)])].map(Number).sort();
  const minYear = knownYears[0] ?? year;
  const maxYear = knownYears[knownYears.length - 1] ?? year;

  function choose(key: string) {
    if (key === activePeriod) {
      setOpen(false);
      return;
    }
    setPending(key);
    startTransition(() => {
      router.push(`/buku/laporan?periode=${key}`);
      setOpen(false);
      setPending(null);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-10"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {active.label}
        <span aria-hidden="true" className="text-primary text-[9px]">▼</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl p-5 gap-0" showCloseButton={false}>
          <DialogTitle className="text-[14px] font-bold">Pilih periode</DialogTitle>
          <DialogDescription className="mt-0.5 mb-3.5 text-[11px] font-semibold text-muted-foreground">
            Hanya mengubah layar Laporan
          </DialogDescription>

          <Segmented options={SCALES} value={scale} onChange={setScale} />

          {scale === "bulan" ? (
            <div className="mt-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-[16px] font-bold tabular-nums">{year}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label="Tahun sebelumnya"
                    disabled={year <= minYear}
                    onClick={() => setYear((y) => y - 1)}
                  >
                    ‹
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-lg"
                    aria-label="Tahun berikutnya"
                    disabled={year >= maxYear}
                    onClick={() => setYear((y) => y + 1)}
                  >
                    ›
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MONTHS_SHORT.map((short, i) => {
                  const key = `${year}-${String(i + 1).padStart(2, "0")}`;
                  const isActive = key === activePeriod;
                  const hasBook = monthKeys.includes(key);
                  const busy = pending === key;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      className={`relative h-11 ${
                        !isActive && !hasBook ? "text-muted-foreground" : ""
                      }`}
                      aria-pressed={isActive}
                      aria-label={
                        hasBook
                          ? `${MONTHS_FULL[i]} ${year}`
                          : `${MONTHS_FULL[i]} ${year}, belum ada data`
                      }
                      disabled={isPending}
                      onClick={() => choose(key)}
                    >
                      {busy ? "…" : short}
                      {!isActive && !hasBook && !busy ? (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-2 size-[3px] rounded-full bg-muted-foreground"
                        />
                      ) : null}
                    </Button>
                  );
                })}
              </div>

              <p className="mt-3 flex items-center gap-2 text-[10.5px] font-semibold text-muted-foreground">
                <span aria-hidden="true" className="size-[3px] rounded-full bg-muted-foreground" />
                Bertitik = belum ada data, tetap bisa dibuka
              </p>
            </div>
          ) : (
            <div className="mt-3.5">
              <div className="grid grid-cols-2 gap-2">
                {[...knownYears].reverse().map((y) => {
                  const key = String(y);
                  const isActive = key === activePeriod;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      className="h-11 font-display tabular-nums"
                      aria-pressed={isActive}
                      aria-label={`Tahun ${key}`}
                      disabled={isPending}
                      onClick={() => choose(key)}
                    >
                      {pending === key ? "…" : key}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] font-semibold leading-relaxed text-muted-foreground">
                Laporan tahunan menjumlahkan seluruh bulan. Neraca diambil per 31 Desember.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
