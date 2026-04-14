import { requireOwner } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  await requireOwner();
  const settings = await getSettings();
  return <SettingsClient initialSettings={settings} />;
}
