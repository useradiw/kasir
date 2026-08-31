import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { signOut } from "@/app/actions/sign-out";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Container id="main" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
        <LoginForm />
      </Container>
    );
  }

  // Authenticated users live in the tab-shell app now (docs/redesign/SPEC.md);
  // the old hub cards remain below only as a deep-link fallback.
  const staffRecord = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, isActive: true },
  });
  if (staffRecord?.isActive) redirect("/beranda");

  // Active staff were redirected to /beranda above. What is left: a session
  // whose Staff record is missing or inactive — show a plain sign-out screen,
  // NOT the old hub (which used to render them a fake STAFF view).
  return (
    <Container id="main" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
      <Card className="w-full max-w-sm" size="sm">
        <CardHeader>
          <CardTitle>Akun tidak aktif</CardTitle>
          <CardDescription>
            Akun ini sudah tidak aktif atau tidak terdaftar sebagai staff. Hubungi pemilik toko.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form action={signOut} className="w-full">
            <Button type="submit" variant="outline" className="w-full cursor-pointer gap-1.5">
              <LogOut className="size-4" />
              Keluar
            </Button>
          </form>
        </CardFooter>
      </Card>
    </Container>
  );
}
