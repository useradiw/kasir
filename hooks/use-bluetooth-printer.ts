"use client";

import { useSyncExternalStore, useCallback, useState } from "react";
import * as printer from "@/lib/bluetooth-printer";

export function useBluetoothPrinter() {
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const isConnected = useSyncExternalStore(
    printer.onConnectionChange,
    printer.isConnected,
    () => false
  );

  const isSupported =
    typeof navigator !== "undefined" && "bluetooth" in navigator;

  const connect = useCallback(async () => {
    setError(null);
    try {
      await printer.requestDevice();
    } catch (e) {
      // User cancelled the device picker — not an error
      if (e instanceof DOMException && e.name === "NotFoundError") return;
      setError(
        e instanceof Error ? e.message : "Gagal menghubungkan printer"
      );
    }
  }, []);

  const print = useCallback(async (data: Uint8Array) => {
    setError(null);
    setPrinting(true);
    try {
      await printer.ensureConnected();
      await printer.writeData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencetak");
    } finally {
      setPrinting(false);
    }
  }, []);

  const disconnectPrinter = useCallback(() => {
    printer.disconnect();
  }, []);

  return {
    isConnected,
    isSupported,
    connect,
    print,
    disconnect: disconnectPrinter,
    printing,
    error,
  };
}
