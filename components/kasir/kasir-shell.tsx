"use client";

import { useState, useEffect, useCallback } from "react";
import { Container } from "@/components/shared/container";
import { useStaffId, useProductSyncQuery, useStoreConfig } from "@/hooks/use-kasir-query";
import { retryUnsyncedTransactions } from "@/hooks/use-session-store";
import { Loader2 } from "lucide-react";
import { KasirProvider, type KasirContextValue } from "./kasir-context";
import { SessionList } from "./session-list";
import { MenuBrowser } from "./menu-browser";
import { OrderReview } from "./order-review";
import { PaymentScreen } from "./payment-screen";
import { SplitItemsScreen } from "./split-items-screen";

type View = "sessions" | "menu" | "review" | "split-items" | "split-payment" | "payment" | "history-review";

export function KasirShell() {
  const [view, setView] = useState<View>("sessions");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // For split-by-items: which group is currently being paid (1-based)
  const [splitPayingGroup, setSplitPayingGroup] = useState<number>(1);
  const [splitTotalGroups, setSplitTotalGroups] = useState<number>(1);

  const staff = useStaffId();
  const sync = useProductSyncQuery();
  const config = useStoreConfig();

  // Retry unsynced transactions on mount
  useEffect(() => {
    retryUnsyncedTransactions();
  }, []);

  const openSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("menu");
  }, []);

  const openPaidSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("history-review");
  }, []);

  const goToSessions = useCallback(() => {
    setActiveSessionId(null);
    setView("sessions");
  }, []);

  const goToMenu = useCallback(() => setView("menu"), []);
  const goToReview = useCallback(() => setView("review"), []);
  const goToPayment = useCallback(() => setView("payment"), []);
  const goToSplitItems = useCallback(() => setView("split-items"), []);

  const startSplitPayment = useCallback((group: number, totalGroups: number) => {
    setSplitPayingGroup(group);
    setSplitTotalGroups(totalGroups);
    setView("split-payment");
  }, []);

  const startSingleGroupPayment = useCallback((group: number) => {
    setSplitPayingGroup(group);
    setSplitTotalGroups(0);
    setView("split-payment");
  }, []);

  // Loading state
  if (staff.isLoading || sync.isLoading || config.isLoading) {
    return (
      <Container id="kasir" className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">
            {staff.isLoading ? "Memuat data staff..." : "Sinkronisasi produk..."}
          </p>
        </div>
      </Container>
    );
  }

  // Error state
  if (staff.isError || sync.isError || config.isError) {
    return (
      <Container id="kasir" className="flex h-screen items-center justify-center">
        <div className="text-center text-sm text-destructive">
          <p>Gagal memuat data.</p>
          <p className="mt-1 text-muted-foreground">
            {staff.error?.message || sync.error?.message || config.error?.message}
          </p>
        </div>
      </Container>
    );
  }

  const staffData = staff.data!;
  const storeConfig = config.data!;

  const kasirCtx: KasirContextValue = {
    staffId: staffData.staffId,
    staffName: staffData.staffName,
    staffRole: staffData.staffRole,
    storeInfo: storeConfig.storeInfo,
    defaultTaxPct: storeConfig.defaultTaxPct,
    defaultServicePct: storeConfig.defaultServicePct,
  };

  return (
    <KasirProvider value={kasirCtx}>
      <Container id="kasir" sectionStyle="min-h-screen flex flex-col" className="flex flex-col flex-1">
        {view === "sessions" && (
          <SessionList
            onOpenSession={openSession}
            onOpenPaidSession={openPaidSession}
          />
        )}
        {view === "menu" && activeSessionId && (
          <MenuBrowser
            sessionId={activeSessionId}
            onBack={goToSessions}
            onReview={goToReview}
            onHome={goToSessions}
          />
        )}
        {view === "review" && activeSessionId && (
          <OrderReview
            sessionId={activeSessionId}
            onBack={goToMenu}
            onPay={goToPayment}
            onSplitItems={goToSplitItems}
            onHome={goToSessions}
          />
        )}
        {view === "split-items" && activeSessionId && (
          <SplitItemsScreen
            sessionId={activeSessionId}
            onBack={goToReview}
            onStartPayment={startSplitPayment}
            onPaySingleGroup={startSingleGroupPayment}
            onHome={goToSessions}
          />
        )}
        {view === "split-payment" && activeSessionId && (
          <PaymentScreen
            key={`split-${splitPayingGroup}`}
            sessionId={activeSessionId}
            splitGroup={splitPayingGroup}
            splitTotalGroups={splitTotalGroups}
            onDone={() => {
              if (splitTotalGroups === 0) {
                setView("split-items");
              } else if (splitPayingGroup < splitTotalGroups) {
                startSplitPayment(splitPayingGroup + 1, splitTotalGroups);
              } else {
                goToSessions();
              }
            }}
            onBack={() => setView("split-items")}
            onHome={goToSessions}
          />
        )}
        {view === "payment" && activeSessionId && (
          <PaymentScreen
            sessionId={activeSessionId}
            onDone={goToSessions}
            onBack={goToReview}
            onHome={goToSessions}
          />
        )}
        {view === "history-review" && activeSessionId && (
          <OrderReview
            sessionId={activeSessionId}
            onBack={goToSessions}
            onHome={goToSessions}
            readOnly
          />
        )}
      </Container>
    </KasirProvider>
  );
}
