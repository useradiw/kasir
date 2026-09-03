import { BentoCard, CardLabel } from "@/components/shell/ui";

/**
 * Unauthenticated, so it applies the `.dark` token scope itself rather than
 * using AppShell — same as the login screen. No bottom tab bar: there is no
 * signed-in role to build one for.
 */
export default function CekEmail() {
  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <BentoCard className="flex w-full max-w-sm flex-col gap-0.5">
        <CardLabel>Cek Email Anda</CardLabel>
        <h1 className="font-display mt-1.5 text-[17px] font-bold">Pendaftaran berhasil</h1>
        <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-muted-foreground">
          Kami sudah mengirim link konfirmasi ke email Anda. Silakan buka inbox
          atau folder spam, lalu klik link itu untuk mengaktifkan akun.
        </p>
      </BentoCard>
    </div>
  );
}
