"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { updateSettings } from "@/app/actions/admin/settings";
import { Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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
    <>
      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Store Info */}
        <BentoCard className="flex flex-col gap-0.5">
            <CardLabel>Informasi Toko</CardLabel>
            <div className="mt-1.5 space-y-4">
            <Field label="Nama Toko" value={values.store_name} onChange={(v) => set("store_name", v)} />
            <Field label="Alamat" value={values.store_address} onChange={(v) => set("store_address", v)} />
            <Field label="No. Telepon" value={values.store_phone} onChange={(v) => set("store_phone", v)} placeholder="08xxxxxxxxxx" />
            <Field label="Instagram" value={values.store_instagram} onChange={(v) => set("store_instagram", v)} placeholder="@username" />
          </div>
        </BentoCard>

        {/* Receipt */}
        <BentoCard className="flex flex-col gap-0.5">
            <CardLabel>Struk</CardLabel>
            <div className="mt-1.5 space-y-4">
            <Field label="Footer Struk" value={values.receipt_footer} onChange={(v) => set("receipt_footer", v)} />
          </div>
        </BentoCard>

        {/* Cash Register */}
        <BentoCard className="flex flex-col gap-0.5">
            <CardLabel>Kas Harian</CardLabel>
            <div className="mt-1.5 space-y-4">
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
          </div>
        </BentoCard>

        {/* Default Charges */}
        <BentoCard className="flex flex-col gap-0.5">
            <CardLabel>Default Biaya</CardLabel>
            <div className="mt-1.5 space-y-4">
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
          </div>
        </BentoCard>

        {/* Online Vendor Commissions */}
        <BentoCard className="flex flex-col gap-0.5">
            <CardLabel>Komisi Online Vendor</CardLabel>
            <div className="mt-1.5 space-y-5">
            <p className="text-xs text-muted-foreground">
              Komisi dipotong dari pendapatan kotor setiap transaksi online. Contoh: 19% + Rp 1.000 per transaksi.
            </p>
            {(
              [
                { label: "GoFood",     pctKey: "gofood_commission_pct",     flatKey: "gofood_commission_flat" },
                { label: "ShopeeFood", pctKey: "shopeefood_commission_pct", flatKey: "shopeefood_commission_flat" },
                { label: "GrabFood",   pctKey: "grabfood_commission_pct",   flatKey: "grabfood_commission_flat" },
              ] as const
            ).map(({ label, pctKey, flatKey }) => (
              <div key={label} className="space-y-1.5">
                <Label>{label}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={values[pctKey] ?? "0"}
                    onChange={(e) => set(pctKey, e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">% +</span>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={values[flatKey] ?? "0"}
                    onChange={(e) => set(flatKey, e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">Rp</span>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Developer */}
        <BentoCard className="flex flex-col gap-0.5">
            <CardLabel>Developer</CardLabel>
            <div className="mt-1.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Mode Developer</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tampilkan widget role-switcher di seluruh halaman. Hanya terlihat oleh Owner.
                </p>
              </div>
              <Switch
                checked={values.dev_mode === "true"}
                onCheckedChange={(checked) => set("dev_mode", checked ? "true" : "false")}
              />
            </div>
          </div>
        </BentoCard>

        <Button type="submit" disabled={isPending} className="w-full gap-1.5">
          {saved && <Check className="size-4" />}
          {isPending ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan Pengaturan"}
        </Button>
      </form>
    </>
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
