const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const PRINTER_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";
const CHUNK_SIZE = 512;
const CHUNK_DELAY = 50;

// ─── Module State ────────────────────────────────────────────────────────────

let device: BluetoothDevice | null = null;
let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
let connected = false;

type Listener = (connected: boolean) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn(connected));
}

function handleDisconnect() {
  connected = false;
  characteristic = null;
  notify();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isConnected(): boolean {
  return connected;
}

/**
 * Subscribe to connection changes. Returns an unsubscribe function.
 * Compatible with `useSyncExternalStore(subscribe, getSnapshot)`.
 */
export function onConnectionChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Opens the browser Bluetooth device picker, connects, and stores refs. */
export async function requestDevice(): Promise<void> {
  const dev = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [PRINTER_SERVICE_UUID],
  });

  dev.addEventListener("gattserverdisconnected", handleDisconnect);
  device = dev;

  await connectGATT();
}

/** Reconnects GATT using the stored device (no picker). */
export async function ensureConnected(): Promise<void> {
  if (connected && characteristic) return;
  if (!device) throw new Error("Belum ada printer. Hubungkan terlebih dahulu.");
  await connectGATT();
}

/** Writes data to the printer in chunks. */
export async function writeData(data: Uint8Array): Promise<void> {
  if (!characteristic) throw new Error("Printer tidak terhubung.");

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    await characteristic.writeValueWithoutResponse(chunk);
    if (offset + CHUNK_SIZE < data.length) {
      await new Promise((r) => setTimeout(r, CHUNK_DELAY));
    }
  }
}

/** Disconnects GATT cleanly. */
export function disconnect(): void {
  if (device?.gatt?.connected) device.gatt.disconnect();
  connected = false;
  characteristic = null;
  notify();
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function connectGATT(): Promise<void> {
  if (!device?.gatt) throw new Error("Perangkat Bluetooth tidak tersedia.");

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
  characteristic = await service.getCharacteristic(PRINTER_CHAR_UUID);
  connected = true;
  notify();
}
