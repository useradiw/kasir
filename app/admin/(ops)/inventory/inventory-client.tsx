"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/components/admin/ui";
import { BentoCard, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  addCategory, updateCategory, deleteCategory,
  addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemVisibility,
  addVariant, updateVariant, deleteVariant,
  addPackage, updatePackage, deletePackage,
  addPackageItem, deletePackageItem,
  setOnlinePrice, deleteOnlinePrice,
} from "@/app/actions/admin/inventory";

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
  isOwner: boolean;
};

const TABS = [
  { key: "categories", label: "Kategori" },
  { key: "items", label: "Menu" },
  { key: "variants", label: "Varian" },
  { key: "packages", label: "Paket" },
  { key: "online", label: "Harga Online" },
  { key: "takeaway", label: "Bawa Pulang" },
];

const ONLINE_SERVICES = ["GoFood", "ShopeeFood", "GrabFood"] as const;
const TAKEAWAY_SERVICES = ["Take_Away"] as const;

const SERVICE_LABELS: Record<string, string> = {
  GoFood: "GoFood",
  ShopeeFood: "ShopeeFood",
  GrabFood: "GrabFood",
  Take_Away: "Bawa Pulang",
};

export default function InventoryClient({ tab, categories, menuItems, variants, packages, packageItems, onlinePrices, isOwner }: Props) {
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
    <>
      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            className="shrink-0"
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* ─── CATEGORIES ─── */}
      {tab === "categories" && (
        <BentoCard className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Kategori</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Batal" : "+ Tambah"}
            </Button>
          </div>

          {showAdd && (
            <form action={(fd) => run(async () => { await addCategory(fd); setShowAdd(false); })}
              className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
              <div className="grid gap-1"><Label>Nama</Label><Input name="name" required placeholder="Nama kategori" className="border-border bg-card-2" /></div>
              <div className="grid gap-1"><Label>Sort Order</Label><Input name="sortOrder" type="number" defaultValue={0} className="w-24 border-border bg-card-2" /></div>
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            </form>
          )}

          {categories.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] font-semibold text-muted-foreground">Belum ada kategori.</p>
          ) : (
            <div className="divide-y divide-border">
              {categories.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <span className="text-[13.5px] font-bold">{c.name}</span>
                      <span className="ml-2 text-[11.5px] text-muted-foreground tabular-nums">#{c.sortOrder}</span>
                    </div>
                    {isOwner && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditId(editId === c.id ? null : c.id)}>Edit</Button>
                        <Button size="sm" variant="destructive" disabled={isPending}
                          onClick={async () => { if (await confirm({ title: `Hapus kategori "${c.name}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deleteCategory(c.id)); }}>Hapus</Button>
                      </div>
                    )}
                  </div>
                  {isOwner && editId === c.id && (
                    <div className="mb-2 rounded-xl bg-card-2 px-3 py-3">
                      <form action={(fd) => run(async () => { await updateCategory(c.id, fd); setEditId(null); })}
                        className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={c.name} required className="border-border bg-card" /></div>
                        <div className="grid gap-1"><Label>Sort</Label><Input name="sortOrder" type="number" defaultValue={c.sortOrder} className="w-24 border-border bg-card" /></div>
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </BentoCard>
      )}

      {/* ─── MENU ITEMS ─── */}
      {tab === "items" && (
        <BentoCard className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Menu Items</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Batal" : "+ Tambah"}</Button>
          </div>

          {showAdd && (
            <form action={(fd) => run(async () => { await addMenuItem(fd); setShowAdd(false); })}
              className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
              <div className="grid gap-1"><Label>Nama</Label><Input name="name" required placeholder="Nama menu" className="border-border bg-card-2" /></div>
              <div className="grid gap-1">
                <Label>Kategori</Label>
                <AdminSelect name="categoryId" required className="border-border bg-card-2">
                  <option value="">Pilih kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </AdminSelect>
              </div>
              <div className="grid gap-1"><Label>Harga (Rp)</Label><Input name="price" type="number" min={0} required className="w-32 border-border bg-card-2" /></div>
              <input type="hidden" name="isHidden" value="false" />
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            </form>
          )}

          {menuItems.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] font-semibold text-muted-foreground">Belum ada menu item.</p>
          ) : (
            <div className="divide-y divide-border">
              {menuItems.map((m, idx) => (
                <div key={m.id}>
                  {(idx === 0 || menuItems[idx - 1].categoryName !== m.categoryName) && (
                    <p className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {m.categoryName}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold">{m.name}</p>
                      <p className="text-[11.5px] text-muted-foreground tabular-nums">{m.categoryName} · {formatRupiah(m.price)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {isOwner ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-auto rounded-full px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide",
                              !m.isHidden ? "bg-success-soft text-success hover:bg-success-soft" : "bg-card-2 text-muted-foreground border border-border",
                            )}
                            disabled={isPending}
                            onClick={() => run(() => toggleMenuItemVisibility(m.id, m.isHidden))}
                          >
                            {m.isHidden ? "Disembunyikan" : "Tampil"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditId(editId === m.id ? null : m.id)}>Edit</Button>
                          <Button size="sm" variant="destructive" disabled={isPending}
                            onClick={async () => { if (await confirm({ title: `Hapus "${m.name}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deleteMenuItem(m.id)); }}>Hapus</Button>
                        </>
                      ) : (
                        <Tag tone={m.isHidden ? "mut" : "ok"}>{m.isHidden ? "Disembunyikan" : "Tampil"}</Tag>
                      )}
                    </div>
                  </div>
                  {isOwner && editId === m.id && (
                    <div className="mb-2 rounded-xl bg-card-2 px-3 py-3">
                      <form action={(fd) => run(async () => { await updateMenuItem(m.id, fd); setEditId(null); })}
                        className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={m.name} required className="border-border bg-card" /></div>
                        <div className="grid gap-1">
                          <Label>Kategori</Label>
                          <AdminSelect name="categoryId" defaultValue={m.categoryId} className="border-border bg-card">
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </AdminSelect>
                        </div>
                        <div className="grid gap-1"><Label>Harga</Label><Input name="price" type="number" defaultValue={m.price} min={0} className="w-32 border-border bg-card" /></div>
                        <div className="grid gap-1">
                          <Label>Tampilkan?</Label>
                          <AdminSelect name="isHidden" defaultValue={m.isHidden ? "true" : "false"} className="border-border bg-card">
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
        </BentoCard>
      )}

      {/* ─── VARIANTS ─── */}
      {tab === "variants" && (
        <BentoCard className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Varian Menu</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Batal" : "+ Tambah"}</Button>
          </div>

          {showAdd && (
            <form action={(fd) => run(async () => { await addVariant(fd); setShowAdd(false); })}
              className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
              <div className="grid gap-1">
                <Label>Menu Item</Label>
                <AdminSelect name="menuItemId" required className="border-border bg-card-2">
                  <option value="">Pilih item</option>
                  {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </AdminSelect>
              </div>
              <div className="grid gap-1"><Label>Label</Label><Input name="label" required placeholder="Contoh: Porsi Besar" className="border-border bg-card-2" /></div>
              <div className="grid gap-1"><Label>Tambahan Harga (Rp)</Label><Input name="priceModifier" type="number" defaultValue={0} className="w-36 border-border bg-card-2" /></div>
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            </form>
          )}

          {variants.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] font-semibold text-muted-foreground">Belum ada varian.</p>
          ) : (
            <div className="divide-y divide-border">
              {variants.map((v, idx) => (
                <div key={v.id}>
                  {(idx === 0 || variants[idx - 1].menuItemName !== v.menuItemName) && (
                    <p className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {v.menuItemName}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold">{v.label}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        <span className="tabular-nums">{v.menuItemName} · {v.priceModifier >= 0 ? "+" : ""}{formatRupiah(v.priceModifier)}</span>
                      </p>
                    </div>
                    {isOwner && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditId(editId === v.id ? null : v.id)}>Edit</Button>
                        <Button size="sm" variant="destructive" disabled={isPending}
                          onClick={async () => { if (await confirm({ title: `Hapus varian "${v.label}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deleteVariant(v.id)); }}>Hapus</Button>
                      </div>
                    )}
                  </div>
                  {isOwner && editId === v.id && (
                    <div className="mb-2 rounded-xl bg-card-2 px-3 py-3">
                      <form action={(fd) => run(async () => { await updateVariant(v.id, fd); setEditId(null); })}
                        className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="menuItemId" value={v.menuItemId} />
                        <div className="grid gap-1"><Label>Label</Label><Input name="label" defaultValue={v.label} required className="border-border bg-card" /></div>
                        <div className="grid gap-1"><Label>+Harga</Label><Input name="priceModifier" type="number" defaultValue={v.priceModifier} className="w-36 border-border bg-card" /></div>
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </BentoCard>
      )}

      {/* ─── SERVICE-SPECIFIC PRICING (online vendors + bawa pulang) ─── */}
      {tab === "online" && (
        <ServicePricingCard
          title="Harga Online (GoFood, ShopeeFood, GrabFood)"
          description="Atur harga khusus untuk vendor online. Jika tidak diatur, harga default menu yang digunakan."
          services={ONLINE_SERVICES}
          menuItems={menuItems}
          variants={variants}
          onlinePrices={onlinePrices}
          isPending={isPending}
          run={run}
        />
      )}
      {tab === "takeaway" && (
        <ServicePricingCard
          title="Harga Bawa Pulang"
          description="Atur harga khusus untuk pesanan bawa pulang. Jika tidak diatur, harga default menu yang digunakan."
          services={TAKEAWAY_SERVICES}
          menuItems={menuItems}
          variants={variants}
          onlinePrices={onlinePrices}
          isPending={isPending}
          run={run}
        />
      )}

      {/* ─── PACKAGES ─── */}
      {tab === "packages" && (
        <BentoCard className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Paket Bundle</CardTitle>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Batal" : "+ Tambah"}</Button>
          </div>

          {showAdd && (
            <form action={(fd) => run(async () => { await addPackage(fd); setShowAdd(false); })}
              className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
              <div className="grid gap-1"><Label>Nama Paket</Label><Input name="name" required placeholder="Nama paket" className="border-border bg-card-2" /></div>
              <div className="grid gap-1"><Label>Harga Bundle (Rp)</Label><Input name="bundlePrice" type="number" min={0} required className="w-36 border-border bg-card-2" /></div>
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            </form>
          )}

          <div className="flex flex-col gap-3">
            {packages.map((pkg) => {
              const items = packageItems.filter((pi) => pi.packageId === pkg.id);
              const isExpanded = expandPackage === pkg.id;
              return (
                <div key={pkg.id} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center justify-between bg-card-2 px-4 py-2">
                    {isOwner && editId === pkg.id ? (
                      <form action={(fd) => run(async () => { await updatePackage(pkg.id, fd); setEditId(null); })}
                        className="mr-3 flex flex-1 flex-wrap items-end gap-3">
                        <div className="grid gap-1"><Label>Nama</Label><Input name="name" defaultValue={pkg.name} required className="border-border bg-card" /></div>
                        <div className="grid gap-1"><Label>Harga</Label><Input name="bundlePrice" type="number" defaultValue={pkg.bundlePrice} min={0} className="w-32 border-border bg-card" /></div>
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                      </form>
                    ) : (
                      <div>
                        <p className="text-[13.5px] font-bold">{pkg.name}</p>
                        <p className="text-[11.5px] text-muted-foreground tabular-nums">{formatRupiah(pkg.bundlePrice)}</p>
                      </div>
                    )}
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setExpandPackage(isExpanded ? null : pkg.id)}>
                        {isExpanded ? "Tutup" : `Item (${items.length})`}
                      </Button>
                      {isOwner && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditId(editId === pkg.id ? null : pkg.id)}>Edit</Button>
                          <Button size="sm" variant="destructive" disabled={isPending}
                            onClick={async () => { if (await confirm({ title: `Hapus paket "${pkg.name}"?`, destructive: true, confirmLabel: "Hapus" })) run(() => deletePackage(pkg.id)); }}>Hapus</Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-2 px-4 pb-3 pt-2">
                      {items.map((pi) => (
                        <div key={pi.id} className="flex items-center justify-between text-[12.5px] font-semibold">
                          <span>{pi.menuItemName}{pi.variantLabel ? ` (${pi.variantLabel})` : ""}</span>
                          {isOwner && (
                            <Button size="sm" variant="ghost" disabled={isPending}
                              onClick={() => run(() => deletePackageItem(pi.id))}>Hapus</Button>
                          )}
                        </div>
                      ))}
                      <form action={(fd) => run(() => addPackageItem(fd))}
                        className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
                        <input type="hidden" name="packageId" value={pkg.id} />
                        <div className="grid gap-1">
                          <Label className="text-xs">Tambah Item</Label>
                          <AdminSelect
                            name="menuItemId"
                            required
                            className="h-8 border-border bg-card px-2 text-xs"
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
                        <Button type="submit" size="sm" disabled={isPending}>+ Tambah</Button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
            {packages.length === 0 && <p className="py-4 text-center text-[12.5px] font-semibold text-muted-foreground">Belum ada paket.</p>}
          </div>
        </BentoCard>
      )}
    </>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[15px] font-bold">{children}</h2>;
}

function ServicePricingCard({
  title,
  description,
  services,
  menuItems,
  variants,
  onlinePrices,
  isPending,
  run,
}: {
  title: string;
  description: string;
  services: readonly string[];
  menuItems: MenuItem[];
  variants: Variant[];
  onlinePrices: OnlinePrice[];
  isPending: boolean;
  run: (fn: () => Promise<void>, opts?: { successMessage?: string }) => void;
}) {
  return (
    <BentoCard className="flex flex-col gap-4">
      <div>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">{description}</p>
      </div>
      {menuItems.filter((m) => !m.isHidden).map((m) => {
        const itemVariants = variants.filter((v) => v.menuItemId === m.id);
        const itemPrices = onlinePrices.filter((op) => op.menuItemId === m.id && !op.variantId);
        return (
          <div key={m.id} className="space-y-2 rounded-xl border border-border p-3">
            <div>
              <p className="text-[13.5px] font-bold">{m.name}</p>
              <p className="text-[11.5px] text-muted-foreground tabular-nums">Harga dasar: {formatRupiah(m.price)}</p>
            </div>
            <div className="flex flex-col gap-2">
              {services.map((svc) => {
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
            {itemVariants.map((v) => {
              const variantPrices = onlinePrices.filter((op) => op.menuItemId === m.id && op.variantId === v.id);
              return (
                <div key={v.id} className="ml-4 space-y-1 border-l-2 border-border pl-3">
                  <p className="text-[11.5px] font-bold tabular-nums">{v.label} ({v.priceModifier >= 0 ? "+" : ""}{formatRupiah(v.priceModifier)})</p>
                  <div className="flex flex-col gap-2">
                    {services.map((svc) => {
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
    </BentoCard>
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
      <Label className="w-24 shrink-0 text-xs text-muted-foreground">{SERVICE_LABELS[service] ?? service}</Label>
      <Input
        type="number"
        min={0}
        placeholder="Harga default"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 flex-1 border-border bg-card text-sm"
      />
      {hasChanged && value && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => run(() => setOnlinePrice({ menuItemId, variantId, service, price: parseInt(value) }))}
        >
          Simpan
        </Button>
      )}
      {priceId && (
        <Button
          size="sm"
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
