"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { useAdminAction } from "@/hooks/use-admin-action";
import { voidTransaction } from "@/app/actions/admin/transactions";

type OrderItem = { nameSnapshot: string; qty: number; price: number; status: string };
type Row = {
  id: string;
  sessionName: string;
  service: string | null;
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
};

const statusBadge: Record<string, string> = {
  PAID: "bg-primary/10 text-primary",
  VOIDED: "bg-destructive/10 text-destructive",
};

export default function TransactionsClient({
  rows,
  page,
  totalPages,
  total,
  filters,
}: {
  rows: Row[];
  page: number;
  totalPages: number;
  total: number;
  filters: Filters;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transaksi</h1>
      {error && <ErrorBanner error={error} />}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1">
              <Label>Metode Bayar</Label>
              <AdminSelect
                value={localFilters.method}
                onChange={(e) => setLocalFilters((f) => ({ ...f, method: e.target.value }))}
              >
                <option value="">Semua</option>
                <option value="CASH">Tunai</option>
                <option value="QRIS">QRIS</option>
              </AdminSelect>
            </div>
            <div className="grid gap-1">
              <Label>Status</Label>
              <AdminSelect
                value={localFilters.status}
                onChange={(e) => setLocalFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Semua</option>
                <option value="PAID">Dibayar</option>
                <option value="VOIDED">Dibatalkan</option>
              </AdminSelect>
            </div>
            <div className="grid gap-1">
              <Label>Dari Tanggal</Label>
              <Input type="date" value={localFilters.from} onChange={(e) => setLocalFilters((f) => ({ ...f, from: e.target.value }))} className="w-36" />
            </div>
            <div className="grid gap-1">
              <Label>Sampai</Label>
              <Input type="date" value={localFilters.to} onChange={(e) => setLocalFilters((f) => ({ ...f, to: e.target.value }))} className="w-36" />
            </div>
            <Button onClick={applyFilters} size="sm">Filter</Button>
            <Button variant="ghost" size="sm" onClick={() => { setLocalFilters({ method: "", status: "", from: "", to: "" }); router.push("/admin/transactions"); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi ({total} total)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Tidak ada transaksi.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-foreground/10 p-3 space-y-2">
                {/* Top row: session + amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {r.sessionName}
                      {r.service && <span className="ml-1 text-xs text-muted-foreground">({r.service})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {methodLabel[r.paymentMethod] ?? r.paymentMethod}
                      {r.processedBy && <> · {r.processedBy}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">{formatRupiah(r.totalAmount)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? ""}`}>
                      {r.status === "PAID" ? "Dibayar" : "Void"}
                    </span>
                  </div>
                </div>

                {/* Bottom row: time + detail button */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.paidAt)}</span>
                  <Button size="xs" variant="outline" onClick={() => { setExpandId(expandId === r.id ? null : r.id); setVoidReason(""); }}>
                    {expandId === r.id ? "Tutup" : "Detail"}
                  </Button>
                </div>

                {/* Expandable detail */}
                {expandId === r.id && (
                  <div className="pt-2 border-t border-foreground/10 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="font-medium mb-2">Item Pesanan</p>
                        {r.orderItems.map((oi, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{oi.nameSnapshot} ×{oi.qty}</span>
                            <span>{formatRupiah(oi.price * oi.qty)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium mb-2">Rincian Pembayaran</p>
                        <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(r.subtotal)}</span></div>
                        {r.taxAmount > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatRupiah(r.taxAmount)}</span></div>}
                        {r.serviceCharge > 0 && <div className="flex justify-between"><span>Service</span><span>{formatRupiah(r.serviceCharge)}</span></div>}
                        <div className="flex justify-between font-medium border-t border-foreground/10 pt-1 mt-1"><span>Total</span><span>{formatRupiah(r.totalAmount)}</span></div>
                        {r.cashAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Tunai</span><span>{formatRupiah(r.cashAmount)}</span></div>}
                        {r.qrisAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>QRIS</span><span>{formatRupiah(r.qrisAmount)}</span></div>}
                      </div>
                    </div>

                    {/* Void audit info for voided transactions */}
                    {r.status === "VOIDED" && (
                      <div className="pt-2 border-t border-foreground/10 space-y-1 text-muted-foreground">
                        <p className="font-medium text-destructive">Info Void</p>
                        {r.voidReason && <p>Alasan: {r.voidReason}</p>}
                        {r.voidedBy && <p>Oleh: {r.voidedBy}</p>}
                        {r.voidedAt && <p>Waktu: {formatDateTime(r.voidedAt)}</p>}
                      </div>
                    )}

                    {/* Void action for paid transactions */}
                    {r.status === "PAID" && (
                      <div className="pt-2 border-t border-foreground/10 space-y-2">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label className="text-xs">Alasan void</Label>
                            <Input
                              value={voidReason}
                              onChange={(e) => setVoidReason(e.target.value)}
                              placeholder="Masukkan alasan void..."
                              className="h-8 text-xs"
                            />
                          </div>
                          <Button size="xs" variant="destructive" disabled={isPending || !voidReason.trim()}
                            onClick={() => run(() => voidTransaction(r.id, voidReason))}>
                            Void
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-foreground/10 mt-2">
              <p className="text-sm text-muted-foreground">Hal. {page} / {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>← Sblm</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Slnjt →</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
