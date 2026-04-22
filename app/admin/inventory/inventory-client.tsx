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
} from "@/app/actions/admin/inventory";

type Category = { id: string; name: string; sortOrder: number; createdAt: string; updatedAt: string };
type MenuItem = { id: string; name: string; categoryId: string; categoryName: string; price: number; isHidden: boolean; createdAt: string; updatedAt: string };
type Variant = { id: string; menuItemId: string; menuItemName: string; label: string; priceModifier: number };
type Package = { id: string; name: string; bundlePrice: number; createdAt: string; updatedAt: string };
type PackageItem = { id: string; packageId: string; menuItemId: string; variantId: string | null; nameSnapshot: string; menuItemName: string; variantLabel: string | null };

type Props = {
  tab: string;
  categories: Category[];
  menuItems: MenuItem[];
  variants: Variant[];
  packages: Package[];
  packageItems: PackageItem[];
  isOwner: boolean;
};

const TABS = [
  { key: "categories", label: "Kategori" },
  { key: "items", label: "Menu" },
  { key: "variants", label: "Varian" },
  { key: "packages", label: "Paket" },
];

export default function InventoryClient({ tab, categories, menuItems, variants, packages, packageItems, isOwner }: Props) {
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
    </div>
  );
}
