import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import Link from "next/link";

export default function AuthCodeError() {
    return (
        <Container id="main" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
            <Card className="w-full max-w-sm shadow" size="sm">
                <CardHeader className="border-b">
                    <CardTitle className="font-bold text-xl">Link Tidak Valid</CardTitle>
                    <CardDescription>
                        Link konfirmasi tidak valid atau sudah kadaluarsa.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Silakan coba daftar ulang atau hubungi administrator jika masalah berlanjut.
                    </p>
                </CardContent>
                <CardFooter>
                    <Link href="/auth/daftar" className="text-blue-700 underline hover:text-blue-800">Daftar Ulang</Link>
                </CardFooter>
            </Card>
        </Container>
    );
}
