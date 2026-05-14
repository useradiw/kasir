# Kasir POS

A local-first point-of-sale system for food & beverage businesses. The cashier operates fully offline using IndexedDB, while the admin panel is server-rendered and backed by a PostgreSQL database via Prisma.

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Server DB | Prisma 6 + PostgreSQL (via `@prisma/adapter-pg`) |
| Client DB | Dexie v4 (IndexedDB) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Server cache | TanStack React Query v5 |
| Notifications | Sonner |
| Charts | Recharts |
| Export | jsPDF + autotable, CSV |
| Printing | Web Bluetooth API (ESC/POS thermal) |
| Validation | Zod |

## Architecture

**Dual-database, local-first:**

- **Cashier (client)** — products sync from server into Dexie (IndexedDB) on app load. Sessions, orders, and payments are created locally. On payment, data is fire-and-forget synced to the server via a server action. Unsynced transactions are retried automatically on the next app mount.
- **Admin (server)** — all admin pages are server components that query Prisma directly. Client interactivity is handled by companion `*-client.tsx` files.
- **Auth** — role-based access enforced per-route via `requireRole()` / `requireOwner()` guards in `lib/admin-auth.ts`.

## Features

### Cashier

- **Offline operation** — works without internet; transactions sync to server when connectivity is restored
- **Sessions** — create and manage table/order sessions with a customer alias, phone number, and service type
- **Service types** — Dine-in, Take Away, GoFood, ShopeeFood, GrabFood
- **Menu browser** — category tabs, menu items with variants, and pre-configured package bundles
- **Order management** — add, remove, and adjust quantities; item statuses (Pending → Preparing → Served → Cancelled)
- **Split bills** — assign order items to separate groups and process each group's payment individually
- **Payment methods** — Cash, QRIS, Cash+QRIS split payment
- **Receipt** — preview receipt before printing; print via Web Bluetooth ESC/POS thermal printer or save as image
- **Expense entry** — cashier-side expense recording against expense templates with autocomplete
- **Cash register** — open and close the daily cash register with denomination breakdown

### Admin Panel

#### Dashboard
- Daily snapshot: revenue, transaction count, top-selling items
- Quick links to all admin sections

#### Staff Management
- Create, edit, and deactivate staff accounts
- Roles: Owner, Manager, Cashier, Staff
- Link staff accounts to Supabase Auth login credentials
- Salary tracking per staff member

#### Inventory / Menu
- Categories, menu items, and price variants
- Package bundles (set meals) with item composition snapshots
- Per-service online pricing overrides (GoFood, ShopeeFood, GrabFood)
- Toggle active/inactive without deleting

#### Transactions
- Full transaction history with filtering
- Transaction detail: items, payment breakdown, service type, cashier
- Void transactions with reason tracking and notifications to owners

#### Sessions
- Historical session log with service type, customer info, and payment status

#### Online Order Settlement
- Record and reconcile online-order platform payouts (GoFood, ShopeeFood, GrabFood)
- Link individual transactions to a settlement batch
- Deductions support (commission, marketing fees, etc.)
- Accessible to Owner, Manager, and Cashier roles

#### Expenses
- Record operational expenses with line-item detail
- Flag expenses as cash deductions or Kas Pak Har contributions
- Expense templates for recurring items (linked to autocomplete in cashier UI)

#### Cash Register
- Per-day opening and closing cash entries
- Edit history with staff attribution

#### Kas Pak Har (Petty Cash)
- Petty cash ledger: Deposits, Withdrawals, Expense Deductions
- Tracks running balance

#### Attendance
- Daily attendance marking (Present / Absent) per staff member
- Monthly attendance overview

#### Reports
- Revenue charts by date range
- Breakdown by payment method and service type
- Export to PDF or CSV

#### Notifications
- In-app notification bell for owners and managers
- Triggered on transaction void, session void, and other system events

#### Backup & Restore
- Export full database snapshot as JSON (24 tables)
- Restore from a validated JSON backup file

#### Settings
- Store name, address, phone number
- Default tax percentage
- Default service charge percentage

### Profile
- Staff can update their own display name and password

## Project Structure

```
app/
  actions/          # Server actions (cashier + admin)
  admin/            # Admin pages (* -client.tsx for interactivity)
  kasir/            # Cashier app shell
  ...               # Auth routes, cashregister, expenses, profile, settlement
components/
  kasir/            # Cashier UI components
  admin/            # Admin-specific UI components
  shared/           # Badges, dialogs, page headers
  expenses/         # Expense form + item row
  ui/               # shadcn base components
lib/
  db.ts             # Dexie client DB
  prisma.ts         # Prisma singleton
  admin-auth.ts     # Auth guards
  kasir-utils.ts    # Price/status helpers
  format.ts         # Currency, date, label formatters
  notify.ts         # Toast wrapper
  revalidate.ts     # Centralized cache revalidation
  bluetooth-printer.ts + escpos.ts  # Thermal printing
  export-pdf.ts + export-csv.ts     # Report exports
hooks/
  use-session-store.ts  # Core cashier Dexie hook
  use-kasir-query.ts    # TanStack Query wrappers
  use-bluetooth-printer.ts
utils/supabase/     # Supabase browser/server/admin/proxy clients
prisma/schema.prisma
```

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set environment variables** — create a `.env.local`:

   ```env
   DATABASE_URL=
   DIRECT_URL=
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

3. **Run database migrations**

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Role Access Reference

| Feature | Owner | Manager | Cashier | Staff |
|---------|-------|---------|---------|-------|
| Cashier app | ✓ | ✓ | ✓ | ✓ |
| Expense entry | ✓ | ✓ | ✓ | |
| Cash register | ✓ | ✓ | ✓ | |
| Online settlement | ✓ | ✓ | ✓ | |
| Admin panel | ✓ | ✓ | | |
| Void transactions | ✓ | ✓ | | |
| Staff management | ✓ | | | |
| Settings | ✓ | | | |
| Backup & Restore | ✓ | | | |
