import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container id="not-found" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
      <Card className="w-full max-w-sm shadow" size="sm">
        <CardHeader className="border-b">
          <CardTitle className="font-bold text-xl">Halaman Tidak Ditemukan</CardTitle>
          <CardDescription>
            Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Periksa kembali URL atau kembali ke halaman utama.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/" className="cursor-pointer text-primary underline hover:text-primary/80">
            Kembali ke Halaman Utama
          </Link>
        </CardFooter>
      </Card>
    </Container>
  );
}
