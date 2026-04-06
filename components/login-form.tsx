import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Form from "next/form";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { z } from "zod";

const masukSchema = z.object({
    username: z.string().min(1, { message: "Username tidak boleh kosong." }),
    password: z.string().min(1, { message: "Password tidak boleh kosong." }),
});

export function LoginForm() {
    const handleClick = async (formData: FormData) => {
        "use server";

        const parsed = masukSchema.safeParse({
            username: formData.get("username"),
            password: formData.get("password"),
        });

        if (!parsed.success) {
            const errors = parsed.error.flatten().fieldErrors;
            const message = Object.values(errors).flat().join(", ");
            throw new Error(message);
        }

        const staff = await prisma.staff.findUnique({
            where: { username: parsed.data.username },
        });

        if (!staff || !staff.supabaseUserId) {
            throw new Error("Username tidak ditemukan.");
        }

        if (!staff.isActive) {
            throw new Error("Akun staff tidak aktif.");
        }

        const adminSupabase = createAdminClient();
        const { data: userData, error: userError } =
            await adminSupabase.auth.admin.getUserById(staff.supabaseUserId);

        if (userError || !userData.user?.email) {
            throw new Error("Gagal mengambil data akun.");
        }

        const supabase = await createClient();
        const { error } = await supabase.auth.signInWithPassword({
            email: userData.user.email,
            password: parsed.data.password,
        });

        if (error) {
            throw new Error("Password salah.");
        }

        redirect("/");
    };

    return (
        <Card className="w-full max-w-sm shadow" size="sm">
            <CardHeader className="border-b">
                <CardTitle className="font-bold text-xl">Kasir - Sate Kambing Katamso</CardTitle>
                <CardDescription>
                    Masuk dengan username dan password.
                </CardDescription>
            </CardHeader>
            <Form action={handleClick}>
                <CardContent className="mb-6">
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="username"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center">
                                <Label htmlFor="password">Password</Label>
                            </div>
                            <Input id="password" name="password" type="password" required />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                    <Button type="submit" className="w-full cursor-pointer">
                        Masuk
                    </Button>
                </CardFooter>
            </Form>
        </Card>
    );
}
