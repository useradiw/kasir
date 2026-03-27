"use client";

import { useState, useEffect, useCallback } from "react";
import { Container } from "@/components/shared/container";
import { useStaffId, useProductSyncQuery } from "@/hooks/use-kasir-query";
import { retryUnsyncedTransactions } from "@/hooks/use-session-store";
import { Loader2 } from "lucide-react";
import { SessionList } from "./session-list";
import { MenuBrowser } from "./menu-browser";
import { OrderReview } from "./order-review";
import { PaymentScreen } from "./payment-screen";

type View = "sessions" | "menu" | "review" | "payment" | "history-review";

export function KasirShell() {
  const [view, setView] = useState<View>("sessions");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const staff = useStaffId();
  const sync = useProductSyncQuery();

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

  // Loading state
  if (staff.isLoading || sync.isLoading) {
    return (
      <Container id="kasir" maxWidth="max-w-4xl" className="flex h-screen items-center justify-center">
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
  if (staff.isError || sync.isError) {
    return (
      <Container id="kasir" maxWidth="max-w-4xl" className="flex h-screen items-center justify-center">
        <div className="text-center text-sm text-destructive">
          <p>Gagal memuat data.</p>
          <p className="mt-1 text-muted-foreground">
            {staff.error?.message || sync.error?.message}
          </p>
        </div>
      </Container>
    );
  }

  const staffData = staff.data!;

  return (
    <Container id="kasir" sectionStyle="min-h-screen flex flex-col" maxWidth="max-w-4xl" className="!py-0 !px-0 flex flex-col flex-1">
      {view === "sessions" && (
        <SessionList
          staffId={staffData.staffId}
          staffName={staffData.staffName}
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
          onHome={goToSessions}
        />
      )}
      {view === "payment" && activeSessionId && (
        <PaymentScreen
          sessionId={activeSessionId}
          staffId={staffData.staffId}
          staffRole={staffData.staffRole}
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
  );
}
