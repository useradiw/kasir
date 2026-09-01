"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RoleEnum } from "@/generated/prisma";
import { tabsForRole } from "@/components/shell/nav-items";

const ICONS: Record<string, React.ReactNode> = {
  beranda: (
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z" />
  ),
  jual: (
    <>
      <path d="M6 7h12l-1.2 13H7.2L6 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  kas: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  akun: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
};

export function BottomNav({ role, hidden }: { role: RoleEnum; hidden?: boolean }) {
  const pathname = usePathname();
  if (hidden) return null;
  const tabs = tabsForRole(role);

  return (
    <nav className="sticky bottom-0 z-30 flex border-t border-border bg-nav-bg pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => {
        const active =
          pathname === t.href ||
          (t.key === "beranda" && pathname.startsWith("/beranda")) ||
          (t.key === "kas" && pathname.startsWith("/kas"));
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[21px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS[t.key]}
            </svg>
            {t.label}
            <span
              className={`mt-0.5 h-[3px] w-4 rounded-full ${
                active ? "bg-primary" : "bg-transparent"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
