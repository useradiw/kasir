import { BentoCard, CardLabel } from "@/components/shell/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import Form from "next/form";

const daftarSchema = z.object({
    email: z.email({ message: "Email tidak valid." }),
    password: z.string().min(8, { message: "Password minimal 8 karakter." }),
});

/**
 * Invite-only. /auth/* is deliberately reachable without a session (the proxy
 * lets it through so people can log in), which left this page open to the
 * internet: anyone could call supabase.auth.signUp on this project. A
 * self-registered user cannot actually sign in — app/actions/login.ts requires
 * a matching Staff row — but unbounded signups still burn Supabase quota and
 * turn the confirmation mail into a spam relay aimed at any address.
 *
 * The gate is a shared code in the invite link the owner copies from
 * /admin/staff. It is checked TWICE on purpose: once to decide whether to
 * render the form, and again inside the server action, because a "use server"
 * function is a POST endpoint that never has to load this page first.
 */
function inviteCodeValid(supplied: string | undefined): boolean {
    const expected = process.env.STAFF_INVITE_CODE;
    // Fail CLOSED. A missing or empty env var disables registration rather
    // than silently reopening it to everyone.
    if (!expected) return false;
    return supplied === expected;
}

export default async function Daftar({
    searchParams,
}: {
    searchParams: Promise<{ kode?: string }>;
}) {
    const { kode } = await searchParams;
    const allowed = inviteCodeValid(kode);

    const handleClick = async (formData: FormData) => {
        "use server";

        if (!inviteCodeValid(formData.get("kode")?.toString())) {
            throw new Error("Link pendaftaran tidak berlaku. Minta link baru ke pemilik.");
        }

        const parsed = daftarSchema.safeParse({
            email: formData.get("email"),
            password: formData.get("password"),
        });

        if (!parsed.success) {
            const errors = parsed.error.flatten().fieldErrors;
            const message = Object.values(errors).flat().join(", ");
            throw new Error(message);
        }

        const supabase = await createClient();
        const siteUrl = process.env.NEXT_PUBLIC_APP_URL!;

        const { error } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
                emailRedirectTo: `${siteUrl}/auth/confirm?next=/kasir`,
            },
        });

        if (error) {
            throw new Error(error.message);
        }

        redirect("/auth/cek-email");
    };

    return (
        // Unauthenticated — applies the `.dark` scope itself, like the login
        // screen. Reached from the invite link the owner sends from /admin/staff.
        <div className="dark flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
            <BentoCard className="flex w-full max-w-sm flex-col gap-0.5">
                <CardLabel>Daftar Akun</CardLabel>
                <h1 className="font-display mt-1.5 text-[17px] font-bold">
                    Sate Kambing Sido Mampir
                </h1>
                <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">
                    {allowed
                        ? "Daftar dengan email dan password."
                        : "Halaman ini hanya bisa dibuka lewat link undangan dari pemilik. Minta link pendaftaran yang baru."}
                </p>
                {!allowed ? null : (
                <Form action={handleClick} className="mt-4 flex flex-col gap-3">
                    <input type="hidden" name="kode" value={kode ?? ""} />
                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="contoh@gmail.com"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" name="password" type="password" required />
                    </div>
                    <Button type="submit" className="mt-1 w-full">
                        Daftar
                    </Button>
                </Form>
                )}
            </BentoCard>
        </div>
    );
}
