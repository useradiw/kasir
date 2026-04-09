"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAction } from "@/hooks/use-admin-action";
import { login } from "@/app/actions/login";

export function LoginForm() {
    const { isPending, run, error } = useAdminAction();

    return (
        <Card className="w-full max-w-sm shadow" size="sm">
            <CardHeader className="border-b">
                <CardTitle className="font-bold text-xl">Kasir - Sate Kambing Katamso</CardTitle>
                <CardDescription>
                    Masuk dengan username dan password.
                </CardDescription>
            </CardHeader>
            <form action={(fd) => run(() => login(fd))}>
                <CardContent className="mb-6">
                    <div className="flex flex-col gap-6">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="username"
                                required
                                disabled={isPending}
                            />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center">
                                <Label htmlFor="password">Password</Label>
                            </div>
                            <Input id="password" name="password" type="password" required disabled={isPending} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                        {isPending ? (
                            <>
                                <Spinner />
                                Masuk...
                            </>
                        ) : (
                            "Masuk"
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
