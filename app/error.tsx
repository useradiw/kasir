"use client";

import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container id="error" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
      <Card className="w-full max-w-sm shadow" size="sm">
        <CardHeader className="border-b">
          <CardTitle className="font-bold text-xl">Terjadi Kesalahan</CardTitle>
          <CardDescription>
            Maaf, terjadi kesalahan saat memuat halaman ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error.message || "Silakan coba lagi atau hubungi administrator."}
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={reset} className="cursor-pointer">
            Coba Lagi
          </Button>
        </CardFooter>
      </Card>
    </Container>
  );
}
