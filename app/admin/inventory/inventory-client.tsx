"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner, StatusBadge, TableEmptyRow } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
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
type PackageItem = { packageId: string; menuItemId: string; variantId: string | null; nameSnapshot: string; menuItemName: string; variantLabel: string | null };

type Props = {
  tab: string;
  categories: Category[];
  menuItems: MenuItem[];
  variants: Variant[];
  packages: Package[];
  packageItems: PackageItem[];
};

const TABS = [
  { key: "categories", label: "Kategori" },
  { key: "items", label: "Menu" },
  { key: "variants", label: "Varian" },
  { key: "packages", label: "Paket" },
];

export default function InventoryClient({ tab, categories, menuItems, variants, packages, packageItems }: Props) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
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
            <table className="w-full text-sm">
              <thead><tr className="border-b border-foreground/10 text-left text-muted-foreground">
                <th className="pb-2 font-medium">Nama</th><th className="pb-2 font-medium">Sort</th><th className="pb-2 font-medium">Aksi</th>
              </tr></thead>
              <tbody>
                {categories.map((c) => (
                  <>
                    <tr key={c.id} className="border-b border-foreground/5">
                      <td className="py-2">{c.name}</td>
                      <td className="py-2 text-muted-foreground">{c.sortOrder}</td>
                      <td className="py-2 flex gap-1">
                        <Button size="xs" variant="outline" onClick={() => setEditId(editId === c.id ? null : c.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={() => { if (confirm(`Hapus kategori "${c.name}"?`)) run(() => deleteCategory(c.id)); }}>Hapus</Button>
                      </td>
                    </tr>
                    {editId === c.id && (
                      <tr key={`e-${c.id}`} className="bg-muted/30">
                        <td colSpan={3} className="px-2 py-3">
                          <form action={(fd) => run(async () => { await updateCategory(c.id, fd); setEditId(null); })}
                            className="flex flex-wrap gap-3 items-end">
                            <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={c.name} required /></div>
                            <div className="grid gap-1"><Label>Sort</Label><Input name="sortOrder" type="number" defaultValue={c.sortOrder} className="w-24" /></div>
                            <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {categories.length === 0 && <TableEmptyRow colSpan={3} message="Belum ada kategori." />}
              </tbody>
            </table>
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
            <table className="w-full text-sm">
              <thead><tr className="border-b border-foreground/10 text-left text-muted-foreground">
                <th className="pb-2 font-medium">Nama</th><th className="pb-2 font-medium">Kategori</th>
                <th className="pb-2 font-medium">Harga</th><th className="pb-2 font-medium">Tampil</th><th className="pb-2 font-medium">Aksi</th>
              </tr></thead>
              <tbody>
                {menuItems.map((m) => (
                  <>
                    <tr key={m.id} className="border-b border-foreground/5">
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2 text-muted-foreground text-xs">{m.categoryName}</td>
                      <td className="py-2">{formatRupiah(m.price)}</td>
                      <td className="py-2">
                        <StatusBadge
                          active={!m.isHidden}
                          activeLabel="Tampil"
                          inactiveLabel="Disembunyikan"
                          onClick={() => run(() => toggleMenuItemVisibility(m.id, m.isHidden))}
                          disabled={isPending}
                        />
                      </td>
                      <td className="py-2 flex gap-1">
                        <Button size="xs" variant="outline" onClick={() => setEditId(editId === m.id ? null : m.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={() => { if (confirm(`Hapus "${m.name}"?`)) run(() => deleteMenuItem(m.id)); }}>Hapus</Button>
                      </td>
                    </tr>
                    {editId === m.id && (
                      <tr key={`e-${m.id}`} className="bg-muted/30">
                        <td colSpan={5} className="px-2 py-3">
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
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {menuItems.length === 0 && <TableEmptyRow colSpan={5} message="Belum ada menu item." />}
              </tbody>
            </table>
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
            <table className="w-full text-sm">
              <thead><tr className="border-b border-foreground/10 text-left text-muted-foreground">
                <th className="pb-2 font-medium">Menu Item</th><th className="pb-2 font-medium">Label</th>
                <th className="pb-2 font-medium">+Harga</th><th className="pb-2 font-medium">Aksi</th>
              </tr></thead>
              <tbody>
                {variants.map((v) => (
                  <>
                    <tr key={v.id} className="border-b border-foreground/5">
                      <td className="py-2 text-muted-foreground text-xs">{v.menuItemName}</td>
                      <td className="py-2 font-medium">{v.label}</td>
                      <td className="py-2">{v.priceModifier >= 0 ? "+" : ""}{formatRupiah(v.priceModifier)}</td>
                      <td className="py-2 flex gap-1">
                        <Button size="xs" variant="outline" onClick={() => setEditId(editId === v.id ? null : v.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={() => { if (confirm(`Hapus varian "${v.label}"?`)) run(() => deleteVariant(v.id)); }}>Hapus</Button>
                      </td>
                    </tr>
                    {editId === v.id && (
                      <tr key={`e-${v.id}`} className="bg-muted/30">
                        <td colSpan={4} className="px-2 py-3">
                          <form action={(fd) => run(async () => { await updateVariant(v.id, fd); setEditId(null); })}
                            className="flex flex-wrap gap-3 items-end">
                            <input type="hidden" name="menuItemId" value={v.menuItemId} />
                            <div className="grid gap-1"><Label>Label</Label><Input name="label" defaultValue={v.label} required /></div>
                            <div className="grid gap-1"><Label>+Harga</Label><Input name="priceModifier" type="number" defaultValue={v.priceModifier} className="w-36" /></div>
                            <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {variants.length === 0 && <TableEmptyRow colSpan={4} message="Belum ada varian." />}
              </tbody>
            </table>
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
                      {editId === pkg.id ? (
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
                        <Button size="xs" variant="outline" onClick={() => setEditId(editId === pkg.id ? null : pkg.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={() => { if (confirm(`Hapus paket "${pkg.name}"?`)) run(() => deletePackage(pkg.id)); }}>Hapus</Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-2 space-y-2">
                        {items.map((pi) => (
                          <div key={`${pi.packageId}-${pi.menuItemId}`} className="flex items-center justify-between text-sm">
                            <span>{pi.menuItemName}{pi.variantLabel ? ` (${pi.variantLabel})` : ""}</span>
                            <Button size="xs" variant="ghost" disabled={isPending}
                              onClick={() => run(() => deletePackageItem(pi.packageId, pi.menuItemId))}>Hapus</Button>
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
