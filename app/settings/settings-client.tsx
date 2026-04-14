"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { updateSettings } from "@/app/actions/admin/settings";
import { ArrowLeft, Check } from "lucide-react";

export default function SettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, string>;
}) {
  const [values, setValues] = useState(initialSettings);
  const { isPending, run, error } = useAdminAction();
  const [saved, setSaved] = useState(false);

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) fd.append(k, v);
    await run(async () => {
      await updateSettings(fd);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="size-4 mr-1" />
            Kembali
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
      </div>

      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informasi Toko</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nama Toko" value={values.store_name} onChange={(v) => set("store_name", v)} />
            <Field label="Alamat" value={values.store_address} onChange={(v) => set("store_address", v)} />
            <Field label="No. Telepon" value={values.store_phone} onChange={(v) => set("store_phone", v)} placeholder="08xxxxxxxxxx" />
            <Field label="Instagram" value={values.store_instagram} onChange={(v) => set("store_instagram", v)} placeholder="@username" />
          </CardContent>
        </Card>

        {/* Receipt */}
        <Card>
          <CardHeader>
            <CardTitle>Struk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Footer Struk" value={values.receipt_footer} onChange={(v) => set("receipt_footer", v)} />
          </CardContent>
        </Card>

        {/* Cash Register */}
        <Card>
          <CardHeader>
            <CardTitle>Kas Harian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Durasi Kunci Kas (jam)"
              value={values.lock_hours}
              onChange={(v) => set("lock_hours", v)}
              type="number"
              min="0"
              max="24"
            />
            <p className="text-xs text-muted-foreground">
              Staff harus menunggu selama ini sebelum bisa menutup kas. Owner tidak terpengaruh.
            </p>
          </CardContent>
        </Card>

        {/* Default Charges */}
        <Card>
          <CardHeader>
            <CardTitle>Default Biaya</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Pajak Default (%)"
              value={values.default_tax_pct}
              onChange={(v) => set("default_tax_pct", v)}
              type="number"
              min="0"
              max="100"
              step="0.5"
            />
            <Field
              label="Service Charge Default (%)"
              value={values.default_service_pct}
              onChange={(v) => set("default_service_pct", v)}
              type="number"
              min="0"
              max="100"
              step="0.5"
            />
            <p className="text-xs text-muted-foreground">
              Nilai default yang terisi otomatis saat membuat transaksi baru. Owner/Manager masih bisa mengubahnya per transaksi.
            </p>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isPending} className="gap-1.5">
          {saved && <Check className="size-4" />}
          {isPending ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan Pengaturan"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
