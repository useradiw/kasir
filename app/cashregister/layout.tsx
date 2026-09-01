import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Kas Harian - Sate Kambing Sido Mampir",
  description: "Kas Harian Sate Kambing Sido Mampir",
};

export default async function CashRegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return <>{children}</>;
}
