"use client";

import { useState } from "react";
import { useOrderItems, useSessionSplitStatus, assignSplitGroup } from "@/hooks/use-session-store";
import { calcSubtotal } from "@/lib/kasir-utils";
import { formatRupiah } from "@/lib/format";
import { KasirTopBar, BottomBar } from "./ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users, Plus, Trash2, CheckCircle } from "lucide-react";
import type { OrderItem } from "@/lib/db";

const GROUP_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300",
  "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300",
];

export function SplitItemsScreen({
  sessionId,
  onBack,
  onStartPayment,
  onPaySingleGroup,
  onHome,
}: {
  sessionId: string;
  onBack: () => void;
  onStartPayment: (group: number, totalGroups: number) => void;
  onPaySingleGroup?: (group: number) => void;
  onHome?: () => void;
}) {
  const items = useOrderItems(sessionId);
  const activeItems = (items ?? []).filter((i) => i.status !== "CANCELLED");
  const { paidGroups } = useSessionSplitStatus(sessionId);

  const [groupCount, setGroupCount] = useState(2);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);

  function addGroup() {
    if (groupCount < 4) setGroupCount((n) => n + 1);
  }

  function removeGroup() {
    if (groupCount <= 2) return;
    const newCount = groupCount - 1;
    // Reassign items from the removed group to group 0 (unassigned)
    const toUnassign = activeItems.filter((i) => i.splitGroup === groupCount);
    Promise.all(toUnassign.map((i) => assignSplitGroup(i.id, 0)));
    setGroupCount(newCount);
    if (selectedGroup === groupCount) setSelectedGroup(1);
  }

  async function handleItemTap(item: OrderItem) {
    if (paidGroups.has(item.splitGroup) && item.splitGroup !== 0) return;
    if (paidGroups.has(selectedGroup)) return;
    const nextGroup = item.splitGroup === selectedGroup ? 0 : selectedGroup;
    await assignSplitGroup(item.id, nextGroup);
  }

  // Check all items are assigned
  const unassigned = activeItems.filter((i) => i.splitGroup === 0);
  const allAssigned = unassigned.length === 0 && activeItems.length > 0;

  // Per-group subtotals
  function groupSubtotal(group: number) {
    return calcSubtotal(activeItems.filter((i) => i.splitGroup === group));
  }

  return (
    <>
      <KasirTopBar title="Split Tagihan" onBack={onBack} onHome={onHome} />

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Group tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pilih orang, lalu ketuk item</p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={removeGroup} disabled={groupCount <= 2}>
                <Trash2 className="size-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={addGroup} disabled={groupCount >= 4}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${groupCount}, 1fr)` }}>
            {Array.from({ length: groupCount }, (_, i) => i + 1).map((g) => {
              const isPaid = paidGroups.has(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => !isPaid && setSelectedGroup(g)}
                  className={cn(
                    "rounded-lg border p-2 text-xs font-medium transition-colors",
                    isPaid
                      ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-300 opacity-70"
                      : selectedGroup === g
                        ? GROUP_COLORS[(g - 1) % GROUP_COLORS.length]
                        : "bg-card text-muted-foreground border-border"
                  )}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {isPaid ? <CheckCircle className="size-3" /> : <Users className="size-3" />}
                    <span>Orang {g}</span>
                  </div>
                  {isPaid ? (
                    <p className="font-bold text-green-600 dark:text-green-400">LUNAS</p>
                  ) : (
                    <p className="font-bold">{formatRupiah(groupSubtotal(g))}</p>
                  )}
                  <p className="text-[10px] opacity-70">
                    {activeItems.filter((i) => i.splitGroup === g).length} item
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Unassigned warning */}
        {unassigned.length > 0 && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            {unassigned.length} item belum ditugaskan — ketuk item untuk menugaskan ke orang yang dipilih
          </p>
        )}

        {/* Item list */}
        <div className="space-y-2">
          {activeItems.map((item) => {
            const itemGroup = item.splitGroup;
            const colorClass = itemGroup > 0 ? GROUP_COLORS[(itemGroup - 1) % GROUP_COLORS.length] : "";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemTap(item)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  itemGroup > 0 ? colorClass : "bg-card text-foreground border-border opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {item.qty}× {item.nameSnapshot}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatRupiah(item.price * item.qty)}</span>
                    {itemGroup > 0 && (
                      <span className="text-xs font-bold">O{itemGroup}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <BottomBar>
        <div className="w-full space-y-2">
          {/* Pay single group button */}
          {onPaySingleGroup && selectedGroup > 0 && !paidGroups.has(selectedGroup) && groupSubtotal(selectedGroup) > 0 && (
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => onPaySingleGroup(selectedGroup)}
            >
              Bayar Orang {selectedGroup} — {formatRupiah(groupSubtotal(selectedGroup))}
            </Button>
          )}
          {/* Pay all sequentially button */}
          {allAssigned ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                const firstUnpaid = Array.from({ length: groupCount }, (_, i) => i + 1).find((g) => !paidGroups.has(g));
                if (firstUnpaid) onStartPayment(firstUnpaid, groupCount);
              }}
              disabled={[...Array(groupCount)].every((_, i) => paidGroups.has(i + 1))}
            >
              Bayar Semua — Orang 1/{groupCount}
            </Button>
          ) : (
            <Button size="lg" className="w-full" disabled>
              Tugaskan semua item terlebih dahulu ({unassigned.length} belum)
            </Button>
          )}
        </div>
      </BottomBar>
    </>
  );
}
