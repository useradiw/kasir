"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAction } from "@/hooks/use-admin-action";
import { login } from "@/app/actions/login";

/**
 * The login screen (docs/redesign/screens-auth.html, mockup 1). Dark tokens,
 * brand tile up top, no self-registration link (invite-only via Staff).
 */
export function LoginForm() {
    const { isPending, run, error } = useAdminAction();
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="pt-16 text-center">
            <div className="mx-auto mb-4 grid size-[72px] place-items-center rounded-[22px] bg-primary-soft text-primary">
                <span className="font-display text-[30px] font-extrabold">S</span>
            </div>
            <h1 className="font-display text-[22px] font-bold">Sate Kambing Sido Mampir</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
                Kasir & pembukuan — masuk untuk mulai
            </p>

            <form
                className="mt-8 text-left"
                action={(fd) =>
                  // login returns failures as data (prod redacts thrown server
                  // action messages) — raise locally so the copy survives.
                  run(async () => {
                    const res = await login(fd);
                    if (res?.error) throw new Error(res.error);
                  })
                }
            >
                {error && (
                    <div className="mb-4 rounded-xl bg-destructive-soft px-4 py-2.5 text-sm font-semibold text-destructive">
                        {error}
                    </div>
                )}

                <div>
                    <Label htmlFor="username" className="mb-1.5 text-[12px] font-bold text-muted-foreground">
                        Username
                    </Label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        placeholder="username"
                        required
                        disabled={isPending}
                        className="font-display h-11 w-full rounded-[13px] border border-border bg-card px-3.5 text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                    />
                </div>

                <div className="mt-3.5">
                    <Label htmlFor="password" className="mb-1.5 text-[12px] font-bold text-muted-foreground">
                        Password
                    </Label>
                    <div className="relative flex items-center">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            disabled={isPending}
                            className="font-display h-11 w-full rounded-[13px] border border-border bg-card px-3.5 pr-16 text-[15px] font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            disabled={isPending}
                            className="absolute right-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                        >
                            {showPassword ? "sembunyikan" : "lihat"}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    className="mt-6 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground outline-none transition-all duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98] disabled:opacity-50"
                >
                    {isPending ? (
                        <>
                            <Spinner />
                            Masuk...
                        </>
                    ) : (
                        "Masuk"
                    )}
                </button>
                <p className="mt-3 text-center text-[12px] font-semibold text-muted-foreground">
                    Akun dibuat oleh pemilik lewat menu Staff — bukan daftar mandiri
                </p>
            </form>
        </div>
    );
}
