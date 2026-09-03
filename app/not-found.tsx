import Link from "next/link";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { Button } from "@/components/ui/button";

/** Rendered outside any AppShell — applies the `.dark` token scope itself. */
export default function NotFound() {
  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <BentoCard className="flex w-full max-w-sm flex-col gap-0.5">
        <CardLabel>Halaman Tidak Ditemukan</CardLabel>
        <h1 className="font-display mt-1.5 text-[17px] font-bold">
          Halaman ini tidak ada
        </h1>
        <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-muted-foreground">
          Halaman yang Anda cari tidak tersedia atau sudah dipindahkan. Periksa
          lagi alamatnya, atau kembali ke beranda.
        </p>
        <Button className="mt-4 w-full" render={<Link href="/beranda" />}>
          Kembali ke Beranda
        </Button>
      </BentoCard>
    </div>
  );
}
