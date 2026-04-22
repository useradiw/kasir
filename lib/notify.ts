"use client";

import { toast } from "sonner";

function extractMessage(err: unknown, fallback = "Terjadi kesalahan."): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}

export const notify = {
  success(message: string) {
    toast.success(message);
  },
  error(err: unknown, fallback?: string) {
    toast.error(extractMessage(err, fallback));
  },
  info(message: string) {
    toast.info(message);
  },
  warning(message: string) {
    toast.warning(message);
  },
  promise<T>(
    p: Promise<T>,
    opts: { loading: string; success: string | ((v: T) => string); error?: string }
  ) {
    return toast.promise(p, {
      loading: opts.loading,
      success: opts.success,
      error: (e) => extractMessage(e, opts.error),
    });
  },
};
