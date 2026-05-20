"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { revalidateSuppliers } from "@/lib/revalidate";

const supplierSchema = z.object({
  name:  z.string().min(1, "Nama supplier tidak boleh kosong"),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function getSuppliers() {
  await requireRole("OWNER", "MANAGER");
  return prisma.supplier.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, phone: true },
  });
}

export async function addSupplier(data: { name: string; phone?: string; notes?: string }) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = supplierSchema.parse(data);
    await prisma.supplier.create({
      data: { name: parsed.name, phone: parsed.phone || null, notes: parsed.notes || null },
    });
    revalidateSuppliers();
  });
}

export async function updateSupplier(id: string, data: { name: string; phone?: string; notes?: string }) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = supplierSchema.parse(data);
    await prisma.supplier.update({
      where: { id },
      data:  { name: parsed.name, phone: parsed.phone || null, notes: parsed.notes || null },
    });
    revalidateSuppliers();
  });
}

export async function deleteSupplier(id: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    revalidateSuppliers();
  });
}
