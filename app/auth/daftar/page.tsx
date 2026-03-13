import { Container } from "@/components/shared/container";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import Form from "next/form";
import { headers } from "next/headers";

const daftarSchema = z.object({
    email: z.email({ message: "Email tidak valid." }),
    password: z.string().min(8, { message: "Password minimal 8 karakter." }),
});

export default function Daftar() {
    const handleClick = async (formData: FormData) => {
        "use server";

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
        const headersList = await headers();
        const origin = headersList.get("origin") ?? headersList.get("host") ?? "http://localhost:3000";
        const siteUrl = origin.startsWith("http") ? origin : `http://${origin}`;

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
        <Container id="main" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
            <Card className="w-full max-w-sm shadow" size="sm">
                <CardHeader className="border-b">
                    <CardTitle className="font-bold text-xl">Kasir - Sate Kambing Katamso</CardTitle>
                    <CardDescription>
                        Daftar dengan email dan password.
                    </CardDescription>
                </CardHeader>
                <Form action={handleClick}>
                    <CardContent className="mb-6">
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="contoh@gmail.com"
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
                            Daftar
                        </Button>
                    </CardFooter>
                </Form>
            </Card>
        </Container>
    );
}