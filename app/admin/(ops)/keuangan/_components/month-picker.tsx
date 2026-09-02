"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSelect } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAction } from "@/hooks/use-admin-action";
import { setSelectedMonth, createMonth } from "@/app/actions/admin/keuangan";

type Month = { month: string; locked: boolean };

const NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${NAMES[(mo ?? 1) - 1]} ${y}`;
}

export function MonthPicker({ months, selected }: { months: Month[]; selected: string }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [adding, setAdding] = useState(false);
  const [newMonth, setNewMonth] = useState(selected);

  // Ensure the active month is always shown, even if not yet created.
  const options = months.some((m) => m.month === selected)
    ? months
    : [{ month: selected, locked: false }, ...months];

  function pick(month: string) {
    run(async () => {
      await setSelectedMonth({ month });
      router.refresh();
    });
  }

  function create() {
    run(async () => {
      await createMonth({ month: newMonth });
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminSelect value={selected} disabled={isPending} onChange={(e) => pick(e.target.value)}>
        {options.map((m) => (
          <option key={m.month} value={m.month}>
            {formatMonth(m.month)}
            {m.locked ? " (terkunci)" : ""}
          </option>
        ))}
      </AdminSelect>

      {adding ? (
        <>
          <Input
            type="month"
            className="w-40"
            value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)}
          />
          <Button size="sm" onClick={create} disabled={isPending}>Simpan</Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={isPending}>Batal</Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setNewMonth(selected); setAdding(true); }}
          disabled={isPending}
        >
          + Bulan
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
