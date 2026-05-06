"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import {
  upsertRecipe,
  deleteRecipe,
  addRecipeIngredient,
  updateRecipeIngredient,
  deleteRecipeIngredient,
} from "@/app/actions/admin/recipes";
import type { RecipeData } from "@/app/actions/admin/queries";

type Template = RecipeData["templates"][number];
type Recipe = RecipeData["recipes"][number];
type Ingredient = Recipe["ingredients"][number];

type MenuItem = { id: string; name: string; categoryId: string; categoryName: string; price: number; isHidden: boolean; createdAt: string; updatedAt: string };
type Variant = { id: string; menuItemId: string; menuItemName: string; label: string; priceModifier: number };

type Props = {
  templates: Template[];
  recipes: Recipe[];
  menuItems: MenuItem[];
  variants: Variant[];
  isOwner: boolean;
};

function ingredientDisplayName(ing: Ingredient): string {
  return ing.templateName ?? ing.customName ?? "—";
}

function ingredientUnit(ing: Ingredient): string {
  return ing.templateUnit ?? ing.customUnit ?? "";
}

function ingredientCost(ing: Ingredient): number | null {
  return ing.templateCost ?? null;
}

function recipeEstimatedCost(recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, ing) => {
    const cost = ingredientCost(ing);
    return cost !== null ? sum + ing.quantity * cost : sum;
  }, 0);
}

export default function RecipeTab({ templates, recipes, menuItems, variants, isOwner }: Props) {
  const { isPending, run, error, setError } = useAdminAction();
  const confirm = useConfirm();
  const [view, setView] = useState<"list" | "add">("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editIngId, setEditIngId] = useState<string | null>(null);

  // "add recipe" form state
  const [newMenuItemId, setNewMenuItemId] = useState("");
  const [newVariantId, setNewVariantId] = useState(""); // "" means base item

  // For each expanded recipe, show the add-ingredient form
  const [showAddIng, setShowAddIng] = useState<string | null>(null);
  const [ingType, setIngType] = useState<"template" | "custom">("template");

  function variantsForItem(menuItemId: string) {
    return variants.filter((v) => v.menuItemId === menuItemId);
  }

  // Find recipes that cover a given menuItemId+variantId combo
  function hasRecipe(menuItemId: string, variantId: string | null) {
    return recipes.some(
      (r) => r.menuItemId === menuItemId && r.variantId === (variantId || null)
    );
  }

  async function handleCreateRecipe() {
    if (!newMenuItemId) { setError("Pilih menu item terlebih dahulu."); return; }
    const vid = newVariantId || null;
    const fd = new FormData();
    await run(async () => {
      await upsertRecipe(newMenuItemId, vid, fd);
      setView("list");
      setNewMenuItemId("");
      setNewVariantId("");
    }, { successMessage: "Resep berhasil dibuat." });
  }

  // Group recipes by menuItemId for display
  const byItem = menuItems
    .map((item) => ({
      item,
      recipes: recipes.filter((r) => r.menuItemId === item.id),
    }))
    .filter((g) => g.recipes.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold flex-1">Resep Menu</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => { setView("list"); setError(null); }}
          >
            Daftar Resep
          </Button>
          <Button
            size="sm"
            variant={view === "add" ? "default" : "outline"}
            onClick={() => { setView("add"); setError(null); }}
          >
            + Buat Resep
          </Button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {/* ─── CREATE RECIPE FORM ─── */}
      {view === "add" && (
        <Card>
          <CardHeader><CardTitle>Buat Resep Baru</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Menu Item</Label>
              <AdminSelect
                value={newMenuItemId}
                onChange={(e) => { setNewMenuItemId(e.target.value); setNewVariantId(""); }}
              >
                <option value="">— Pilih menu item —</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </AdminSelect>
            </div>

            {newMenuItemId && (
              <div className="grid gap-1.5">
                <Label>Varian <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                <AdminSelect value={newVariantId} onChange={(e) => setNewVariantId(e.target.value)}>
                  <option value="">Base / Tanpa Varian</option>
                  {variantsForItem(newMenuItemId)
                    .filter((v) => !hasRecipe(newMenuItemId, v.id))
                    .map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                </AdminSelect>
                {hasRecipe(newMenuItemId, newVariantId || null) && (
                  <p className="text-xs text-destructive">Kombinasi ini sudah memiliki resep.</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isPending || !newMenuItemId || hasRecipe(newMenuItemId, newVariantId || null)}
                onClick={handleCreateRecipe}
              >
                Buat Resep
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setView("list")}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── RECIPE LIST ─── */}
      {view === "list" && (
        <>
          {byItem.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Belum ada resep. Klik &quot;Buat Resep&quot; untuk memulai.
              </CardContent>
            </Card>
          ) : (
            byItem.map(({ item, recipes: itemRecipes }) => (
              <div key={item.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground px-1">{item.name}</h3>
                {itemRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    templates={templates}
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

// ─── RecipeCard sub-component ──────────────────────────────────────────────────

function RecipeCard({
  recipe,
  templates,
  isOwner,
  isExpanded,
  onToggle,
  showAddIng,
  onToggleAddIng,
  ingType,
  setIngType,
  editIngId,
  setEditIngId,
  isPending,
  run,
  confirm,
}: {
  recipe: Recipe;
  templates: Template[];
  isOwner: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  showAddIng: boolean;
  onToggleAddIng: () => void;
  ingType: "template" | "custom";
  setIngType: (t: "template" | "custom") => void;
  editIngId: string | null;
  setEditIngId: (id: string | null) => void;
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  confirm: ReturnType<typeof useConfirm>;
}) {
  const estimatedCost = recipeEstimatedCost(recipe);
  const displayLabel = recipe.variantLabel
    ? `${recipe.menuItemName} — ${recipe.variantLabel}`
    : `${recipe.menuItemName} (Base)`;

  return (
    <Card>
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={onToggle}
      >
        <div>
          <p className="font-medium text-sm">{displayLabel}</p>
          <p className="text-xs text-muted-foreground">
            {recipe.ingredients.length} bahan · Est. {formatRupiah(estimatedCost)}/porsi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              size="xs"
              variant="destructive"
              disabled={isPending}
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ title: `Hapus resep "${displayLabel}"?`, destructive: true, confirmLabel: "Hapus" })) {
                  run(() => deleteRecipe(recipe.id));
                }
              }}
            >
              Hapus
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded ingredient list */}
      {isExpanded && (
        <CardContent className="space-y-3 pt-0">
          {recipe.notes && (
            <p className="text-xs text-muted-foreground italic">{recipe.notes}</p>
          )}

          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Belum ada bahan. Tambahkan bahan di bawah.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {recipe.ingredients.map((ing) => (
                <div key={ing.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{ingredientDisplayName(ing)}</span>
                    {ingredientCost(ing) !== null && (
                      <span className="text-muted-foreground text-xs ml-1">
                        ({formatRupiah(ingredientCost(ing)!)}/{ingredientUnit(ing)})
                      </span>
                    )}
                  </div>

                  {editIngId === ing.id ? (
                    <form
                      action={(fd) => run(async () => { await updateRecipeIngredient(ing.id, fd); setEditIngId(null); })}
                      className="flex items-center gap-2"
                    >
                      <Input
                        name="quantity"
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={ing.quantity}
                        className="h-7 w-20 text-sm"
                        required
                      />
                      <span className="text-xs text-muted-foreground">{ingredientUnit(ing)}</span>
                      <Button type="submit" size="xs" disabled={isPending}>Simpan</Button>
                      <Button type="button" size="xs" variant="ghost" onClick={() => setEditIngId(null)}>Batal</Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm">{ing.quantity} {ingredientUnit(ing)}</span>
                      {ingredientCost(ing) !== null && (
                        <span className="text-xs text-muted-foreground">
                          = {formatRupiah(ing.quantity * ingredientCost(ing)!)}
                        </span>
                      )}
                      <Button size="xs" variant="outline" onClick={() => setEditIngId(ing.id)}>Edit</Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={isPending}
                        onClick={async () => {
                          if (await confirm({ title: `Hapus bahan "${ingredientDisplayName(ing)}"?`, destructive: true, confirmLabel: "Hapus" })) {
                            run(() => deleteRecipeIngredient(ing.id));
                          }
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add ingredient form toggle */}
          <Button size="sm" variant="outline" onClick={onToggleAddIng}>
            {showAddIng ? "Batal" : "+ Tambah Bahan"}
          </Button>

          {showAddIng && (
            <AddIngredientForm
              recipeId={recipe.id}
              templates={templates}
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

// ─── AddIngredientForm ─────────────────────────────────────────────────────────

function AddIngredientForm({
  recipeId,
  templates,
  ingType,
  setIngType,
  isPending,
  run,
  onSuccess,
}: {
  recipeId: string;
  templates: Template[];
  ingType: "template" | "custom";
  setIngType: (t: "template" | "custom") => void;
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  onSuccess: () => void;
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
      {/* Type selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIngType("template")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${ingType === "template" ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}
        >
          Dari Template Pengeluaran
        </button>
        <button
          type="button"
          onClick={() => setIngType("custom")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${ingType === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}
        >
          Bahan Baru (tanpa template)
        </button>
      </div>

      {ingType === "template" ? (
        <div className="grid gap-1.5">
          <Label>Pilih Bahan (dari Template Pengeluaran)</Label>
          <AdminSelect name="templateId" required>
            <option value="">— Pilih bahan —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.defaultUnit ? ` (${t.defaultUnit})` : ""}{t.defaultCost ? ` — ${formatRupiah(t.defaultCost)}/${t.defaultUnit ?? "unit"}` : ""}
              </option>
            ))}
          </AdminSelect>
          <p className="text-xs text-muted-foreground">
            Hanya template aktif yang tampil. Kelola di menu Keuangan → Template Pengeluaran.
          </p>
        </div>
      ) : (
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
      )}

      <div className="grid gap-1.5">
        <Label>Jumlah</Label>
        <Input
          name="quantity"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="cth: 0.5"
          required
          className="w-32"
        />
      </div>

      <Button type="submit" size="sm" disabled={isPending}>Tambah Bahan</Button>
    </form>
  );
}
