import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const staff = await requireOwner();
  const settings = await getSettings();

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Admin
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Pengaturan</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Info toko, struk, kas, biaya default
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <SettingsClient initialSettings={settings} />
      </div>
    </AppShell>
  );
}
