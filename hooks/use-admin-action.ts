"use client";

import { useState, useTransition } from "react";
import { notify } from "@/lib/notify";

interface RunOptions {
  onSuccess?: () => void;
  successMessage?: string;
}

// Redirects thrown by server actions (requireRole etc.) travel as errors with
// a "NEXT_REDIRECT" digest. Detecting via the digest keeps this free of the
// non-public next/dist import that broke on upgrades.
function isRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function useAdminAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>, opts?: RunOptions) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        if (opts?.successMessage) {
          notify.success(opts.successMessage);
        }
        opts?.onSuccess?.();
      } catch (e) {
        if (isRedirect(e)) throw e;
        const message = e instanceof Error ? e.message : "Terjadi kesalahan.";
        setError(message);
        notify.error(e);
      }
    });
  }

  return { isPending, run, error, setError };
}
