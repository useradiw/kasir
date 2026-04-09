export type ExpenseItemData = { amount: number; cost: number };

export function computeExpenseTotal(items: ExpenseItemData[]): number {
  return items.reduce((sum, item) => sum + item.amount * item.cost, 0);
}
