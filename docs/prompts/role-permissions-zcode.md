# Task brief — role permission toggle (capability layer)

**For:** zcode, working in a separate git worktree off `sept`.
**Repo:** `D:\Website\adi\kasir` (Toko Kencana POS + Warung Books).
**Origin:** written by Claude (Opus) in the 2026-09-07 session. Adi approved
handing this work to zcode.

Read `CLAUDE.md`, `HANDOFF.md`, and the memory system at
`C:\Users\62852\.claude\projects\D--Website-adi-kasir\memory\MEMORY.md` before
touching code. Note that the memory `file_map.md` is partly stale — it still
describes the retired COGS screens and a `components/expenses/` folder that no
longer exists. Trust the working tree over the file map.

## Goal

Replace the hardcoded role checks scattered through the app with a named
**capability** layer, store the role-to-capability grid in the database, and
give the Owner a screen that toggles it. Adi wants to change what a role can do
without a code edit and a deploy.

## Non-goals — what must not change

1. **Day-one behaviour is identical.** The seeded grid must reproduce today's
   permissions exactly. Nobody gains or loses access when this ships.
2. **Do not touch the money paths.** No change to checkout totals, laporan
   aggregation, journal posting, or `lib/accounting/*`. This is an access-control
   change only.
3. **Do not weaken the privileged-role rules** landed on 2026-09-07 in
   `app/actions/admin/staff.ts` (see "Interaction with the staff guards" below).
4. **Do not run any schema command against production.** See the database section.
5. Do not reintroduce per-item ingredient recipes or anything COGS. That system
   is retired for good.

## Current state — where permissions actually live

Three places, and the third is the bulk of the work.

1. `lib/admin-auth.ts` — the gate helpers: `requireRole(...roles)`,
   `requireRoleStrict(...)`, `requireOwner()`, `requireOwnerStrict()`,
   `requireAuth()`, `getStaffIdentity()`. All resolve the Supabase user to a
   Prisma `Staff` row and `redirect("/")` on failure.
2. `components/shell/nav-items.ts` — `TABS`, each with a `roles: RoleEnum[]`
   array. This decides what each role can *see* in the bottom tab bar.
3. **The call sites.** 154 calls across 68 files. They are not 154 independent
   decisions — they collapse to seven shapes:

   | Shape | Count |
   |---|---|
   | `requireOwner()` | 75 |
   | `requireRole("OWNER", "MANAGER")` | 36 |
   | `requireAuth()` | 22 |
   | `requireOwnerStrict()` | 9 |
   | `requireRole("OWNER", "MANAGER", "CASHIER")` | 6 |
   | `requireRoleStrict("OWNER", "MANAGER")` | 1 |
   | `requireRole("OWNER")` | 1 |

   Densest files: `app/actions/admin/keuangan.ts` (24),
   `app/actions/admin/inventory.ts` (17),
   `app/actions/admin/queries/keuangan-queries.ts` (7),
   `app/actions/admin/staff.ts` (6).

Roles are the `RoleEnum` in `prisma/schema.prisma`: OWNER, MANAGER, CASHIER,
STAFF, DEVELOPER.

## Two behaviours you must preserve exactly

**The DEVELOPER superuser bypass.** `requireRole` and `requireOwner` let a
DEVELOPER through every check. The `Strict` variants do not, and exist
specifically so DEVELOPER cannot perform hard deletes. Your capability layer
needs the same two flavours — call them `requireCan(cap)` and
`requireCanStrict(cap)`, or keep a `{ strict: true }` option. Losing this
distinction would hand the dev account destructive powers it must not have.

**Failure is `redirect("/")`, not a thrown error,** for page-level gates. Server
actions that throw use `ActionError` via `runAction()`. Keep both behaviours as
they are. Turning a redirect into a throw produces an error screen where the app
currently bounces the user home.

## Suggested design

Adjust freely if you find something simpler. This is a starting point, not a
specification to follow blindly.

- **Capability names**: dotted `area.verb`, for example `pengeluaran.write`,
  `laporan.read`, `staff.write`, `menu.write`, `transaksi.void`. Derive the list
  from the call sites; expect roughly 20 to 30. Define them in one TypeScript
  file as a const object so the names are typed, not stringly-typed.
- **Storage**: one table, `RolePermission(role RoleEnum, capability String,
  allowed Boolean)`, unique on `(role, capability)`. Seed it from a hardcoded
  default grid that mirrors today's behaviour. A capability missing from the
  table falls back to the hardcoded default, never to "allowed".
- **The default grid stays in code** as the source of truth for a fresh install
  and as the fallback. The table is an override layer on top of it.
- **Caching**: the grid is read on nearly every request. Cache it in the Node
  process and invalidate on write. Do not add a database round trip to every
  server action.
- **The screen**: Owner-only, a role-by-capability grid of switches. Put it under
  `/buku` or `/admin` to match the surrounding navigation. Read
  `docs/redesign/SPEC.md` and follow the existing page conventions — `AppShell`,
  `BentoCard`, `Field`, `AdminSelect`, and the `max-w-lg` mobile-first container.

## Guard rails on the grid itself

These are Adi's rules and they are not negotiable.

- **The OWNER row is not editable.** Render its capabilities as always-on and
  reject any write that tries to revoke one. An Owner who toggles themselves out
  of `staff.write` could never toggle it back, and there is no second Owner to
  repair it. Fail loud on such a write rather than ignoring it silently.
- **The DEVELOPER row is not editable either.** It is the support account and its
  superuser behaviour is defined in code.
- Every write to the grid is Owner-only, checked against the actor's real role,
  with no DEVELOPER bypass — exactly as `assertMayChangePrivilegedRole` does today.

## Interaction with the staff guards landed 2026-09-07

`app/actions/admin/staff.ts` now carries three rules that must survive the
migration, ideally untouched. They are deliberately checked against the actor's
**real** role rather than through a gate helper, precisely because
`requireOwner()` admits a DEVELOPER:

1. `assertMayChangePrivilegedRole()` — only a real OWNER may grant or revoke
   OWNER or DEVELOPER, in both directions.
2. `assertNotSelfLockout()` — nobody changes their own role.
3. `toggleStaffActive` refuses to deactivate your own account, and refuses to
   deactivate an OWNER or DEVELOPER unless the actor is a real OWNER.

Do not replace these with capability checks. A capability is a grant the Owner
can toggle; these three are invariants that stop the shop from losing its Owner.
Leave them as direct role comparisons and add a test that they still hold.

## Database — read this before any schema work

The production database is live and holds real business data: 855 transactions
from April to September 2026. `.env` points at production, and
`prisma.config.ts` does `import "dotenv/config"`, so **every bare `prisma` CLI
command targets production.**

- **Never run `prisma migrate deploy` or `prisma db push`.**
- To apply DDL to production: additive only, via `prisma db execute` on a
  reviewed `.sql` file wrapped in `BEGIN; ... COMMIT;`, then
  `prisma migrate resolve --applied <name>`.
- **Adi applies it. You do not.** Deliver the reviewed `.sql` file and the exact
  commands, and let him run them after taking a backup at `/admin/backup`.
- There is no dev database. `npm run dev:claude` refuses to start by design.
  **pglite**, via `npm test`, is the only database you may write to.

## Testing

`npm test` currently passes 373 tests and 1 skipped across 35 files, on pglite.
There is **no permission coverage at all** today. That gap is the main reason
this migration is risky, and closing it is part of the job.

Write a permission matrix test that asserts, for every role and every
capability, that the seeded grid matches today's behaviour. Build it from the
call-site inventory **before** you start migrating, so it is a genuine
regression gate rather than a description of whatever you happened to write.

## Suggested phasing

Land these as separate commits so Adi can review and stop at any point.

1. **Capability layer, grid hardcoded.** Add the capability names, the default
   grid, `requireCan` / `requireCanStrict`, and the matrix test. No call sites
   move yet, and no schema change yet.
2. **Migrate the call sites in batches**, by area: keuangan, inventory, staff,
   laporan, kas, kasir. Run `npm test` after each batch. Migrate
   `components/shell/nav-items.ts` too, so visibility and access come from one
   grid instead of two lists that can drift apart.
3. **Persist and expose.** Add the `RolePermission` table, the override-plus-
   fallback read path, the cache, and the Owner-only toggle screen. Update the
   "Petunjuk Penggunaan" pages in simple Indonesian, since this is a user-facing
   feature.

## Definition of done

- `npm run lint` clean.
- `npm test` green, including the new permission matrix test.
- `npm run build` succeeds. Do not build while a dev server is running —
  `next build` clobbers the `.next` the dev server is serving, and
  `prisma generate` hits EPERM on the query-engine DLL.
- Visual verification in the dev server. Owner-gated routes need Adi to log the
  dev account in; ask him.
- The `.sql` file and the exact commands for Adi to apply, if phase 3 is reached.
- `HANDOFF.md` updated at every checkpoint, under about 15 lines, overwritten
  rather than appended.

## Git

- Work in a **separate worktree**, on a branch off `sept`.
- Branch order for merging is the month branch, then `develop`, then `master`.
  **Adi does every merge and every push himself.**
- The git-guard hook refuses commits on `master` and `develop`, and refuses
  `git push` entirely in this repo. Commit only on Adi's explicit order.
