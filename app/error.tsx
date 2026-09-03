"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import { Button } from "@/components/ui/button";

/**
 * Rendered outside any route's AppShell, so it applies the `.dark` token scope
 * itself — otherwise a failure flashes a light card in a dark app.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <BentoCard className="flex w-full max-w-sm flex-col gap-0.5">
        <CardLabel>Terjadi Kesalahan</CardLabel>
        <h1 className="font-display mt-1.5 text-[17px] font-bold">
          Halaman ini gagal dimuat
        </h1>
        <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-muted-foreground">
          {error.message || "Silakan coba lagi, atau hubungi pemilik kalau masalahnya berlanjut."}
        </p>
        <Button onClick={reset} className="mt-4 w-full">
          Coba Lagi
        </Button>
      </BentoCard>
    </div>
  );
}
