import type { OrderItem, OrderItemStatus, ServiceEnum, MenuItem, MenuVariant } from "@/lib/db";

/** Sum price * qty for non-cancelled items. */
export function calcSubtotal(items: OrderItem[]): number {
  return items
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + i.price * i.qty, 0);
}

/** Final item price: base + variant modifier. */
export function calcItemPrice(item: MenuItem, variant?: MenuVariant | null): number {
  return item.price + (variant?.priceModifier ?? 0);
}

/** Total = subtotal + tax% + service% - discount. */
export function calcTotal(subtotal: number, taxPct: number, servicePct: number, discount: number = 0): number {
  return subtotal + calcTaxFromPct(subtotal, taxPct) + calcServiceFromPct(subtotal, servicePct) - discount;
}

/** Tax amount from percentage. */
export function calcTaxFromPct(subtotal: number, taxPct: number): number {
  return Math.round(subtotal * taxPct / 100);
}

/** Service charge from percentage. */
export function calcServiceFromPct(subtotal: number, servicePct: number): number {
  return Math.round(subtotal * servicePct / 100);
}

/** Flexible charge input (% or absolute). */
export interface ChargeInput {
  value: number;
  mode: "pct" | "abs";
}

/** Calculate absolute charge amount from either percentage or absolute input. */
export function calcChargeAmount(subtotal: number, input: ChargeInput): number {
  return input.mode === "pct" ? Math.round(subtotal * input.value / 100) : input.value;
}

/** Total with flexible charge inputs. */
export function calcTotalFlex(
  subtotal: number,
  tax: ChargeInput,
  service: ChargeInput,
  discount: ChargeInput,
): number {
  return subtotal + calcChargeAmount(subtotal, tax) + calcChargeAmount(subtotal, service) - calcChargeAmount(subtotal, discount);
}

/** Change = cash paid - total. */
export function calcChange(cashAmount: number, total: number): number {
  return cashAmount - total;
}

/** Human-readable service label. */
export function getServiceLabel(service: ServiceEnum | null): string {
  if (!service) return "Dine In";
  const labels: Record<ServiceEnum, string> = {
    GoFood: "GoFood",
    ShopeeFood: "ShopeeFood",
    GrabFood: "GrabFood",
    Take_Away: "Bawa Pulang",
    Unknown: "Lainnya",
  };
  return labels[service];
}

/** Tailwind classes for order item status badges. */
export function getStatusColor(status: OrderItemStatus): string {
  const colors: Record<OrderItemStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    PREPARING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    SERVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    CANCELLED: "bg-destructive/10 text-destructive",
  };
  return colors[status];
}

/** Tailwind classes for service type badges. */
export function getServiceColor(service: ServiceEnum | null): string {
  if (!service) return "bg-muted text-muted-foreground";
  const colors: Record<ServiceEnum, string> = {
    GoFood: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    ShopeeFood: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    GrabFood: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Take_Away: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Unknown: "bg-muted text-muted-foreground",
  };
  return colors[service];
}

/** Status label in Indonesian. */
export function getStatusLabel(status: OrderItemStatus): string {
  const labels: Record<OrderItemStatus, string> = {
    PENDING: "Menunggu",
    PREPARING: "Diproses",
    SERVED: "Disajikan",
    CANCELLED: "Dibatalkan",
  };
  return labels[status];
}
