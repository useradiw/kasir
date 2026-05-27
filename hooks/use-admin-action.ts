"use client";

import { useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { notify } from "@/lib/notify";

interface RunOptions {
  onSuccess?: () => void;
  successMessage?: string;
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
        if (isRedirectError(e)) throw e;
        const message = e instanceof Error ? e.message : "Terjadi kesalahan.";
        setError(message);
        notify.error(e);
      }
    });
  }

  return { isPending, run, error, setError };
}
