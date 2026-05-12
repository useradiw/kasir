"use server";

import { revalidateSettings } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { getSettings, SETTING_DEFAULTS } from "@/lib/settings";
import { runAction } from "@/lib/action-error";

export async function fetchSettings() {
  await requireOwner();
  return getSettings();
}

export async function updateSettings(formData: FormData) {
  return runAction(async () => {
    await requireOwner();

    const updates: { key: string; value: string }[] = [];
    for (const key of Object.keys(SETTING_DEFAULTS)) {
      const raw = formData.get(key);
      if (raw !== null) {
        updates.push({ key, value: raw.toString().trim() });
      }
    }

    if (updates.length === 0) throw new Error("Tidak ada perubahan.");

    await prisma.$transaction(
      updates.map(({ key, value }) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    revalidateSettings();
  });
}
