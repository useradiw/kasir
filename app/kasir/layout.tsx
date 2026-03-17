import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kasir - Sate Kambing Katamso",
  description: "Kasir Sate Kambing Katamso",
};

export default function KasirLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
        <>
            {children}
        </>
    )
}