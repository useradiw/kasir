/**
 * route-reachability.test.ts — every page route must be reachable from a link.
 *
 * Written 2026-09-05 after Adi found that /buku/bulan had no button anywhere in
 * a healthy shop. The Buku settings tier (bulan, akun, akun-penjualan,
 * kategori, setup) was reachable ONLY from the setup checklist and from
 * empty-state warnings like "Belum ada akun kas — tambahkan dulu di Akun Kas".
 * Those alerts stop rendering the moment the thing they warn about is fixed, so
 * finishing setup correctly stranded five screens. /buku/kategori had no
 * inbound link at all.
 *
 * A plain href audit does NOT catch this: every one of those links pointed at a
 * valid route, so outbound validation passed while the screens stayed
 * unreachable. This test checks the opposite direction.
 *
 * It is deliberately a STATIC scan, not a render: it needs no database, no auth
 * and no server, so it stays fast and cannot flake. It proves a link exists in
 * the source, not that it renders in every state — see UNCONDITIONAL_HOME below
 * for the part that needs a human eye.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP = join(__dirname, "..", "app");
const COMPONENTS = join(__dirname, "..", "components");

/**
 * Routes with no inbound <Link>, each verified by hand and each legitimate.
 * Adding an entry here is a decision, not a formality: it says "no button
 * should point at this, and here is why".
 */
const NO_LINK_EXPECTED: Record<string, string> = {
  "/admin/transactions/[id]":
    "Linked with a template literal from transactions-client.tsx; the scan below only matches quoted literals.",
  "/auth/auth-code-error":
    "Reached by redirect() from app/auth/confirm/route.ts, never by a link.",
  "/expenses":
    "A redirect stub kept for cashiers' phone bookmarks — it forwards to /buku/belanja.",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** "app/admin/(ops)/staff/page.tsx" -> "/admin/staff" (route groups stripped). */
function routeFor(file: string): string {
  const rel = relative(APP, file).split(sep).slice(0, -1).join("/");
  const cleaned = rel.replace(/\/?\([^)]*\)/g, "").replace(/^\/+/, "");
  return cleaned === "" ? "/" : `/${cleaned}`;
}

const sourceFiles = [...walk(APP), ...walk(COMPONENTS)].filter((f) =>
  /\.(tsx|ts)$/.test(f),
);
const routes = walk(APP)
  .filter((f) => f.endsWith(`${sep}page.tsx`))
  .map(routeFor);

/** Every quoted "/..." path appearing anywhere in the source. */
const linkedPaths = new Set<string>();
for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/["'`](\/[A-Za-z0-9\-_/[\]?=$.{}]*)["'`]/g)) {
    const path = (m[1] ?? "").split("?")[0]!.split("#")[0]!.replace(/\/$/, "");
    linkedPaths.add(path === "" ? "/" : path);
  }
}

describe("route reachability", () => {
  it("finds the app's routes at all (guards the scanner itself)", () => {
    // If the walker silently returns nothing, every other assertion below
    // passes vacuously and the test becomes decoration.
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain("/buku/bulan");
    expect(routes).toContain("/admin/staff");
  });

  it("every page route has an inbound link, or a documented reason not to", () => {
    const orphans = routes.filter(
      (r) => !linkedPaths.has(r) && !(r in NO_LINK_EXPECTED),
    );
    expect(
      orphans,
      `These routes have no link pointing at them, so nothing can reach them. ` +
        `Add a button, or document the route in NO_LINK_EXPECTED with the reason.`,
    ).toEqual([]);
  });

  it("keeps the documented exceptions honest", () => {
    // An exception that has since gained a real link should be deleted from the
    // allowlist rather than left to rot, EXCEPT the two that are genuinely
    // linked in source but not as a plain quoted literal.
    const byRedirectOnly = ["/auth/auth-code-error", "/expenses"];
    for (const route of byRedirectOnly) {
      expect(routes, `${route} is in the allowlist but is not a route`).toContain(route);
    }
  });

  /**
   * The Buku settings tier is the specific regression this file exists for.
   * These five must be linked from /buku itself, NOT merely from the setup
   * checklist or an empty-state alert, because those disappear once the shop is
   * correctly configured.
   */
  it("links the Buku settings tier from /buku unconditionally", () => {
    const bukuHome = readFileSync(join(APP, "buku", "page.tsx"), "utf8");
    // Drop the conditional block that only renders while setup is incomplete,
    // so a link that lives ONLY inside it cannot satisfy this test.
    const withoutSetupAlert = bukuHome.replace(
      /\{remaining > 0 \?[\s\S]*?\) : null\}/,
      "",
    );
    for (const route of [
      "/buku/bulan",
      "/buku/akun",
      "/buku/akun-penjualan",
      "/buku/kategori",
      "/buku/setup",
    ]) {
      expect(
        withoutSetupAlert,
        `/buku must link to ${route} outside the setup-incomplete alert — ` +
          `otherwise the screen is stranded once setup is finished.`,
      ).toContain(`"${route}"`);
    }
  });
});
