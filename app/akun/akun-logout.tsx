"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/sign-out";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useUnsyncedCount } from "@/hooks/use-session-store";

/**
 * The sign-out row on /akun. Sign-out also lives on /profile, where account
 * management sits; this is the one-tap route from the bottom tab bar, which is
 * where staff look for it at a shift change.
 *
 * Unsynced sales survive a sign-out — they live in IndexedDB, not the session —
 * but `pushTransaction` needs an authenticated session, so they stall until
 * someone signs back in. The confirmation says so rather than blocking.
 */
export function AkunLogout() {
  const confirm = useConfirm();
  const unsynced = useUnsyncedCount();

  async function handleClick() {
    const pending = unsynced ?? 0;
    const ok = await confirm({
      title: "Keluar dari akun ini?",
      description:
        pending > 0
          ? `Masih ada ${pending} penjualan yang belum tersinkron. Penjualan itu tidak hilang, tapi baru terkirim setelah ada yang masuk lagi.`
          : "Anda harus memasukkan username dan password lagi untuk memakai aplikasi.",
      confirmLabel: "Keluar",
      destructive: true,
    });
    if (ok) await signOut();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-1 flex cursor-pointer items-center rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-left transition-all duration-150 active:scale-[0.99]"
    >
      <div>
        <p className="text-[14px] font-bold text-destructive">Keluar</p>
        <p className="mt-0.5 text-[11.5px] font-semibold text-destructive/80">
          Akhiri sesi dan kembali ke halaman masuk
        </p>
      </div>
      <LogOut className="ml-auto size-4 text-destructive" />
    </button>
  );
}
