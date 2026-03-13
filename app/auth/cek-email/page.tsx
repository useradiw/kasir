import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function CekEmail() {
    return (
        <Container id="main" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
            <Card className="w-full max-w-sm shadow" size="sm">
                <CardHeader className="border-b">
                    <CardTitle className="font-bold text-xl">Cek Email Anda</CardTitle>
                    <CardDescription>
                        Pendaftaran berhasil.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Kami telah mengirimkan link konfirmasi ke email Anda. Silakan cek inbox atau folder spam, lalu klik link tersebut untuk mengaktifkan akun.
                    </p>
                </CardContent>
            </Card>
        </Container>
    );
}
