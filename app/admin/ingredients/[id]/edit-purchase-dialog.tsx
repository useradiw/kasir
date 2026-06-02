"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Spinner } from "@/components/ui/spinner";
import { formatRpPerUnit, formatRupiah } from "@/lib/format";
import { editPurchase } from "@/app/actions/admin/ingredient-purchases";
import { useAdminAction } from "@/hooks/use-admin-action";

type Pack = { label: string; baseQty: number; isDefault: boolean };

type PurchaseInfo = {
  id:        string;
  packLabel: string | null;
  packQty:   number;
  baseQty:   number;
  totalCost: number;
  unitCost:  number;
  source:    string;
  purchasedAtLabel: string;
};

export function EditPurchaseDialog({
  ingredientName,
  baseUnit,
  purchase,
  open,
  onOpenChange,
  onSuccess,
}: {
  ingredientName: string;
  baseUnit: string;
  packs: Pack[];
  purchase: PurchaseInfo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pembelian — {ingredientName}</DialogTitle>
        </DialogHeader>

        {!purchase ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <EditPurchaseForm
            key={purchase.id}
            ingredientName={ingredientName}
            baseUnit={baseUnit}
            purchase={purchase}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPurchaseForm({
  ingredientName,
  baseUnit,
  purchase,
  onClose,
  onSuccess,
}: {
  ingredientName: string;
  baseUnit: string;
  purchase: PurchaseInfo;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [note, setNote] = useState<string>(purchase.packLabel ?? "");
  const [qty, setQty] = useState<number | null>(purchase.baseQty);
  const [totalCost, setTotalCost] = useState<number | null>(purchase.totalCost);
  const { isPending, run, error } = useAdminAction();

  const previewUnitCost = qty && qty > 0 ? (totalCost ?? 0) / qty : 0;

  const isUnchanged =
    (purchase.packLabel ?? "") === note &&
    purchase.baseQty === qty &&
    purchase.totalCost === totalCost;

  async function handleSave() {
    if (qty === null || qty <= 0) return;
    if (totalCost === null || totalCost < 0) return;

    await run(
      () => editPurchase(purchase.id, {
        packLabel: note.trim() || null,
        packQty:   qty,
        totalCost,
      }),
      {
        successMessage: `Pembelian "${ingredientName}" diperbarui`,
        onSuccess: () => { onClose(); onSuccess?.(); },
      },
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md bg-muted/40 p-3 text-xs space-y-0.5 text-muted-foreground">
        <p>Tanggal: <span className="text-foreground">{purchase.purchasedAtLabel}</span></p>
        <p>
          Sekarang: <span className="text-foreground tabular-nums">{purchase.baseQty} {baseUnit}</span>
          {" "}@ <span className="text-foreground tabular-nums">{formatRpPerUnit(purchase.unitCost)}/{baseUnit}</span>
        </p>
        <p>Total bayar: <span className="text-foreground tabular-nums">{formatRupiah(purchase.totalCost)}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Jumlah ({baseUnit})</Label>
          <DecimalInput defaultValue={qty} onValueChange={setQty} className="h-9" />
        </div>
        <div className="grid gap-1.5">
          <Label>Total bayar (Rp)</Label>
          <DecimalInput defaultValue={totalCost} onValueChange={setTotalCost} className="h-9" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Catatan satuan beli (opsional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="cth: 2 dus — hanya pengingat, tidak dihitung"
          className="h-9"
        />
      </div>

      <div className="rounded-lg border border-border p-3 space-y-1 text-xs">
        <p className="font-semibold text-foreground">Hasil setelah disimpan</p>
        <p className="tabular-nums">
          Stok masuk: <span className="text-foreground">{(qty ?? 0).toFixed((qty ?? 0) % 1 === 0 ? 0 : 3)} {baseUnit}</span>
        </p>
        <p className="tabular-nums">
          Harga per {baseUnit}: <span className="text-foreground">{formatRpPerUnit(previewUnitCost)}/{baseUnit}</span>
        </p>
        <p className="text-muted-foreground pt-1 border-t border-foreground/5 mt-1">
          Stok disesuaikan dengan selisih jumlah. HPP bahan diambil dari pembelian terakhir.
          Pesanan historis (Transaction.cogs) tidak ikut diubah.
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
          Batal
        </Button>
        <Button
          size="sm"
          disabled={
            isPending ||
            isUnchanged ||
            qty === null || qty <= 0 ||
            totalCost === null || totalCost < 0
          }
          onClick={handleSave}
        >
          {isPending ? <Spinner /> : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
