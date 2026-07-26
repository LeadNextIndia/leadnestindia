# Features

Every feature the app ships, with the exact files that implement it. Use this as a click-through map when you need to change or extend something.

**Legend:** 🟢 Core (all tenants) · 🔵 **Paid** (per-tenant feature flag)

---

## Table of contents

- [Lead dashboard](#lead-dashboard) 🟢
- [Custom fields](#custom-fields) 🟢
- [Roles & invites](#roles--invites) 🟢
- [Assignment & follow-ups](#assignment--follow-ups) 🟢
- [CSV export](#csv-export) 🟢
- [Analytics bundle](#analytics-bundle) 🔵
- [GST invoicing](#gst-invoicing) 🔵
- [Notes & activity timeline](#notes--activity-timeline) 🔵
- [Dark mode](#dark-mode) 🟢
- [Superadmin platform](#superadmin-platform) 🟢
- [Row-Level Security](#row-level-security) 🟢

---

## Lead dashboard 🟢

The core view: every customer inquiry for a tenant, in a searchable, filterable table with KPI cards on top.

**What users can do:**
- See total / this-week / new / won / lost counts (KPI cards)
- Search across all custom_data (client-side)
- Filter by status via quick pills
- See per-user follow-up counts (amber banner) when there are overdue or due-today items
- Click **Edit** on any row to open the details modal (admin/superadmin)
- Click **New Lead** to add one

**Files:**
| File | Role |
|---|---|
| `app/dashboard/page.tsx` | Server component — fetches leads, field defs, members, saved views, tenant features |
| `components/leads-table.tsx` | Client — search, quick filters, status pills, "My leads" pills, table render |
| `components/kpi-card.tsx` | Small stat card used above the table |
| `app/dashboard/new/page.tsx` | New lead form (renders one input per active field definition) |

**DB tables:** `leads`, `field_definitions`, `tenant_users` (for the assignee dropdown).

---

## Custom fields 🟢

Per-tenant capture schema. Each company gets its own set of fields defined by the founder. See [`ARCHITECTURE.md`](./ARCHITECTURE.md#custom-fields--eav-lite) for the EAV-lite explanation.

**What superadmin can do (only superadmin, via `/superadmin/tenants/[id]`):**
- Add a field with label, type (`text` / `number` / `email` / `tel` / `date` / `select` / `textarea`), required flag, options (for select)
- Auto-generates the `key` from the label (`Phone Number` → `phone_number`)
- Inline-edit label / type / required / options / active
- Delete a field (old lead data survives in JSONB — just stops rendering)

**Files:**
| File | Role |
|---|---|
| `app/superadmin/tenants/[tenantId]/page.tsx` | Server component — loads tenant + fields |
| `components/tenant-config-client.tsx` | Add / edit / delete field UI (also handles feature visibility toggles) |
| `app/api/superadmin/tenant/[tenantId]/fields/route.ts` | POST — auto-generates key, computes sort_order |
| `app/api/superadmin/tenant/[tenantId]/fields/[fieldId]/route.ts` | PATCH + DELETE |

**DB table:** `field_definitions`. `UNIQUE (tenant_id, key)`.

---

## Roles & invites 🟢

Three-tier role model (see [`ARCHITECTURE.md`](./ARCHITECTURE.md#role-model)) with real email invites.

**What admins can do:**
- Invite teammates by email (admin or user role)
- Change a user's role (admin ↔ user)
- Remove users
- Last-admin protection: can't remove or demote the only admin

**How the invite works:**
1. Admin POSTs email + role
2. Server checks if the email already has an `auth.users` row — if yes, upsert into `tenant_users` and done
3. Otherwise, `supabase.auth.admin.inviteUserByEmail(email, { data: { tenant_id, role } })` sends an email
4. Invitee clicks link → `/auth/callback` → `/auth/set-password` → `/dashboard`
5. `on_auth_user_created_invite` trigger auto-creates the `tenant_users` row from `raw_user_meta_data`

**Files:**
| File | Role |
|---|---|
| `app/dashboard/team/page.tsx` | Team members list (admin-only) |
| `components/team-page-client.tsx` | Invite form + role change + remove UI |
| `app/api/team/invite/route.ts` | POST — sends invite or upserts existing user |
| `app/api/team/role/route.ts` | POST — change a member's role |
| `app/api/team/remove/route.ts` | POST — remove a member |
| `app/auth/callback/route.ts` | Handles PKCE + OTP flows |
| `app/auth/set-password/page.tsx` | First-time password set |
| `lib/authz.ts` | Session helpers |

**DB tables:** `tenant_users`, `auth.users` (via Supabase Auth).

---

## Assignment & follow-ups 🟢

Assign leads to specific team members and track when to follow up.

**What everyone can do:**
- See the "Assigned" column on the table
- See a color-coded "Follow-up" badge (red=overdue, amber=today, plain=upcoming)
- Filter to "My leads" / "Unassigned" / "Everyone" via pill row
- See their own overdue + due-today count in the amber banner over the KPIs
- **Self-assign** (any user) via the edit modal

**What admins can additionally do:**
- Assign any team member from the edit modal dropdown
- Change the follow-up date

**Files:**
| File | Role |
|---|---|
| `components/lead-edit-modal.tsx` | Assign-to dropdown + Follow-up date picker in Details tab |
| `components/leads-table.tsx` | Assigned column, Follow-up badge, "My leads / Unassigned" pill row |
| `app/api/leads/[id]/route.ts` | PATCH accepts `assigned_to` + `follow_up_at`; POST `action:'assign'` for self-assign (bypasses admin gate) |
| `app/dashboard/page.tsx` | Computes overdue + due-today counts for the banner |

**DB columns:** `leads.assigned_to` (FK to `auth.users`), `leads.follow_up_at`.

---

## CSV export 🟢

One-click download of all leads (or the current filter) as CSV. Gated by `features.export`.

**What users get:**
- Everything visible in the current filter set (client-side filter is serialized and re-applied server-side)
- All custom fields as columns
- One row per lead, standard `Content-Disposition: attachment`

**Files:**
| File | Role |
|---|---|
| `app/api/export/route.ts` | GET — reads leads, applies filter from `?filter=…`, streams CSV |
| `lib/filters.ts` | `parseFilter()` + `applyFilter()` — same evaluator as client-side |

---

## Analytics bundle 🔵

**Feature flag:** `features.analytics`. Off by default (paid).

Enables three tightly-integrated things on the Leads dashboard:

### Charts
- **Status pie** — distribution of current leads by status
- **Last 14 days line** — new leads per day
- **Status bar** — alternate breakdown
- All three respect the current filter and update live
- Toggle via **Show / Hide charts** button

### Advanced filter builder
- Add any number of AND-ed conditions on any active field
- Operators adapt to field type: text (`contains`/`equals`/`is empty`), number (`>`/`<`/`≥`/`≤`), date (`before`/`after`/`between`), select/status (`is`/`is one of`)
- Live-applied to the table + charts

### Saved views
- Save the current filter as a named view (per-user)
- Reload with one click from the dropdown
- Delete when done

**Files:**
| File | Role |
|---|---|
| `components/leads-charts.tsx` | Recharts pie/line/bar |
| `components/leads-filter-builder.tsx` | Multi-condition filter UI |
| `components/saved-views-menu.tsx` | Saved-view selector + save modal |
| `lib/filters.ts` | Types + evaluator (shared client/server) |
| `app/api/saved-views/route.ts` | GET (list mine), POST (create) |
| `app/api/saved-views/[id]/route.ts` | DELETE |

**DB tables:** `saved_views`.

---

## GST invoicing 🔵

**Feature flag:** `features.invoicing`. Off by default (paid).

GST-compliant tax invoice generation from any lead, with print / PDF output.

### What admins can do
- Configure company GST details (GSTIN, address, state, state code, default GST rate, default HSN) — once
- Generate a new invoice from any lead (Generate button in edit modal) or from scratch
- Add line items (description, HSN/SAC, qty, rate — amount auto-calculated)
- Set the GST rate per invoice (defaults to tenant's default, editable)
- Toggle "Inter-state sale" to switch from CGST+SGST to IGST
- View, print, and download as PDF (browser's Save-as-PDF)
- Edit or delete an invoice

### Invoice format
Follows Indian GST requirements:
- Seller info (name, GSTIN, state, address) — **snapshotted at creation**
- Buyer info (name, GSTIN if any, phone, email, address, state)
- Invoice number (`INV/YYYY-YY/NNNN` — Indian FY)
- Invoice date
- Itemised table with HSN/SAC, qty, rate, amount
- Subtotal, CGST+SGST (intra-state) or IGST (inter-state), Total
- Amount in words (Indian format — Lakh, Crore)
- Notes / signature area

### PDF generation
Zero-dependency: `window.print()` + print-CSS in `app/globals.css` hides all chrome, then user picks "Save as PDF" from the browser dialog. Tab title is temporarily set to the invoice number so the saved file inherits that name.

**Files:**
| File | Role |
|---|---|
| `lib/invoice.ts` | Types, GST math, invoice-number generation, INR formatting, number-to-words |
| `components/gst-config-form.tsx` | Company GST details (admin) |
| `components/invoice-editor.tsx` | Line-items editor + live totals |
| `components/invoice-preview.tsx` | Print-ready A4 invoice layout |
| `components/print-buttons.tsx` | Print / Download PDF button (sets tab title too) |
| `app/dashboard/invoices/page.tsx` | List page (with GST config prompt if not set) |
| `app/dashboard/invoices/new/page.tsx` | New invoice — optionally prefilled from `?lead=<id>` |
| `app/dashboard/invoices/[id]/page.tsx` | View — renders `InvoicePreview` + print buttons |
| `app/api/invoices/route.ts` | GET (list), POST (create — generates invoice number) |
| `app/api/invoices/[id]/route.ts` | GET, PATCH, DELETE |
| `app/api/tenant/gst/route.ts` | PATCH — admin updates company GST config |
| `app/api/superadmin/tenant/[tenantId]/features/route.ts` | PATCH — accepts `invoicing` flag |
| `app/globals.css` (print block) | `@media print` — A4 sizing, hides chrome |

**DB tables:** `invoices`, plus GST columns on `tenants` (`gstin`, `company_address`, `state`, `state_code`, `gst_rate`, `default_hsn`).

---

## Notes & activity timeline 🔵

**Feature flag:** `features.activity`. Off by default (paid).

Every lead gets a reverse-chronological timeline of what happened to it.

### Auto-logged events (all tenants — not gated)
Any PATCH to a lead logs one row per change:
- `status_change` (metadata: `{from, to}`)
- `assigned` (metadata: `{from, to}` — user IDs)
- `follow_up_set` (metadata: `{from, to}` — dates)
- `edited` (any custom_data change)

Why unconditional? So free-tier tenants have complete history the moment they upgrade — no data-loss cliff.

### Manual notes (paid)
- Users can add free-form notes on any lead
- Server enforces `features.activity` on POST — free tier gets a 403
- Notes are visible to everyone in the tenant (there's no private-note concept yet)

**Files:**
| File | Role |
|---|---|
| `components/lead-edit-modal.tsx` | Details + Activity tabs; note textarea; timeline render |
| `app/api/leads/[id]/activity/route.ts` | GET (list), POST (add note — gated by feature flag) |
| `app/api/leads/[id]/route.ts` | Auto-inserts activity rows on PATCH diffs |

**DB table:** `lead_activity` (kinds: `note`, `status_change`, `assigned`, `follow_up_set`, `edited`, `created`).

---

## Dark mode 🟢

Manual toggle in every header (dashboard + superadmin).

**What it does:**
- Flips `class="dark"` on `<html>`
- Persists to `localStorage.theme`
- Uses CSS variables (`--background`, `--surface`, `--surface-muted`, `--border`, `--text-muted`) that switch based on the class
- Pre-hydration script prevents FOUC on refresh (via `next/script` with `strategy="beforeInteractive"`)

**Files:**
| File | Role |
|---|---|
| `components/theme-toggle.tsx` | Sun/moon button that flips the class |
| `app/globals.css` | `@custom-variant dark`, variable definitions |
| `app/layout.tsx` | Pre-hydration script |

Every layout surface has explicit `dark:` variants. Page interiors mostly rely on the CSS variables so they adapt automatically.

---

## Superadmin platform 🟢

Founder-only pages. Every route under `/superadmin/**` requires `requireSuperadmin()`.

**What superadmin can do:**
- **Onboard a company** via `/superadmin` → "Onboard company" — creates tenant + invites first admin
- **Drill into any tenant** via `/superadmin/tenants/[id]`:
  - See member list (email, role, join date)
  - Add / edit / delete custom fields
  - Toggle feature flags (with Paid pills on premium ones)
  - See tenant stats (member count, admin count, lead count, onboarded date)
- **Bypass all feature flags** — every gated feature checks `isSuperadmin` and grants access

**Files:**
| File | Role |
|---|---|
| `app/superadmin/layout.tsx` | Superadmin-only chrome (uses `requireSuperadmin`) |
| `app/superadmin/page.tsx` | Tenants list |
| `components/superadmin-page-client.tsx` | Onboard-company form + tenant table |
| `app/superadmin/tenants/[tenantId]/page.tsx` | Per-tenant drill-down (members + fields + features + stats) |
| `components/tenant-config-client.tsx` | Field editor + Page Visibility toggles |
| `app/api/superadmin/onboard/route.ts` | POST — creates tenant + invites admin |
| `app/api/superadmin/tenant/[tenantId]/fields/*` | Field CRUD |
| `app/api/superadmin/tenant/[tenantId]/features/route.ts` | PATCH — toggle feature flags |

**DB tables:** `superadmins`, plus reads/writes across every other table.

**Bootstrap:** after your first sign-in, run once in Supabase SQL editor:
```sql
INSERT INTO public.superadmins (user_id)
SELECT id FROM auth.users WHERE email = 'your@email';
```

---

## Row-Level Security 🟢

Every table with tenant-scoped data has RLS enabled. Two helper functions drive most policies:

- `is_superadmin(uid) → boolean`
- `tenant_role(uid, tid) → text`

See the full policy matrix in [`db/SCHEMA.md`](../db/SCHEMA.md#4-row-level-security-rls).

**Why it matters:** even if an API bug leaks a cross-tenant query, RLS at the DB blocks it. Every feature relies on this — no application-level filtering is trusted alone.

**Bypassed by:** the service-role client (`lib/supabase/admin.ts`), used in API routes AFTER the caller's session + permissions have been verified.

---

## Anti-features (deliberately not built yet)

Documented so we don't accidentally add them:

- **Full dashboard builder** (drag-drop widgets) — massive scope; existing charts cover 80% of value
- **Field-level permissions** (per-role visible fields) — with 2 roles, over-engineering
- **Server-side PDF generation** — browser print + Save-as-PDF is identical quality, zero dependency
- **Email/SMS lead notifications** — belongs after public capture form exists (nothing to notify on today)
- **Billing/subscription integration** (Razorpay/Stripe) — feature-flag toggle scales to your first ~20 paying customers
