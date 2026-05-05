"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner, AdminPageHeader } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import {
  addExpenseTemplate,
  updateExpenseTemplate,
  deleteExpenseTemplate,
} from "@/app/actions/admin/expense-templates";

const UNITS = ["pcs", "gr", "kg", "ml", "ltr", "btl", "bks", "dus", "lbr"];

type Template = {
  id: string;
  name: string;
  defaultUnit: string | null;
  defaultCost: number | null;
};

export default function ExpenseTemplatesClient({ templates }: { templates: Template[] }) {
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Template Pengeluaran">
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Batal" : "+ Tambah"}
        </Button>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      <p className="text-sm text-muted-foreground">
        Template membantu pengisian pengeluaran yang sering berulang. Pilih dari daftar saat mengisi item pengeluaran.
      </p>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Tambah Template</CardTitle></CardHeader>
          <CardContent>
            <TemplateForm
              isPending={isPending}
              onSubmit={(data) => run(() => addExpenseTemplate(data), {
                successMessage: "Template ditambahkan",
                onSuccess: () => setShowAdd(false),
              })}
              onCancel={() => setShowAdd(false)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Daftar Template ({templates.length})</CardTitle></CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada template.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {templates.map((t) => (
                <div key={t.id} className="py-3">
                  {editId === t.id ? (
                    <TemplateForm
                      isPending={isPending}
                      defaultValues={t}
                      onSubmit={(data) => run(() => updateExpenseTemplate(t.id, data), {
                        successMessage: "Template diperbarui",
                        onSuccess: () => setEditId(null),
                      })}
                      onCancel={() => setEditId(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.defaultUnit ? `Satuan: ${t.defaultUnit}` : "Satuan: —"}
                          {t.defaultCost != null ? ` · Biaya: ${formatRupiah(t.defaultCost)}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="xs" variant="outline" onClick={() => setEditId(t.id)}>Edit</Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={isPending}
                          onClick={async () => {
                            if (await confirm({ title: `Hapus template "${t.name}"?`, destructive: true, confirmLabel: "Hapus" }))
                              run(() => deleteExpenseTemplate(t.id), { successMessage: "Template dihapus" });
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateForm({
  isPending,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  defaultValues?: Template;
  onSubmit: (data: { name: string; defaultUnit?: string; defaultCost?: number | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [unit, setUnit] = useState(defaultValues?.defaultUnit ?? "");
  const [cost, setCost] = useState(defaultValues?.defaultCost?.toString() ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          defaultUnit: unit || undefined,
          defaultCost: cost ? parseInt(cost) : null,
        });
      }}
      className="flex flex-wrap gap-3 items-end"
    >
      <div className="grid gap-1 flex-1 min-w-36">
        <Label>Nama Item</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Contoh: Gula Pasir" />
      </div>
      <div className="grid gap-1">
        <Label>Satuan</Label>
        <AdminSelect value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">— pilih —</option>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </AdminSelect>
      </div>
      <div className="grid gap-1">
        <Label>Biaya Default (Rp)</Label>
        <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="w-32" />
      </div>
      <Button type="submit" size="sm" disabled={isPending || !name}>Simpan</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Batal</Button>
    </form>
  );
}
