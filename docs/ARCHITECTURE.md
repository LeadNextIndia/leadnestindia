# Architecture

The technical shape of LeadNestIndia — stack, patterns, and the "why" behind the decisions that would otherwise be non-obvious from reading the code.

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [High-level shape](#high-level-shape)
3. [Auth flow](#auth-flow)
4. [Role model](#role-model)
5. [Feature flags and paywall](#feature-flags-and-paywall)
6. [Custom fields — EAV-lite](#custom-fields--eav-lite)
7. [Filter model — one evaluator, two runtimes](#filter-model--one-evaluator-two-runtimes)
8. [Activity log — auto vs. manual](#activity-log--auto-vs-manual)
9. [Invoicing — snapshotted seller, JSONB items, print-CSS PDF](#invoicing--snapshotted-seller-jsonb-items-print-css-pdf)
10. [Dark mode](#dark-mode)
11. [Gotchas we've already hit](#gotchas-weve-already-hit)

---

## Tech stack

| Layer | Choice | Reference |
|---|---|---|
| Framework | Next.js 16.2.11 with App Router + Turbopack | `package.json`, `next.config.ts` |
| UI runtime | React 19 (strict lint) | — |
| Styling | Tailwind CSS v4 (no config file — tokens in globals.css) | `app/globals.css` |
| Charts | Recharts (client-only) | `components/leads-charts.tsx` |
| DB / Auth | Supabase (Postgres + Auth + RLS) | `lib/supabase/*` |
| Middleware | `proxy.ts` (Next.js 16 renamed `middleware.ts`) | `proxy.ts` |
| PDF | Browser `window.print()` + print CSS — no library | `app/globals.css` print block, `components/print-buttons.tsx` |

**Why no PDF library?** Modern browsers render our print-CSS invoice as an A4 PDF via the native "Save as PDF" option. That's zero-dependency, zero-runtime-cost, and identical quality to headless-Chrome PDF. Only worth revisiting if we need automated server-side PDF (e.g. email-invoice-to-customer).

---

## High-level shape

```
                    ┌────────────────────────┐
    Browser         │  Next.js 16 (App Rtr)  │
    (React 19)      │                        │
      │             │  ── proxy.ts ──        │  auth-guard middleware
      ▼             │                        │
  ┌─────────────┐   │  app/                  │
  │ Superadmin  │──▶│    superadmin/         │
  │ (founder)   │   │    dashboard/          │
  └─────────────┘   │    api/                │  server components + route handlers
      ▼             │                        │
  ┌─────────────┐   │  components/           │
  │ Company     │──▶│  lib/  ├─ authz.ts     │  server-side session helpers
  │ admin/user  │   │        ├─ features.ts  │  paywall type + defaults
  └─────────────┘   │        ├─ filters.ts   │  shared client/server eval
                    │        ├─ invoice.ts   │  GST math + helpers
                    │        └─ supabase/*   │  SSR + browser + admin clients
                    └────────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │  Supabase Postgres   │
                      │                      │
                      │  auth.users          │  ← managed by Supabase
                      │  public.tenants      │
                      │  public.tenant_users │
                      │  public.leads        │
                      │  public.invoices     │  ← every table has RLS
                      │  public.lead_activity│
                      │  public.saved_views  │
                      │  public.field_defs   │
                      │  public.superadmins  │
                      └──────────────────────┘
```

- **Server components** do all data fetching. Client components take the data as props and handle interactivity (filters, modals, forms).
- **API routes** (`app/api/**`) do writes and privileged reads. They validate the session via `lib/authz.ts` and use the service-role client (`lib/supabase/admin.ts`) to bypass RLS for cross-tenant work.
- **RLS is the last line of defense.** Even if an API bug leaks a cross-tenant query, RLS blocks it at the DB.

---

## Auth flow

Two entry paths to a signed-in session, both landing at `/dashboard`:

### 1. Password sign-in
```
/login  →  supabase.auth.signInWithPassword  →  cookies set  →  /dashboard
```

### 2. Invite (or reset)
```
Superadmin invites company    ┐
Admin invites teammate         ├─→  Supabase sends email → click link
"Forgot / first time" reset    ┘
                                     │
                                     ▼
                    /auth/callback?code=…  OR  ?token_hash=&type=
                                     │
                                     ▼   (exchanges for a session)
                            /auth/set-password
                                     │
                                     ▼
                                /dashboard
```

**Key file:** `app/auth/callback/route.ts` — handles both PKCE (`code`) and OTP (`token_hash`) flows. The dashboard-side invite comes from Supabase's `Auth → Invite user` which uses OTP; our API uses `inviteUserByEmail(email, { redirectTo, data: { tenant_id, role } })` which uses PKCE. The trigger `on_auth_user_created_invite` on `auth.users` INSERT reads `raw_user_meta_data.tenant_id` and inserts a `tenant_users` row automatically.

**Required Supabase settings:**
- Auth → URL Configuration → Site URL: `http://localhost:3000` (prod: your domain)
- Auth → URL Configuration → Redirect URLs: `http://localhost:3000/auth/callback`

---

## Role model

Three tiers, stored in different places:

| Role | Where | Powers |
|---|---|---|
| **superadmin** | Row in `public.superadmins` | Onboard companies, edit fields + feature flags per tenant, drill into any tenant, bypass RLS |
| **admin** | `tenant_users.role = 'admin'` | Invite/remove teammates, edit any lead, generate invoices, configure company GST |
| **user** | `tenant_users.role = 'user'` | Create leads, view all leads in own tenant, self-assign, add notes (if activity flag on) |

Helpers in `lib/authz.ts`:
- `getSession()` — returns `{ user, isSuperadmin, tenantId, role } | null`
- `requireSession()` — redirects to `/login` if not signed in
- `requireAdmin()` — redirects to `/dashboard` if not admin/superadmin
- `requireSuperadmin()` — redirects to `/dashboard` if not superadmin

DB-side helpers used in RLS policies:
- `is_superadmin(uid uuid) → boolean`
- `tenant_role(uid uuid, tid uuid) → text`

---

## Feature flags and paywall

**Single source of truth:** `lib/features.ts`.

```ts
export type Features = {
  team: boolean
  export: boolean
  settings: boolean
  analytics: boolean  // paid
  invoicing: boolean  // paid
  activity: boolean   // paid
}
```

**Storage:** `tenants.features` JSONB. Missing keys read as `false` — safe default for paid features.

**Superadmin toggles them at:** `/superadmin/tenants/[id]` → **Page Visibility** panel. Paid flags show an amber "Paid" pill (`components/tenant-config-client.tsx`).

**Enforcement — three layers, defense in depth:**

1. **Sidebar visibility** (`components/sidebar.tsx`) — nav items only appear when the flag is on
2. **Page-level redirect** — e.g. `app/dashboard/invoices/page.tsx` redirects to `/dashboard` if `!features.invoicing && !isSuperadmin`
3. **API-level check** — e.g. `app/api/leads/[id]/activity/route.ts` POST returns 403 if the caller's tenant doesn't have `features.activity`

Superadmins bypass all three layers. Every gated feature must implement layer 3, not just layers 1–2.

---

## Custom fields — EAV-lite

Two tables linked by a **string `key`** (not a foreign key):

```
field_definitions (catalog per tenant)     leads.custom_data (data per row)
├── key = "phone_number"        ────►       {"phone_number": "+91 98765 43210",
├── key = "customer_name"       ────►        "customer_name": "Ramesh Kumar",
└── key = "interest_in"         ────►        "interest_in": "SUV"}
```

**Why not a column per field?** ALTER TABLE on every new field means a migration per tenant per new capture form — hundreds of migrations at scale.

**Why not a table per tenant?** Cross-tenant queries (superadmin drill-down) become dynamic SQL, RLS gets clunky, migrations multiply.

**Why not full EAV (row per field per lead)?** Slow (JOINs everywhere), and JSONB gives you the same flexibility with much better ergonomics.

**What we get for free:**
- Adding a field is `INSERT INTO field_definitions` — zero DDL
- Renamed field labels don't break existing leads (only `key` matters)
- Deleted fields don't lose data — it just stops rendering
- Two tenants with the same key are fully isolated by `tenant_id`

**Scale ceiling:** client-side filter evaluation is fine to ~10k leads/tenant. Beyond that, add a GIN index (`CREATE INDEX leads_custom_data_gin ON leads USING gin (custom_data jsonb_path_ops);`) and push filters into the query.

**Read the full walkthrough:** [`db/SCHEMA.md`](../db/SCHEMA.md#3-custom-fields--the-eav-lite-pattern).

---

## Filter model — one evaluator, two runtimes

**Type:** `LeadFilter = { conditions: FilterCondition[] }` — AND semantics only (no OR yet).

**Defined in:** `lib/filters.ts`.

**Runs client-side:** `applyFilter(leads, filter)` inside `components/leads-table.tsx` for the interactive table.

**Runs server-side:** the same `applyFilter()` inside `app/api/export/route.ts`. This guarantees the CSV matches exactly what's on screen — no divergence.

**Available fields:** built-ins (`status`, `created_at`) + all active `field_definitions` for the tenant. Operators are chosen per field type via `operatorsForType()`.

**Serialization:** `serializeFilter()` → URL-safe encoded JSON. Used to carry the filter to `/api/export?filter=…`.

**Saved views** (`public.saved_views`) store this filter shape verbatim in a `jsonb` column, per user per tenant.

---

## Activity log — auto vs. manual

Table: `public.lead_activity`. Six kinds:

| Kind | Trigger | Author |
|---|---|---|
| `status_change` | `PATCH /api/leads/[id]` if status changed | The PATCH caller |
| `assigned` | Same PATCH, or `POST /api/leads/[id]` with `action:'assign'` | The caller |
| `follow_up_set` | Same PATCH if follow_up_at changed | The caller |
| `edited` | Same PATCH if custom_data changed | The caller |
| `created` | Reserved (not yet inserted) | — |
| `note` | `POST /api/leads/[id]/activity` — manual | Human |

**Key nuance:** auto-events log for **all** tenants regardless of `features.activity`. That way when a free-tier tenant upgrades, their history is already there. Only manual notes are paywalled.

**UI:** `components/lead-edit-modal.tsx` renders the timeline in the Activity tab. Tab hidden when `features.activity` is off.

---

## Invoicing — snapshotted seller, JSONB items, print-CSS PDF

### Table shape
See `public.invoices` in [`db/SCHEMA.md`](../db/SCHEMA.md#invoices).

### Snapshot pattern
Seller name / GSTIN / address are **copied** onto the invoice row at creation. Later edits to `tenants.gstin` don't rewrite historical invoices — legally correct behaviour, since a tax invoice is a snapshot of the moment.

### Invoice number
Format: `INV/YYYY-YY/NNNN` — Indian fiscal year (Apr–Mar). Counter is per-tenant per-FY, generated at INSERT time via a `COUNT(*)` filter on `invoice_number LIKE 'INV/{fy}/%'`. Not race-safe under high concurrency, but acceptable for SMB scale.

### GST math
- Intra-state: `CGST = SGST = gst_rate / 2`. Half rounding is absorbed by SGST so `subtotal + cgst + sgst === total` exactly.
- Inter-state (`inter_state = true`): full `gst_rate` becomes IGST, CGST/SGST are 0.

### Line items
JSONB `items` — `[{ description, hsn, qty, rate, amount }]`. Same rationale as custom fields: schema-free per-invoice, no JOIN table.

### PDF generation
```
User clicks "Download PDF" or "Print"
   ▼
window.print()
   ▼
Browser print dialog opens
   ▼
@media print CSS in app/globals.css:
  • hides sidebar/header/nav
  • strips margins on #invoice-print-area
  • sets @page { size: A4; margin: 12mm; }
   ▼
User picks "Save as PDF" or a real printer.
```

The tab title is temporarily set to the invoice number, so the saved PDF file inherits that name.

### GSTIN validation
Regex enforced server-side in `app/api/tenant/gst/route.ts`:
`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$`

15 chars: 2 state + 5 letter + 4 digit + 1 letter + 1 alnum + Z + 1 alnum.

### Lead → invoice prefill
`/dashboard/invoices/new?lead=<id>` sniffs common `custom_data` keys (`name` / `full_name` / `phone` / `mobile` / `email` / etc.) and pre-fills the buyer form. The lead ID is stored on `invoices.lead_id` for future report/reference.

---

## Dark mode

**Toggle:** `components/theme-toggle.tsx` — flips a `.dark` class on `<html>` and persists to `localStorage`.

**Tokens:** `app/globals.css`
```css
@custom-variant dark (&:where(.dark, .dark *));

:root { --background: #f9fafb; --foreground: #111827; ... }
.dark { --background: #0b0f17; --foreground: #e5e7eb; ...; color-scheme: dark; }
```

**Pre-hydration script:** `app/layout.tsx` uses `next/script` with `strategy="beforeInteractive"` to check `localStorage.theme` (or `prefers-color-scheme`) *before* React mounts — so the initial paint matches the saved preference (no FOUC).

**Coverage:** Full dark styling on the app chrome (sidebar, headers, forms, cards). Print CSS forces white background regardless of theme.

---

## Gotchas we've already hit

Documented here so we don't repeat them.

### Legacy tables
`field_definitions` and `tenant_users` predate the current schema files. `CREATE TABLE IF NOT EXISTS` is a **silent no-op** when the table exists — it does NOT add missing columns. When extending these tables, always use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (see `phase3.sql`).

### Next.js 16 / React 19 patterns
1. **`middleware.ts` → `proxy.ts`** with function name `proxy`.
2. **`Date.now()` in a component body** → `react-hooks/purity` lint error. Extract to a plain function outside the component.
3. **`setState` inside `useEffect`** → `react-hooks/set-state-in-effect` error. Use `useState(() => value)` lazy initialisers.
4. **`useSearchParams()`** requires a `<Suspense>` boundary at the page level — otherwise build fails.
5. **Page vs. route-handler signatures**: pages take `{ params }` as props (params is a Promise); route handlers take `(req, ctx)`. Mixing them fails typecheck with "Target signature provides too few arguments."
6. **`RouteContext<'…'>`** is a generated type — only knows routes that already exist on disk when tsc runs. For brand-new route.ts files, use an inline `{ params: Promise<{ id: string }> }` until tsc regenerates.
7. **Inline `<script>` in a React component** warns in React 19. For pre-hydration code, use `next/script` with `strategy="beforeInteractive"` inside `<body>` — Next.js hoists it into `<head>` server-side.

### Invite email flow
Supabase Dashboard's "Invite a user" uses **OTP** (`token_hash` + `type`), while our API's `inviteUserByEmail` uses **PKCE** (`code`). `app/auth/callback/route.ts` handles both — don't remove either branch.
