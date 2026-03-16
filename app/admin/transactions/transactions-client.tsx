"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, TableEmptyRow } from "@/components/admin/ui";
import { formatRupiah, formatDateTime } from "@/lib/format";

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
  orderItems: OrderItem[];
};

type Filters = { method: string; status: string; from: string; to: string };

const methodLabel: Record<string, string> = {
  CASH: "Tunai",
  DYNAMIC_QRIS: "QRIS Dinamis",
  STATIC_QRIS: "QRIS Statis",
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
                <option value="DYNAMIC_QRIS">QRIS Dinamis</option>
                <option value="STATIC_QRIS">QRIS Statis</option>
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

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi ({total} total)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Sesi</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Metode</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Kasir</th>
                  <th className="pb-2 font-medium">Waktu</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr key={r.id} className="border-b border-foreground/5">
                      <td className="py-2 font-medium">
                        {r.sessionName}
                        {r.service && <span className="ml-1 text-xs text-muted-foreground">({r.service})</span>}
                      </td>
                      <td className="py-2">{formatRupiah(r.totalAmount)}</td>
                      <td className="py-2 text-xs">{methodLabel[r.paymentMethod] ?? r.paymentMethod}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? ""}`}>
                          {r.status === "PAID" ? "Dibayar" : "Void"}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{r.processedBy ?? "—"}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {formatDateTime(r.paidAt)}
                      </td>
                      <td className="py-2">
                        <Button size="xs" variant="outline" onClick={() => setExpandId(expandId === r.id ? null : r.id)}>
                          Detail
                        </Button>
                      </td>
                    </tr>
                    {expandId === r.id && (
                      <tr key={`d-${r.id}`} className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
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
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {rows.length === 0 && (
                  <TableEmptyRow colSpan={7} message="Tidak ada transaksi." />
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-foreground/10 mt-4">
              <p className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>← Sebelumnya</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Selanjutnya →</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
