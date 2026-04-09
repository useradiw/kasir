"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
          toast.success(opts.successMessage);
        }
        opts?.onSuccess?.();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Terjadi kesalahan.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return { isPending, run, error, setError };
}
