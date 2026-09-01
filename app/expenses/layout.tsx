import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Pengeluaran - Sate Kambing Sido Mampir",
  description: "Catat Pengeluaran Sate Kambing Sido Mampir",
};

export default async function ExpensesLayout({
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
