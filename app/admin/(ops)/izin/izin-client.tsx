"use client";

import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AlertRow, BentoCard, CardLabel, Row } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  CAPABILITIES,
  CAPABILITY_GROUPS,
  DEFAULT_GRID,
  TOGGLEABLE_ROLES,
  type Capability,
} from "@/lib/permissions";
import { setPermission, resetRolePermissions } from "./actions";
import type { RoleEnum } from "@/generated/prisma";

/** Indonesian names for the three toggleable roles. */
const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Kasir",
  STAFF: "Staf",
  DEVELOPER: "Developer",
};

type Overrides = Record<string, Record<string, boolean>>;

/**
 * The permission grid. OWNER and DEVELOPER are not rows here on purpose —
 * their powers are code invariants (OWNER is always allowed; DEVELOPER is the
 * superuser except on hard deletes), not grants anyone can toggle. The screen
 * says so in plain words instead of rendering locked rows nobody can touch.
 */
export function IzinClient({ overrides }: { overrides: Overrides }) {
  const [role, setRole] = useState<RoleEnum>("MANAGER");
  const { run } = useAdminAction();
  const confirm = useConfirm();

  const effective = useMemo(() => {
    const stored = overrides[role] ?? {};
    const map: Record<string, boolean> = {};
    for (const cap of Object.keys(CAPABILITIES) as Capability[]) {
      map[cap] = stored[cap] ?? DEFAULT_GRID[cap].includes(role);
    }
    return map;
  }, [overrides, role]);

  function onToggle(cap: Capability, allowed: boolean) {
    run(() => setPermission(role, cap, allowed));
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1.5">
        {TOGGLEABLE_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`cursor-pointer flex-1 rounded-full py-2 text-[12px] font-bold transition-all duration-150 ${
              role === r ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      <AlertRow
        tone="info"
        title="Owner dan Developer tidak bisa diubah"
        detail="Owner selalu bisa semuanya. Developer bisa semuanya kecuali menghapus permanen. Keduanya diatur di dalam aplikasi, bukan di layar ini."
      />

      {CAPABILITY_GROUPS.map((group) => {
        const caps = (Object.keys(CAPABILITIES) as Capability[]).filter(
          (c) => c !== "permissions.manage" && CAPABILITIES[c].group === group,
        );
        if (caps.length === 0) return null;
        return (
          <BentoCard key={group} className="flex flex-col gap-0.5 px-4 py-3">
            <CardLabel>{group}</CardLabel>
            {caps.map((cap) => (
              <Row
                key={cap}
                title={CAPABILITIES[cap].label}
                meta={effective[cap] ? "Boleh" : "Tidak boleh"}
              >
                <Switch
                  checked={effective[cap]}
                  onCheckedChange={(checked) => onToggle(cap, checked)}
                  aria-label={`${CAPABILITIES[cap].label} — ${ROLE_LABELS[role]}`}
                />
              </Row>
            ))}
          </BentoCard>
        );
      })}

      <Button
        variant="outline"
        onClick={async () => {
          if (
            await confirm({
              title: `Kembalikan izin ${ROLE_LABELS[role]} ke bawaan?`,
              description: "Semua perubahan pada peran ini dihapus dan kembali seperti pertama kali aplikasi dipakai.",
            })
          ) {
            run(() => resetRolePermissions(role), { successMessage: "Izin dikembalikan ke bawaan." });
          }
        }}
      >
        Kembalikan {ROLE_LABELS[role]} ke bawaan
      </Button>
    </div>
  );
}
