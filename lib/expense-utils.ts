export type ExpenseItemData = { amount: number; cost: number; total?: number | null };

export function computeExpenseTotal(items: ExpenseItemData[]): number {
  return items.reduce((sum, item) => sum + (item.total ?? Math.round(item.amount * item.cost)), 0);
}
