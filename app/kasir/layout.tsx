import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "Kasir - Sate Kambing Katamso",
  description: "Kasir Sate Kambing Katamso",
};

export default async function KasirLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return <QueryProvider>{children}</QueryProvider>;
}
