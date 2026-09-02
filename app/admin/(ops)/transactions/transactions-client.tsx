"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/components/admin/ui";
import { BentoCard, CardLabel, Tag } from "@/components/shell/ui";
import { formatRupiah, formatDateTime, formatTransactionShortId } from "@/lib/format";
import { useAdminAction } from "@/hooks/use-admin-action";
import { voidTransaction } from "@/app/actions/admin/transactions";

type OrderItem = { nameSnapshot: string; qty: number; price: number; status: string };
type Row = {
  id: string;
  sessionName: string;
  service: string | null;
  externalOrderId: string | null;
  isSettled: boolean;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  cashAmount: number;
  qrisAmount: number;
  paymentMethod: string;
  status: string;
  paidAt: string;
  processedBy: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  orderItems: OrderItem[];
};

type Filters = { method: string; status: string; from: string; to: string };

const methodLabel: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  SPLIT: "Split",
  PENDING: "Unsettled",
};

export default function TransactionsClient({
  rows,
  page,
  totalPages,
  total,
  filters,
  isOwner,
}: {
  rows: Row[];
  page: number;
  totalPages: number;
  total: number;
  filters: Filters;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [expandId, setExpandId] = useState<string | null>(null);
  const [localFilters, setLocalFilters] = useState(filters);
  const [voidReason, setVoidReason] = useState("");
  const { isPending, run, error } = useAdminAction();

  function applyFilters() {
    const params = new URLSearchParams({ page: "1" });
    if (localFilters.method) params.set("method", localFilters.method);
    if (localFilters.status) params.set("status", localFilters.status);
    if (localFilters.from) params.set("from", localFilters.from);
    if (localFilters.to) params.set("to", localFilters.to);
    router.push(`/admin/transactions?${params.toString()}`);
  }

  function changePage(p: number) {
    const params = new URLSearchParams();
    params.set("page", p.toString());
    if (filters.method) params.set("method", filters.method);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    router.push(`/admin/transactions?${params.toString()}`);
  }

  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {/* Filters */}
      <BentoCard className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label>Metode Bayar</Label>
            <AdminSelect
              className="border-border bg-card-2"
              value={localFilters.method}
              onChange={(e) => setLocalFilters((f) => ({ ...f, method: e.target.value }))}
            >
              <option value="">Semua</option>
              <option value="CASH">Tunai</option>
              <option value="QRIS">QRIS</option>
              <option value="SPLIT">Split</option>
              <option value="PENDING">Unsettled</option>
            </AdminSelect>
          </div>
          <div className="grid gap-1">
            <Label>Status</Label>
            <AdminSelect
              className="border-border bg-card-2"
              value={localFilters.status}
              onChange={(e) => setLocalFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Semua</option>
              <option value="PAID">Dibayar</option>
              <option value="VOIDED">Dibatalkan</option>
            </AdminSelect>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label>Dari Tanggal</Label>
            <Input type="date" value={localFilters.from} onChange={(e) => setLocalFilters((f) => ({ ...f, from: e.target.value }))} className="border-border bg-card-2" />
          </div>
          <div className="grid gap-1">
            <Label>Sampai</Label>
            <Input type="date" value={localFilters.to} onChange={(e) => setLocalFilters((f) => ({ ...f, to: e.target.value }))} className="border-border bg-card-2" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={applyFilters} size="sm">Filter</Button>
          <Button variant="ghost" size="sm" onClick={() => { setLocalFilters({ method: "", status: "", from: "", to: "" }); router.push("/admin/transactions"); }}>Reset</Button>
        </div>
      </BentoCard>

      {/* Transaction list */}
      <BentoCard className="flex flex-col gap-3">
        <CardLabel>Daftar Transaksi ({total} total)</CardLabel>

        {rows.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] font-semibold text-muted-foreground">Tidak ada transaksi.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <div key={r.id} className="space-y-2 rounded-xl border border-border p-3">
                {/* Top row: session + amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13.5px] font-bold">
                      <span>{r.sessionName}</span>
                      <span className="font-mono text-[10px] font-normal text-muted-foreground" title={r.id}>
                        {formatTransactionShortId(r.id)}
                      </span>
                      {r.service && <span className="text-[11px] font-normal text-muted-foreground">({r.service})</span>}
                    </p>
                    {r.externalOrderId && (
                      <p className="text-[11.5px] text-muted-foreground">ID: {r.externalOrderId}</p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
                      {methodLabel[r.paymentMethod] ?? r.paymentMethod}
                      {r.paymentMethod === "PENDING" && (
                        <Tag tone={r.isSettled ? "acc" : "warn"}>{r.isSettled ? "Sudah Cair" : "Belum Cair"}</Tag>
                      )}
                      {r.processedBy && <> · {r.processedBy}</>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13.5px] font-bold tabular-nums">{formatRupiah(r.totalAmount)}</p>
                    <Tag tone={r.status === "PAID" ? "acc" : "bad"}>{r.status === "PAID" ? "Dibayar" : "Void"}</Tag>
                  </div>
                </div>

                {/* Bottom row: time + detail/view buttons */}
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-muted-foreground">{formatDateTime(r.paidAt)}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" render={<Link href={`/admin/transactions/${r.id}`} />}>Lihat</Button>
                    <Button size="sm" variant="outline" onClick={() => { setExpandId(expandId === r.id ? null : r.id); setVoidReason(""); }}>
                      {expandId === r.id ? "Tutup" : "Detail"}
                    </Button>
                  </div>
                </div>

                {/* Expandable detail */}
                {expandId === r.id && (
                  <div className="space-y-3 border-t border-border pt-2 text-[11.5px]">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="mb-2 font-bold">Item Pesanan</p>
                        {r.orderItems.map((oi, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{oi.nameSnapshot} ×{oi.qty}</span>
                            <span className="tabular-nums">{formatRupiah(oi.price * oi.qty)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <p className="mb-2 font-bold">Rincian Pembayaran</p>
                        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatRupiah(r.subtotal)}</span></div>
                        {r.taxAmount > 0 && <div className="flex justify-between"><span>Pajak</span><span className="tabular-nums">{formatRupiah(r.taxAmount)}</span></div>}
                        {r.serviceCharge > 0 && <div className="flex justify-between"><span>Service</span><span className="tabular-nums">{formatRupiah(r.serviceCharge)}</span></div>}
                        <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold"><span>Total</span><span className="tabular-nums">{formatRupiah(r.totalAmount)}</span></div>
                        {r.cashAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Tunai</span><span className="tabular-nums">{formatRupiah(r.cashAmount)}</span></div>}
                        {r.qrisAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>QRIS</span><span className="tabular-nums">{formatRupiah(r.qrisAmount)}</span></div>}
                      </div>
                    </div>

                    {/* Void audit info for voided transactions */}
                    {r.status === "VOIDED" && (
                      <div className="space-y-1 border-t border-border pt-2 text-muted-foreground">
                        <p className="font-bold text-destructive">Info Void</p>
                        {r.voidReason && <p>Alasan: {r.voidReason}</p>}
                        {r.voidedBy && <p>Oleh: {r.voidedBy}</p>}
                        {r.voidedAt && <p>Waktu: {formatDateTime(r.voidedAt)}</p>}
                      </div>
                    )}

                    {/* Void action for paid transactions */}
                    {isOwner && r.status === "PAID" && (
                      <div className="space-y-2 border-t border-border pt-2">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Alasan void</Label>
                            <Input
                              value={voidReason}
                              onChange={(e) => setVoidReason(e.target.value)}
                              placeholder="Masukkan alasan void..."
                              className="h-8 border-border bg-card text-xs"
                            />
                          </div>
                          <Button size="sm" variant="destructive" disabled={isPending || !voidReason.trim()}
                            onClick={() => run(() => voidTransaction(r.id, voidReason))}>
                            Void
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <p className="text-[11.5px] font-semibold text-muted-foreground">Hal. {page} / {totalPages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>← Sblm</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Slnjt →</Button>
            </div>
          </div>
        )}
      </BentoCard>
    </>
  );
}
