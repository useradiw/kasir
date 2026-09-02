"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { setSalesChannelAccount } from "@/app/actions/admin/keuangan";

type CashAccount = { id: string; name: string; label: string; active: boolean };
type Channel = "tunai" | "elektronik" | "online";
type Channels = Record<Channel, string | null>;

const CHANNEL_LABELS: Record<Channel, string> = {
  tunai: "Tunai",
  elektronik: "Elektronik (QRIS/transfer)",
  online: "Online",
};

const CHANNEL_HINTS: Record<Channel, string> = {
  tunai: "Uang tunai yang diterima kasir masuk ke akun kas ini saat tutup kas.",
  elektronik: "Pembayaran QRIS/transfer yang diterima kasir masuk ke akun kas ini saat tutup kas.",
  online: "Pencairan (settlement) dari GoFood/ShopeeFood/GrabFood masuk ke akun kas ini.",
};

const CHANNELS: Channel[] = ["tunai", "elektronik", "online"];

function ChannelRow({
  channel,
  value,
  cashAccounts,
}: {
  channel: Channel;
  value: string | null;
  cashAccounts: CashAccount[];
}) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [selected, setSelected] = useState(value ?? "");

  function save(next: string) {
    setSelected(next);
    if (!next) return;
    run(async () => {
      await setSalesChannelAccount({ channel, account: next });
      router.refresh();
    }, { successMessage: `Akun penjualan "${CHANNEL_LABELS[channel]}" disimpan` });
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{CHANNEL_LABELS[channel]}</p>
          <p className="text-xs text-muted-foreground">{CHANNEL_HINTS[channel]}</p>
        </div>
        {!value && (
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning-foreground">
            Belum diatur
          </span>
        )}
      </div>
      <AdminSelect
        className="w-full"
        value={selected}
        disabled={isPending}
        onChange={(e) => save(e.target.value)}
      >
        <option value="">Pilih akun kas...</option>
        {cashAccounts.map((a) => (
          <option key={a.id} value={a.name}>{a.label}</option>
        ))}
      </AdminSelect>
      <ErrorBanner error={error} />
    </div>
  );
}

export function AkunPenjualanClient({
  cashAccounts,
  channels,
}: {
  cashAccounts: CashAccount[];
  channels: Channels;
}) {
  const unmapped = CHANNELS.filter((c) => !channels[c]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Akun Penjualan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tentukan akun kas tujuan untuk setiap cara bayar penjualan. Selama ketiganya belum
          diatur, penjualan tidak bisa dicatat ke buku besar — kas harian tetap bisa ditutup
          seperti biasa, hanya belum masuk jurnal.
        </p>
        {cashAccounts.length === 0 && (
          <p className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
            Belum ada akun kas. Tambahkan dulu di Keuangan &rarr; Akun Kas.
          </p>
        )}
        {unmapped.length > 0 && cashAccounts.length > 0 && (
          <p className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
            Belum lengkap: {unmapped.map((c) => CHANNEL_LABELS[c]).join(", ")}.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {CHANNELS.map((c) => (
          <ChannelRow key={c} channel={c} value={channels[c]} cashAccounts={cashAccounts} />
        ))}
      </div>
    </div>
  );
}
