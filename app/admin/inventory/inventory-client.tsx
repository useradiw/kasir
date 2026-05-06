"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner, StatusBadge } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import {
  addCategory, updateCategory, deleteCategory,
  addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemVisibility,
  addVariant, updateVariant, deleteVariant,
  addPackage, updatePackage, deletePackage,
  addPackageItem, deletePackageItem,
  setOnlinePrice, deleteOnlinePrice,
} from "@/app/actions/admin/inventory";
import RecipeTab from "./recipe-tab";
import type { RecipeData } from "@/app/actions/admin/queries";

type Category = { id: string; name: string; sortOrder: number; createdAt: string; updatedAt: string };
type MenuItem = { id: string; name: string; categoryId: string; categoryName: string; price: number; isHidden: boolean; createdAt: string; updatedAt: string };
type Variant = { id: string; menuItemId: string; menuItemName: string; label: string; priceModifier: number };
type Package = { id: string; name: string; bundlePrice: number; createdAt: string; updatedAt: string };
type PackageItem = { id: string; packageId: string; menuItemId: string; variantId: string | null; nameSnapshot: string; menuItemName: string; variantLabel: string | null };
type OnlinePrice = { id: string; menuItemId: string; variantId: string | null; service: string; price: number };

type Props = {
  tab: string;
  categories: Category[];
  menuItems: MenuItem[];
  variants: Variant[];
  packages: Package[];
  packageItems: PackageItem[];
  onlinePrices: OnlinePrice[];
  templates: RecipeData["templates"];
  recipes: RecipeData["recipes"];
  isOwner: boolean;
};

const TABS = [
  { key: "categories", label: "Kategori" },
  { key: "items", label: "Menu" },
  { key: "variants", label: "Varian" },
  { key: "packages", label: "Paket" },
  { key: "online", label: "Harga Online" },
  { key: "recipes", label: "Resep" },
];

const SERVICES = ["GoFood", "ShopeeFood", "GrabFood"] as const;

export default function InventoryClient({ tab, categories, menuItems, variants, packages, packageItems, onlinePrices, templates, recipes, isOwner }: Props) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const confirm = useConfirm();
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expandPackage, setExpandPackage] = useState<string | null>(null);

  function switchTab(t: string) {
    setEditId(null); setShowAdd(false); setError(null);
    router.push(`/admin/inventory?tab=${t}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventori Menu</h1>

      <ErrorBanner error={error} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-foreground/10 pb-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── CATEGORIES ─── */}
      {tab === "categories" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Kategori</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Batal" : "+ Tambah"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAdd && (
              <form action={(fd) => run(async () => { await addCategory(fd); setShowAdd(false); })}
                className="flex flex-wrap gap-3 items-end pb-3 border-b border-foreground/10">
                <div className="grid gap-1"><Label>Nama</Label><Input name="name" required placeholder="Nama kategori" /></div>
                <div className="grid gap-1"><Label>Sort Order</Label><Input name="sortOrder" type="number" defaultValue={0} className="w-24" /></div>
                <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
              </form>
            )}

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada kategori.</p>
            ) : (
              <div className="divide-y divide-foreground/5">
                {categories.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between py-2.5 gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">#{c.sortOrder}</span>
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="xs" variant="outline" onClick={() => setEditId(editId === c.id ? null : c.id)}>Edit</Button>
                          <Button size="xs" variant="destructive" disabled={isPending}
                            onClick={async () => { if (await confirm({ title: `Hapus kategori "${c.name}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deleteCategory(c.id)); }}>Hapus</Button>
                        </div>
                      )}
                    </div>
                    {isOwner && editId === c.id && (
                      <div className="bg-muted/30 rounded-lg px-3 py-3 mb-2">
                        <form action={(fd) => run(async () => { await updateCategory(c.id, fd); setEditId(null); })}
                          className="flex flex-wrap gap-3 items-end">
                          <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={c.name} required /></div>
                          <div className="grid gap-1"><Label>Sort</Label><Input name="sortOrder" type="number" defaultValue={c.sortOrder} className="w-24" /></div>
                          <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── MENU ITEMS ─── */}
      {tab === "items" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Menu Items</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Batal" : "+ Tambah"}</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAdd && (
              <form action={(fd) => run(async () => { await addMenuItem(fd); setShowAdd(false); })}
                className="flex flex-wrap gap-3 items-end pb-3 border-b border-foreground/10">
                <div className="grid gap-1"><Label>Nama</Label><Input name="name" required placeholder="Nama menu" /></div>
                <div className="grid gap-1">
                  <Label>Kategori</Label>
                  <AdminSelect name="categoryId" required>
                    <option value="">Pilih kategori</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </AdminSelect>
                </div>
                <div className="grid gap-1"><Label>Harga (Rp)</Label><Input name="price" type="number" min={0} required className="w-32" /></div>
                <input type="hidden" name="isHidden" value="false" />
                <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
              </form>
            )}

            {menuItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada menu item.</p>
            ) : (
              <div className="divide-y divide-foreground/5">
                {menuItems.map((m, idx) => (
                  <div key={m.id}>
                    {(idx === 0 || menuItems[idx - 1].categoryName !== m.categoryName) && (
                      <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.categoryName}
                      </p>
                    )}
                    <div className="flex items-start justify-between py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.categoryName} · {formatRupiah(m.price)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {isOwner ? (
                          <>
                            <StatusBadge
                              active={!m.isHidden}
                              activeLabel="Tampil"
                              inactiveLabel="Disembunyikan"
                              onClick={() => run(() => toggleMenuItemVisibility(m.id, m.isHidden))}
                              disabled={isPending}
                            />
                            <Button size="xs" variant="outline" onClick={() => setEditId(editId === m.id ? null : m.id)}>Edit</Button>
                            <Button size="xs" variant="destructive" disabled={isPending}
                              onClick={async () => { if (await confirm({ title: `Hapus "${m.name}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deleteMenuItem(m.id)); }}>Hapus</Button>
                          </>
                        ) : (
                          <StatusBadge active={!m.isHidden} activeLabel="Tampil" inactiveLabel="Disembunyikan" />
                        )}
                      </div>
                    </div>
                    {isOwner && editId === m.id && (
                      <div className="bg-muted/30 rounded-lg px-3 py-3 mb-2">
                        <form action={(fd) => run(async () => { await updateMenuItem(m.id, fd); setEditId(null); })}
                          className="flex flex-wrap gap-3 items-end">
                          <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={m.name} required /></div>
                          <div className="grid gap-1">
                            <Label>Kategori</Label>
                            <AdminSelect name="categoryId" defaultValue={m.categoryId}>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </AdminSelect>
                          </div>
                          <div className="grid gap-1"><Label>Harga</Label><Input name="price" type="number" defaultValue={m.price} min={0} className="w-32" /></div>
                          <div className="grid gap-1">
                            <Label>Tampilkan?</Label>
                            <AdminSelect name="isHidden" defaultValue={m.isHidden ? "true" : "false"}>
                              <option value="false">Ya</option>
                              <option value="true">Tidak</option>
                            </AdminSelect>
                          </div>
                          <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── VARIANTS ─── */}
      {tab === "variants" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Varian Menu</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Batal" : "+ Tambah"}</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAdd && (
              <form action={(fd) => run(async () => { await addVariant(fd); setShowAdd(false); })}
                className="flex flex-wrap gap-3 items-end pb-3 border-b border-foreground/10">
                <div className="grid gap-1">
                  <Label>Menu Item</Label>
                  <AdminSelect name="menuItemId" required>
                    <option value="">Pilih item</option>
                    {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </AdminSelect>
                </div>
                <div className="grid gap-1"><Label>Label</Label><Input name="label" required placeholder="Contoh: Porsi Besar" /></div>
                <div className="grid gap-1"><Label>Tambahan Harga (Rp)</Label><Input name="priceModifier" type="number" defaultValue={0} className="w-36" /></div>
                <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
              </form>
            )}

            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada varian.</p>
            ) : (
              <div className="divide-y divide-foreground/5">
                {variants.map((v, idx) => (
                  <div key={v.id}>
                    {(idx === 0 || variants[idx - 1].menuItemName !== v.menuItemName) && (
                      <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {v.menuItemName}
                      </p>
                    )}
                    <div className="flex items-start justify-between py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{v.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.menuItemName} · {v.priceModifier >= 0 ? "+" : ""}{formatRupiah(v.priceModifier)}
                        </p>
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="xs" variant="outline" onClick={() => setEditId(editId === v.id ? null : v.id)}>Edit</Button>
                          <Button size="xs" variant="destructive" disabled={isPending}
                            onClick={async () => { if (await confirm({ title: `Hapus varian "${v.label}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deleteVariant(v.id)); }}>Hapus</Button>
                        </div>
                      )}
                    </div>
                    {isOwner && editId === v.id && (
                      <div className="bg-muted/30 rounded-lg px-3 py-3 mb-2">
                        <form action={(fd) => run(async () => { await updateVariant(v.id, fd); setEditId(null); })}
                          className="flex flex-wrap gap-3 items-end">
                          <input type="hidden" name="menuItemId" value={v.menuItemId} />
                          <div className="grid gap-1"><Label>Label</Label><Input name="label" defaultValue={v.label} required /></div>
                          <div className="grid gap-1"><Label>+Harga</Label><Input name="priceModifier" type="number" defaultValue={v.priceModifier} className="w-36" /></div>
                          <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── ONLINE PRICING ─── */}
      {tab === "online" && (
        <Card>
          <CardHeader>
            <CardTitle>Harga Online (GoFood, ShopeeFood, GrabFood)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Atur harga khusus untuk vendor online. Jika tidak diatur, harga default menu yang digunakan.
            </p>
            {menuItems.filter((m) => !m.isHidden).map((m) => {
              const itemVariants = variants.filter((v) => v.menuItemId === m.id);
              const itemPrices = onlinePrices.filter((op) => op.menuItemId === m.id && !op.variantId);
              return (
                <div key={m.id} className="border border-foreground/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Harga dasar: {formatRupiah(m.price)}</p>
                    </div>
                  </div>
                  {/* Base item online prices */}
                  <div className="flex flex-col gap-2">
                    {SERVICES.map((svc) => {
                      const existing = itemPrices.find((p) => p.service === svc);
                      return (
                        <OnlinePriceInput
                          key={svc}
                          service={svc}
                          menuItemId={m.id}
                          variantId={null}
                          currentPrice={existing?.price ?? null}
                          priceId={existing?.id ?? null}
                          isPending={isPending}
                          run={run}
                        />
                      );
                    })}
                  </div>
                  {/* Variant online prices */}
                  {itemVariants.map((v) => {
                    const variantPrices = onlinePrices.filter((op) => op.menuItemId === m.id && op.variantId === v.id);
                    return (
                      <div key={v.id} className="ml-4 border-l-2 border-foreground/10 pl-3 space-y-1">
                        <p className="text-xs font-medium">{v.label} ({v.priceModifier >= 0 ? "+" : ""}{formatRupiah(v.priceModifier)})</p>
                        <div className="flex flex-col gap-2">
                          {SERVICES.map((svc) => {
                            const existing = variantPrices.find((p) => p.service === svc);
                            return (
                              <OnlinePriceInput
                                key={svc}
                                service={svc}
                                menuItemId={m.id}
                                variantId={v.id}
                                currentPrice={existing?.price ?? null}
                                priceId={existing?.id ?? null}
                                isPending={isPending}
                                run={run}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ─── PACKAGES ─── */}
      {tab === "packages" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Paket Bundle</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Batal" : "+ Tambah"}</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAdd && (
              <form action={(fd) => run(async () => { await addPackage(fd); setShowAdd(false); })}
                className="flex flex-wrap gap-3 items-end pb-3 border-b border-foreground/10">
                <div className="grid gap-1"><Label>Nama Paket</Label><Input name="name" required placeholder="Nama paket" /></div>
                <div className="grid gap-1"><Label>Harga Bundle (Rp)</Label><Input name="bundlePrice" type="number" min={0} required className="w-36" /></div>
                <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
              </form>
            )}
            <div className="space-y-3">
              {packages.map((pkg) => {
                const items = packageItems.filter((pi) => pi.packageId === pkg.id);
                const isExpanded = expandPackage === pkg.id;
                return (
                  <div key={pkg.id} className="border border-foreground/10 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                      {isOwner && editId === pkg.id ? (
                        <form action={(fd) => run(async () => { await updatePackage(pkg.id, fd); setEditId(null); })}
                          className="flex flex-wrap gap-3 items-end flex-1 mr-3">
                          <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={pkg.name} required /></div>
                          <div className="grid gap-1"><Label>Harga</Label><Input name="bundlePrice" type="number" defaultValue={pkg.bundlePrice} min={0} className="w-32" /></div>
                          <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                        </form>
                      ) : (
                        <div>
                          <p className="font-medium">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">{formatRupiah(pkg.bundlePrice)}</p>
                        </div>
                      )}
                      <div className="flex gap-1 shrink-0">
                        <Button size="xs" variant="outline" onClick={() => setExpandPackage(isExpanded ? null : pkg.id)}>
                          {isExpanded ? "Tutup" : `Item (${items.length})`}
                        </Button>
                        {isOwner && (
                          <>
                            <Button size="xs" variant="outline" onClick={() => setEditId(editId === pkg.id ? null : pkg.id)}>Edit</Button>
                            <Button size="xs" variant="destructive" disabled={isPending}
                              onClick={async () => { if (await confirm({ title: `Hapus paket "${pkg.name}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deletePackage(pkg.id)); }}>Hapus</Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-2 space-y-2">
                        {items.map((pi) => (
                          <div key={pi.id} className="flex items-center justify-between text-sm">
                            <span>{pi.menuItemName}{pi.variantLabel ? ` (${pi.variantLabel})` : ""}</span>
                            {isOwner && (
                              <Button size="xs" variant="ghost" disabled={isPending}
                                onClick={() => run(() => deletePackageItem(pi.id))}>Hapus</Button>
                            )}
                          </div>
                        ))}
                        <form action={(fd) => run(() => addPackageItem(fd))}
                          className="flex flex-wrap gap-2 items-end pt-2 border-t border-foreground/10">
                          <input type="hidden" name="packageId" value={pkg.id} />
                          <div className="grid gap-1">
                            <Label className="text-xs">Tambah Item</Label>
                            <AdminSelect
                              name="menuItemId"
                              required
                              className="h-8 px-2 text-xs"
                              onChange={(e) => {
                                const form = e.target.closest("form")!;
                                const nameInput = form.querySelector<HTMLInputElement>("[name=nameSnapshot]")!;
                                nameInput.value = e.target.options[e.target.selectedIndex].text;
                              }}
                            >
                              <option value="">Pilih item</option>
                              {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </AdminSelect>
                          </div>
                          <input type="hidden" name="nameSnapshot" />
                          <Button type="submit" size="xs" disabled={isPending}>+ Tambah</Button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
              {packages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada paket.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── RECIPES ─── */}
      {tab === "recipes" && (
        <RecipeTab
          templates={templates}
          recipes={recipes}
          menuItems={menuItems}
          variants={variants}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}

function OnlinePriceInput({
  service,
  menuItemId,
  variantId,
  currentPrice,
  priceId,
  isPending,
  run,
}: {
  service: string;
  menuItemId: string;
  variantId: string | null;
  currentPrice: number | null;
  priceId: string | null;
  isPending: boolean;
  run: (fn: () => Promise<void>, opts?: { successMessage?: string }) => void;
}) {
  const [value, setValue] = useState(currentPrice?.toString() ?? "");
  const hasChanged = currentPrice !== null ? value !== currentPrice.toString() : value !== "";

  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs w-24 shrink-0 text-muted-foreground">{service}</Label>
      <Input
        type="number"
        min={0}
        placeholder="Harga default"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm flex-1"
      />
      {hasChanged && value && (
        <Button
          size="xs"
          disabled={isPending}
          onClick={() => run(() => setOnlinePrice({ menuItemId, variantId, service, price: parseInt(value) }))}
        >
          Simpan
        </Button>
      )}
      {priceId && (
        <Button
          size="xs"
          variant="ghost"
          disabled={isPending}
          onClick={() => { run(() => deleteOnlinePrice(priceId)); setValue(""); }}
        >
          Hapus
        </Button>
      )}
    </div>
  );
}
