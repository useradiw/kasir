"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";

// ─── Category ─────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  sortOrder: z.coerce.number().int().default(0),
});

export async function addCategory(formData: FormData) {
  await requireRole("OWNER", "MANAGER");
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors[0]);
  await prisma.category.create({ data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function updateCategory(id: string, formData: FormData) {
  await requireOwner();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors[0]);
  await prisma.category.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function deleteCategory(id: string) {
  await requireOwner();
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/inventory");
}

// ─── MenuItem ─────────────────────────────────────────────────────────────────

const menuItemSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  categoryId: z.string().min(1, "Kategori harus dipilih"),
  price: z.coerce.number().int().min(0),
  isHidden: z.coerce.boolean().default(false),
});

export async function addMenuItem(formData: FormData) {
  await requireRole("OWNER", "MANAGER");
  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    price: formData.get("price"),
    isHidden: formData.get("isHidden") === "true",
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);
  await prisma.menuItem.create({ data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function updateMenuItem(id: string, formData: FormData) {
  await requireOwner();
  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    price: formData.get("price"),
    isHidden: formData.get("isHidden") === "true",
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);
  await prisma.menuItem.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function deleteMenuItem(id: string) {
  await requireOwner();
  await prisma.menuItem.delete({ where: { id } });
  revalidatePath("/admin/inventory");
}

export async function toggleMenuItemVisibility(id: string, current: boolean) {
  await requireOwner();
  await prisma.menuItem.update({ where: { id }, data: { isHidden: !current } });
  revalidatePath("/admin/inventory");
}

// ─── MenuVariant ──────────────────────────────────────────────────────────────

const variantSchema = z.object({
  menuItemId: z.string().min(1),
  label: z.string().min(1, "Label tidak boleh kosong"),
  priceModifier: z.coerce.number().int().default(0),
});

export async function addVariant(formData: FormData) {
  await requireOwner();
  const parsed = variantSchema.safeParse({
    menuItemId: formData.get("menuItemId"),
    label: formData.get("label"),
    priceModifier: formData.get("priceModifier") || 0,
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);
  await prisma.menuVariant.create({ data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function updateVariant(id: string, formData: FormData) {
  await requireOwner();
  const parsed = variantSchema.safeParse({
    menuItemId: formData.get("menuItemId"),
    label: formData.get("label"),
    priceModifier: formData.get("priceModifier") || 0,
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);
  await prisma.menuVariant.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function deleteVariant(id: string) {
  await requireOwner();
  await prisma.menuVariant.delete({ where: { id } });
  revalidatePath("/admin/inventory");
}

// ─── Package ──────────────────────────────────────────────────────────────────

const packageSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  bundlePrice: z.coerce.number().int().min(0),
});

export async function addPackage(formData: FormData) {
  await requireOwner();
  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    bundlePrice: formData.get("bundlePrice"),
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);
  await prisma.package.create({ data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function updatePackage(id: string, formData: FormData) {
  await requireOwner();
  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    bundlePrice: formData.get("bundlePrice"),
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);
  await prisma.package.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/inventory");
}

export async function deletePackage(id: string) {
  await requireOwner();
  await prisma.package.delete({ where: { id } });
  revalidatePath("/admin/inventory");
}

export async function addPackageItem(formData: FormData) {
  await requireOwner();
  const packageId = formData.get("packageId") as string;
  const menuItemId = formData.get("menuItemId") as string;
  const variantId = (formData.get("variantId") as string) || null;
  const nameSnapshot = formData.get("nameSnapshot") as string;

  if (!packageId || !menuItemId || !nameSnapshot) {
    throw new Error("Data tidak lengkap.");
  }

  // Find existing by compound unique, then create or update
  const existing = await prisma.packageItem.findFirst({
    where: { packageId, menuItemId, variantId },
  });

  if (existing) {
    await prisma.packageItem.update({
      where: { id: existing.id },
      data: { nameSnapshot },
    });
  } else {
    await prisma.packageItem.create({
      data: { packageId, menuItemId, variantId, nameSnapshot },
    });
  }
  revalidatePath("/admin/inventory");
}

export async function deletePackageItem(id: string) {
  await requireOwner();
  await prisma.packageItem.delete({ where: { id } });
  revalidatePath("/admin/inventory");
}
