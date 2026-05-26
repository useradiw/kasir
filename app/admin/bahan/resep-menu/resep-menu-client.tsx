"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader, AdminSelect, ErrorBanner, UnitClassBadge } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah, formatRpPerUnit } from "@/lib/format";
import {
  upsertRecipe,
  deleteRecipe,
  addRecipeIngredient,
  addRecipeIngredientsBulk,
  updateRecipeIngredient,
  deleteRecipeIngredient,
} from "@/app/actions/admin/recipes";
import type { RecipeData } from "@/app/actions/admin/queries";

type IngredientOption = RecipeData["ingredients"][number];
type Recipe           = RecipeData["recipes"][number];
type RecipeIng        = Recipe["ingredients"][number];

type MenuItem = { id: string; name: string; categoryId: string; categoryName: string; price: number; isHidden: boolean; createdAt: string; updatedAt: string };
type Variant  = { id: string; menuItemId: string; menuItemName: string; label: string; priceModifier: number };

type Props = {
  ingredients: IngredientOption[];
  recipes:     Recipe[];
  menuItems:   MenuItem[];
  variants:    Variant[];
  isOwner:     boolean;
};

function ingDisplayName(ing: RecipeIng): string {
  return ing.ingredientName ?? ing.customName ?? "—";
}
function ingUnit(ing: RecipeIng): string {
  return ing.ingredientUnit ?? ing.customUnit ?? "";
}

// ─── Fuzzy match helper ──────────────────────────────────────────────────────
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function findIngredient(q: string, opts: IngredientOption[]): IngredientOption | null {
  const n = normName(q);
  if (!n) return null;
  // exact
  const exact = opts.find((o) => normName(o.name) === n);
  if (exact) return exact;
  // starts-with
  const starts = opts.find((o) => normName(o.name).startsWith(n));
  if (starts) return starts;
  // contains (in either direction)
  const contains = opts.find((o) => normName(o.name).includes(n) || n.includes(normName(o.name)));
  return contains ?? null;
}

export default function ResepMenuClient({ ingredients, recipes, menuItems, variants, isOwner }: Props) {
  const { isPending, run, error, setError } = useAdminAction();
  const confirm = useConfirm();
  const [view, setView] = useState<"list" | "add">("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editIngId, setEditIngId] = useState<string | null>(null);

  const [newMenuItemId, setNewMenuItemId] = useState("");
  const [newVariantId,  setNewVariantId]  = useState("");

  const [showAddIng, setShowAddIng] = useState<string | null>(null);
  const [ingType, setIngType] = useState<"ingredient" | "custom">("ingredient");

  function variantsForItem(menuItemId: string) {
    return variants.filter((v) => v.menuItemId === menuItemId);
  }
  function hasRecipe(menuItemId: string, variantId: string | null) {
    return recipes.some((r) => r.menuItemId === menuItemId && r.variantId === (variantId || null));
  }
  async function handleCreateRecipe() {
    if (!newMenuItemId) { setError("Pilih menu item terlebih dahulu."); return; }
    const vid = newVariantId || null;
    const fd = new FormData();
    await run(async () => {
      await upsertRecipe(newMenuItemId, vid, fd);
      setView("list");
      setNewMenuItemId(""); setNewVariantId("");
    }, { successMessage: "Resep berhasil dibuat." });
  }

  const byItem = menuItems
    .map((item) => ({ item, recipes: recipes.filter((r) => r.menuItemId === item.id) }))
    .filter((g) => g.recipes.length > 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Resep Menu" />
      <p className="text-sm text-muted-foreground">
        Komposisi bahan untuk setiap menu / varian. Bisa diisi cepat dengan
        <strong> tempel banyak baris</strong> (satu bahan per baris, format:{" "}
        <code className="bg-muted px-1 rounded">nama bahan, jumlah</code>).
        HPP dihitung dari rata-rata harga beli (WMA) tiap bahan.
      </p>

      <div className="flex items-center gap-3">
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => { setView("list"); setError(null); }}>
            Daftar Resep
          </Button>
          <Button size="sm" variant={view === "add" ? "default" : "outline"} onClick={() => { setView("add"); setError(null); }}>
            + Buat Resep
          </Button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {view === "add" && (
        <Card>
          <CardHeader><CardTitle>Buat Resep Baru</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Menu Item</Label>
              <AdminSelect value={newMenuItemId}
                onChange={(e) => { setNewMenuItemId(e.target.value); setNewVariantId(""); }}>
                <option value="">— Pilih menu item —</option>
                {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </AdminSelect>
            </div>
            {newMenuItemId && (
              <div className="grid gap-1.5">
                <Label>Varian <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                <AdminSelect value={newVariantId} onChange={(e) => setNewVariantId(e.target.value)}>
                  <option value="">Base / Tanpa Varian</option>
                  {variantsForItem(newMenuItemId)
                    .filter((v) => !hasRecipe(newMenuItemId, v.id))
                    .map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </AdminSelect>
                {hasRecipe(newMenuItemId, newVariantId || null) && (
                  <p className="text-xs text-destructive">Kombinasi ini sudah memiliki resep.</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending || !newMenuItemId || hasRecipe(newMenuItemId, newVariantId || null)} onClick={handleCreateRecipe}>
                Buat Resep
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setView("list")}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "list" && (
        <>
          {byItem.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              Belum ada resep. Klik &quot;+ Buat Resep&quot; untuk memulai.
            </CardContent></Card>
          ) : (
            byItem.map(({ item, recipes: itemRecipes }) => (
              <div key={item.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground px-1">{item.name}</h3>
                {itemRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    ingredients={ingredients}
                    isOwner={isOwner}
                    isExpanded={expandedId === recipe.id}
                    onToggle={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                    showAddIng={showAddIng === recipe.id}
                    onToggleAddIng={() => setShowAddIng(showAddIng === recipe.id ? null : recipe.id)}
                    ingType={ingType}
                    setIngType={setIngType}
                    editIngId={editIngId}
                    setEditIngId={setEditIngId}
                    isPending={isPending}
                    run={run}
                    confirm={confirm}
                  />
                ))}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

// ─── Recipe Card ─────────────────────────────────────────────────────────────

function RecipeCard({
  recipe, ingredients, isOwner, isExpanded, onToggle, showAddIng, onToggleAddIng,
  ingType, setIngType, editIngId, setEditIngId, isPending, run, confirm,
}: {
  recipe:         Recipe;
  ingredients:    IngredientOption[];
  isOwner:        boolean;
  isExpanded:     boolean;
  onToggle:       () => void;
  showAddIng:     boolean;
  onToggleAddIng: () => void;
  ingType:        "ingredient" | "custom";
  setIngType:     (t: "ingredient" | "custom") => void;
  editIngId:      string | null;
  setEditIngId:   (id: string | null) => void;
  isPending:      boolean;
  run:            ReturnType<typeof useAdminAction>["run"];
  confirm:        ReturnType<typeof useConfirm>;
}) {
  const displayLabel = recipe.variantLabel
    ? `${recipe.menuItemName} — ${recipe.variantLabel}`
    : `${recipe.menuItemName} (Base)`;

  const hasCogs = recipe.cogs > 0;
  const marginColor =
    recipe.marginPct === null ? "" :
    recipe.marginPct >= 60    ? "text-green-600 dark:text-green-400" :
    recipe.marginPct >= 30    ? "text-yellow-600 dark:text-yellow-400" :
    "text-destructive";

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div>
          <p className="font-medium text-sm">{displayLabel}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-xs text-muted-foreground">{recipe.ingredients.length} bahan</span>
            {hasCogs && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">HPP <span className="font-medium text-foreground">{formatRupiah(recipe.cogs)}</span></span>
                {recipe.sellingPrice > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">Harga <span className="font-medium text-foreground">{formatRupiah(recipe.sellingPrice)}</span></span>
                    {recipe.marginPct !== null && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className={`text-xs font-semibold ${marginColor}`}>Margin {recipe.marginPct}%</span>
                      </>
                    )}
                  </>
                )}
              </>
            )}
            {!hasCogs && <span className="text-xs text-muted-foreground">· HPP belum terhitung (belum ada pembelian bahan)</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button size="xs" variant="destructive" disabled={isPending}
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ title: `Hapus resep "${displayLabel}"?`, destructive: true, confirmLabel: "Hapus" })) {
                  run(() => deleteRecipe(recipe.id));
                }
              }}>
              Hapus
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="space-y-3 pt-0">
          {recipe.notes && <p className="text-xs text-muted-foreground italic">{recipe.notes}</p>}

          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Belum ada bahan. Tambahkan di bawah.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {recipe.ingredients.map((ing) => (
                <RecipeIngRow
                  key={ing.id}
                  ing={ing}
                  isEditing={editIngId === ing.id}
                  startEdit={() => setEditIngId(ing.id)}
                  cancelEdit={() => setEditIngId(null)}
                  isPending={isPending}
                  run={run}
                  confirm={confirm}
                />
              ))}
            </div>
          )}

          <BulkAddPanel
            recipeId={recipe.id}
            existingIngIds={new Set(recipe.ingredients.map((i) => i.ingredientId).filter(Boolean) as string[])}
            ingredients={ingredients}
            isPending={isPending}
            run={run}
          />

          <Button size="sm" variant="outline" onClick={onToggleAddIng}>
            {showAddIng ? "Tutup" : "+ Tambah satu bahan (manual)"}
          </Button>

          {showAddIng && (
            <AddIngredientForm
              recipeId={recipe.id}
              ingredients={ingredients}
              ingType={ingType}
              setIngType={setIngType}
              isPending={isPending}
              run={run}
              onSuccess={onToggleAddIng}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function RecipeIngRow({
  ing, isEditing, startEdit, cancelEdit, isPending, run, confirm,
}: {
  ing: RecipeIng;
  isEditing: boolean;
  startEdit: () => void;
  cancelEdit: () => void;
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  confirm: ReturnType<typeof useConfirm>;
}) {
  const unit = ingUnit(ing);
  const cost = ing.averageUnitCost > 0 ? ing.averageUnitCost : null;
  return (
    <div className="py-2 flex items-center gap-3">
      <div className="flex-1 text-sm">
        <span className="font-medium">{ingDisplayName(ing)}</span>
        {!ing.ingredientId && (
          <span className="ml-1 inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">
            lepas · tidak terhitung di HPP
          </span>
        )}
        {cost !== null && (
          <span className="text-muted-foreground text-xs ml-1">
            (HPP avg {formatRupiah(cost)}/{unit})
          </span>
        )}
      </div>

      {isEditing ? (
        <form action={(fd) => run(async () => { await updateRecipeIngredient(ing.id, fd); cancelEdit(); })}
          className="flex items-center gap-2">
          <DecimalInput name="quantity" defaultValue={ing.quantity} className="h-7 w-20 text-sm" required />
          <span className="text-xs text-muted-foreground">{unit}</span>
          <Button type="submit" size="xs" disabled={isPending}>Simpan</Button>
          <Button type="button" size="xs" variant="ghost" onClick={cancelEdit}>Batal</Button>
        </form>
      ) : (
        <div className="flex items-center gap-2 shrink-0 tabular-nums">
          <span className="text-sm">{ing.quantity} {unit}</span>
          {cost !== null && <span className="text-xs text-muted-foreground">= {formatRupiah(ing.quantity * cost)}</span>}
          <Button size="xs" variant="outline" onClick={startEdit}>Edit</Button>
          <Button size="xs" variant="destructive" disabled={isPending}
            onClick={async () => {
              if (await confirm({ title: `Hapus bahan "${ingDisplayName(ing)}"?`, destructive: true, confirmLabel: "Hapus" })) {
                run(() => deleteRecipeIngredient(ing.id));
              }
            }}>
            Hapus
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Bulk-add textarea + preview ─────────────────────────────────────────────

type BulkRow =
  | { ok: true; ingredient: IngredientOption; quantity: number; raw: string }
  | { ok: false; raw: string; reason: string };

function parseBulk(text: string, opts: IngredientOption[], existing: Set<string>): BulkRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((raw): BulkRow => {
    // accept "name, qty" or "name<TAB>qty" or "name = qty"
    const m = raw.match(/^(.+?)[\s,;=\t]+([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]*)$/);
    if (!m) return { ok: false, raw, reason: "Format tidak dikenali (pakai: nama, jumlah)" };
    const name = m[1].trim();
    const qty = Number(m[2].replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, raw, reason: "Jumlah harus angka > 0" };
    const ing = findIngredient(name, opts);
    if (!ing) return { ok: false, raw, reason: `Bahan "${name}" tidak ditemukan` };
    if (existing.has(ing.id)) return { ok: false, raw, reason: `"${ing.name}" sudah ada di resep` };
    return { ok: true, ingredient: ing, quantity: qty, raw };
  });
}

function BulkAddPanel({
  recipeId, existingIngIds, ingredients, isPending, run,
}: {
  recipeId:       string;
  existingIngIds: Set<string>;
  ingredients:    IngredientOption[];
  isPending:      boolean;
  run:            ReturnType<typeof useAdminAction>["run"];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const parsed = useMemo(
    () => (text.trim() ? parseBulk(text, ingredients, existingIngIds) : []),
    [text, ingredients, existingIngIds],
  );
  const okRows = parsed.filter((r): r is Extract<BulkRow, { ok: true }> => r.ok);
  const badRows = parsed.filter((r): r is Extract<BulkRow, { ok: false }> => !r.ok);
  const canSave = okRows.length > 0 && badRows.length === 0 && !isPending;

  return (
    <div className="border border-foreground/10 rounded-lg">
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((s) => !s)}
      >
        {open ? "▼" : "▶"} Tambah banyak bahan sekaligus
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Satu bahan per baris. Format: <code className="bg-muted px-1 rounded">nama bahan, jumlah</code>.
            Contoh:
          </p>
          <pre className="text-xs bg-muted/40 rounded p-2 leading-relaxed">{`Susu UHT, 180
Kopi Arabika, 18
Cup Plastik 16oz, 1`}</pre>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Tempel baris bahan di sini…"
            className="w-full text-sm font-mono rounded-md border border-input bg-input/30 p-2"
          />

          {parsed.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{okRows.length} cocok · {badRows.length} bermasalah</p>
              <ul className="divide-y divide-foreground/10 text-sm border border-foreground/10 rounded">
                {parsed.map((r, idx) => (
                  <li key={idx} className={`px-2 py-1 flex items-center gap-2 ${r.ok ? "" : "bg-destructive/5"}`}>
                    {r.ok ? (
                      <>
                        <span className="font-medium flex-1">{r.ingredient.name}</span>
                        <UnitClassBadge unitClass={r.ingredient.unitClass ?? "COUNT"} />
                        <span className="text-sm tabular-nums">{r.quantity} {r.ingredient.baseUnit}</span>
                        {r.ingredient.averageUnitCost > 0 && (
                          <span className="text-xs text-muted-foreground">= {formatRupiah(r.quantity * r.ingredient.averageUnitCost)}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{r.raw}</span>
                        <span className="text-xs text-destructive">{r.reason}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!canSave}
              onClick={() => run(async () => {
                await addRecipeIngredientsBulk(recipeId, okRows.map((r) => ({
                  ingredientId: r.ingredient.id,
                  quantity:     r.quantity,
                })));
                setText("");
                setOpen(false);
              }, { successMessage: `${okRows.length} bahan ditambahkan.` })}
            >
              Simpan {okRows.length > 0 ? `(${okRows.length})` : ""}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setOpen(false); }}>Batal</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single-add form (kept for free-form / custom names) ─────────────────────

function AddIngredientForm({
  recipeId, ingredients, ingType, setIngType, isPending, run, onSuccess,
}: {
  recipeId:    string;
  ingredients: IngredientOption[];
  ingType:     "ingredient" | "custom";
  setIngType:  (t: "ingredient" | "custom") => void;
  isPending:   boolean;
  run:         ReturnType<typeof useAdminAction>["run"];
  onSuccess:   () => void;
}) {
  return (
    <form
      action={(fd) =>
        run(async () => {
          await addRecipeIngredient(recipeId, fd);
          onSuccess();
        }, { successMessage: "Bahan berhasil ditambahkan." })
      }
      className="space-y-3 border border-foreground/10 rounded-lg p-3"
    >
      <div className="flex gap-2">
        <button type="button" onClick={() => setIngType("ingredient")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${ingType === "ingredient" ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}>
          Pilih Bahan
        </button>
        <button type="button" onClick={() => setIngType("custom")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${ingType === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}>
          Bahan Lepas (tanpa link)
        </button>
      </div>

      {ingType === "ingredient" ? (
        <div className="grid gap-1.5">
          <Label>Pilih Bahan</Label>
          <AdminSelect name="ingredientId" required>
            <option value="">— Pilih bahan —</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.baseUnit}
                {i.averageUnitCost > 0 ? ` · HPP avg ${formatRpPerUnit(i.averageUnitCost)}/${i.baseUnit}` : ""}
              </option>
            ))}
          </AdminSelect>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 col-span-2">
              <Label>Nama Bahan</Label>
              <Input name="customName" placeholder="cth: Daging sapi" required />
            </div>
            <div className="grid gap-1.5">
              <Label>Satuan</Label>
              <Input name="customUnit" placeholder="cth: kg, liter, pcs" />
            </div>
          </div>
          <p className="text-xs text-warning-foreground bg-warning/10 rounded px-2 py-1">
            Bahan lepas tidak memiliki data HPP dan tidak mempengaruhi stok.
          </p>
        </>
      )}

      <div className="grid gap-1.5">
        <Label>Jumlah</Label>
        <DecimalInput name="quantity" placeholder="cth: 0,5" required className="w-32" />
      </div>

      <Button type="submit" size="sm" disabled={isPending}>Tambah Bahan</Button>
    </form>
  );
}
