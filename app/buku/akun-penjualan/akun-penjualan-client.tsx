"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSelect } from "@/components/admin/ui";
import { AlertRow, BentoCard, Row } from "@/components/shell/ui";
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
    <Row
      title={CHANNEL_LABELS[channel]}
      meta={CHANNEL_HINTS[channel]}
      className={!value ? "border-destructive/50" : undefined}
    >
      <div className="flex shrink-0 flex-col items-end gap-1">
        <AdminSelect
          className={!value ? "border-destructive text-destructive" : undefined}
          value={selected}
          disabled={isPending}
          onChange={(e) => save(e.target.value)}
        >
          <option value="">Pilih…</option>
          {cashAccounts.map((a) => (
            <option key={a.id} value={a.name}>{a.label}</option>
          ))}
        </AdminSelect>
        {error ? <span className="text-[10.5px] font-semibold text-destructive">{error}</span> : null}
      </div>
    </Row>
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
    <>
      {cashAccounts.length === 0 ? (
        <AlertRow
          tone="bad"
          title="Belum ada akun kas"
          detail="Tambahkan dulu di Buku → Akun Kas."
          actionLabel="Buka"
          actionHref="/buku/akun"
        />
      ) : unmapped.length > 0 ? (
        <AlertRow
          tone="warn"
          title={`Belum lengkap: ${unmapped.map((c) => CHANNEL_LABELS[c]).join(", ")}`}
          detail="Selama ini belum diatur, penjualan tidak tercatat ke buku besar — kas harian tetap bisa ditutup seperti biasa."
        />
      ) : null}

      <div className="flex flex-col gap-2.5">
        {CHANNELS.map((c) => (
          <ChannelRow key={c} channel={c} value={channels[c]} cashAccounts={cashAccounts} />
        ))}
      </div>

      <BentoCard className="text-center text-[11.5px] font-semibold text-muted-foreground">
        Tidak ada apa pun yang tercatat ke buku besar sampai ketiganya lengkap
      </BentoCard>
    </>
  );
}
