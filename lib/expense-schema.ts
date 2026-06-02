import { z } from "zod";

export const expenseItemSchema = z.object({
  description:  z.string().min(1, "Deskripsi item harus diisi"),
  amount:       z.coerce.number().min(0.001, "Jumlah harus lebih dari 0"),
  cost:         z.coerce.number().int().min(0, "Biaya tidak boleh negatif"),
  unit:         z.string().optional(),
  total:        z.coerce.number().int().min(0).optional(),
  templateId:   z.string().nullable().optional(),
  ingredientId: z.string().nullable().optional(),
});

export const expenseSchema = z.object({
  description:      z.string().optional(),
  supplierId:       z.string().nullable().optional(),
  deductFromCash:   z.boolean().optional(),
  countToKasPakHar: z.boolean().optional(),
  items:            z.array(expenseItemSchema).min(1, "Minimal 1 item pengeluaran"),
});

export type ExpenseData = z.input<typeof expenseSchema>;
