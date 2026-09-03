import Link from "next/link";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { Button } from "@/components/ui/button";

/** Unauthenticated — applies the `.dark` scope itself, like the login screen. */
export default function AuthCodeError() {
  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <BentoCard className="flex w-full max-w-sm flex-col gap-0.5">
        <CardLabel>Link Tidak Valid</CardLabel>
        <h1 className="font-display mt-1.5 text-[17px] font-bold">
          Link konfirmasi tidak bisa dipakai
        </h1>
        <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-muted-foreground">
          Link itu tidak valid atau sudah kadaluarsa. Silakan daftar ulang, atau
          hubungi pemilik kalau masalahnya berlanjut.
        </p>
        <Button className="mt-4 w-full" render={<Link href="/auth/daftar" />}>
          Daftar Ulang
        </Button>
      </BentoCard>
    </div>
  );
}
