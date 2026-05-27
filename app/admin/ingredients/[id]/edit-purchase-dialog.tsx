"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const NO_PACK = "__no_pack__";

export function EditPurchaseDialog({
  ingredientName,
  baseUnit,
  packs,
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
            packs={packs}
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
  packs,
  purchase,
  onClose,
  onSuccess,
}: {
  ingredientName: string;
  baseUnit: string;
  packs: Pack[];
  purchase: PurchaseInfo;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [packLabel, setPackLabel] = useState<string>(purchase.packLabel ?? NO_PACK);
  const [packQty, setPackQty] = useState<number | null>(purchase.packQty);
  const [totalCost, setTotalCost] = useState<number | null>(purchase.totalCost);
  const { isPending, run, error } = useAdminAction();

  const packBaseQty = useMemo(() => {
    if (packLabel === NO_PACK) return 1;
    return packs.find((p) => p.label === packLabel)?.baseQty ?? 1;
  }, [packLabel, packs]);

  const previewBaseQty = (packQty ?? 0) * packBaseQty;
  const previewUnitCost = previewBaseQty > 0 ? (totalCost ?? 0) / previewBaseQty : 0;
  const targetUnitLabel = packLabel === NO_PACK ? baseUnit : packLabel;

  const isUnchanged =
    (purchase.packLabel ?? NO_PACK) === packLabel &&
    purchase.packQty === packQty &&
    purchase.totalCost === totalCost;

  async function handleSave() {
    if (packQty === null || packQty <= 0) return;
    if (totalCost === null || totalCost < 0) return;

    await run(
      () => editPurchase(purchase.id, {
        packLabel: packLabel === NO_PACK ? null : packLabel,
        packQty,
        totalCost,
      }),
      {
        successMessage: `Pembelian "${ingredientName}" diperbarui — WMA + stok di-replay`,
        onSuccess: () => {
          onClose();
          onSuccess?.();
        },
      },
    );
  }

  return (
    <div className="space-y-4 text-sm">
            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-0.5 text-muted-foreground">
              <p>Tanggal: <span className="text-foreground">{purchase.purchasedAtLabel}</span></p>
              <p>
                Sekarang: <span className="text-foreground tabular-nums">
                  {purchase.packQty}{purchase.packLabel ? ` ${purchase.packLabel}` : ` (tanpa pack)`}
                </span> · stok masuk{" "}
                <span className="text-foreground tabular-nums">
                  {purchase.baseQty} {baseUnit}
                </span> @ <span className="text-foreground tabular-nums">{formatRpPerUnit(purchase.unitCost)}/{baseUnit}</span>
              </p>
              <p>Total bayar: <span className="text-foreground tabular-nums">{formatRupiah(purchase.totalCost)}</span></p>
            </div>

            <div className="grid gap-1.5">
              <Label>Pack</Label>
              <select
                value={packLabel}
                onChange={(e) => setPackLabel(e.target.value)}
                className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm"
              >
                <option value={NO_PACK}>tanpa pack (qty dalam {baseUnit})</option>
                {packs.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label} (1 {p.label} = {p.baseQty} {baseUnit}){p.isDefault ? " · default" : ""}
                  </option>
                ))}
              </select>
              {packs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Bahan ini belum punya pack. Tambahkan dulu di tab Pengaturan kalau ingin pakai pack.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Qty ({packLabel === NO_PACK ? baseUnit : packLabel})</Label>
                <DecimalInput
                  defaultValue={packQty}
                  onValueChange={setPackQty}
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Total bayar (Rp)</Label>
                <DecimalInput
                  defaultValue={totalCost}
                  onValueChange={setTotalCost}
                  className="h-9"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-1 text-xs">
              <p className="font-semibold text-foreground">Hasil setelah disimpan</p>
              <p className="tabular-nums">
                Stok masuk: <span className="text-foreground">{previewBaseQty.toFixed(previewBaseQty % 1 === 0 ? 0 : 3)} {baseUnit}</span>
                {" "}({packQty ?? 0} {targetUnitLabel} × {packBaseQty} {baseUnit}/{targetUnitLabel})
              </p>
              <p className="tabular-nums">
                Harga per {baseUnit}: <span className="text-foreground">{formatRpPerUnit(previewUnitCost)}/{baseUnit}</span>
              </p>
              <p className="text-muted-foreground pt-1 border-t border-foreground/5 mt-1">
                Setelah simpan, seluruh riwayat pembelian + log bahan ini direplay agar
                <strong> currentStock, HPP rata-rata, dan stockAfter di tiap baris</strong> konsisten.
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
                  packQty === null || packQty <= 0 ||
                  totalCost === null || totalCost < 0
                }
                onClick={handleSave}
              >
                {isPending ? <Spinner /> : "Simpan & replay"}
              </Button>
            </div>
    </div>
  );
}
