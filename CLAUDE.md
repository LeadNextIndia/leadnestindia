@AGENTS.md

# LeadNestIndia — Project Context

## What this is
A multi-tenant SaaS lead-management platform for small Indian businesses. Each customer company
("tenant") gets an isolated dashboard to capture, view, filter, and export leads.
The founder (platform superadmin) onboards new companies from a dedicated `/superadmin` UI.

Public marketing site lives at `/` (server component). Signed-in users are redirected to
`/dashboard`; signed-out visitors see the landing page.

## Tech stack
- **Next.js 16.2.11** with App Router + Turbopack (`middleware.ts` is now called `proxy.ts`)
- **React 19** — new lint rules (`react-hooks/purity`, `react-hooks/set-state-in-effect`) are active
- **Supabase** — auth (email invite flow), Postgres DB, Row-Level Security
- **Tailwind CSS v4** — no `tailwind.config.js`; tokens live in `globals.css`
- **TypeScript strict**
- **Deployment:** Vercel (production = `main` branch; preview = every other branch)

## .env.local keys
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY     ← required for invite / admin API routes
```

## Role model (3 levels)
| Role | Stored in | Can do |
|---|---|---|
| `superadmin` | `public.superadmins` table | Onboard tenants, see all data |
| `admin` | `tenant_users.role = 'admin'` | Invite/remove users, manage fields, edit/delete leads, export CSV |
| `user` | `tenant_users.role = 'user'` | Add leads, view own tenant's leads only |

## Database schema (key tables)
- `tenants` — id, name, created_at, created_by, features (jsonb), gstin, gst_rate, state_code, display_name, background_path, layout_config (jsonb — per-tenant leads-page section order + visibility)
- `tenant_users` — user_id, tenant_id, role ('admin'|'user'), email, created_at. UNIQUE(user_id, tenant_id)
- `leads` — id, tenant_id, status, custom_data (jsonb), source, assigned_to, follow_up_at, created_at, **module_key** (phase 9 — which lead module the row belongs to)
- `field_definitions` — tenant_id, key, label, type, required, options, active, sort_order
- `lead_modules` — id, tenant_id, slug, singular, plural, icon, sort_order, is_default, active (phase 9 — configurable Lead-like modules per tenant, e.g. Walk-in, Online Inquiry)
- `module_fields` — module_id, field_id, label_override, required_override, sort_order, visible (phase 9 — per-module override on the tenant's field catalog)
- `module_statuses` — module_id, key, label, color, sort_order, is_default, is_terminal (phase 10 — configurable pipeline states per module; replaces the hardcoded lead status enum)
- `superadmins` — user_id (PK)
- `lead_activity` — id, tenant_id, lead_id, user_id, kind, body, metadata, created_at
- `saved_views` — id, tenant_id, user_id, name, filter (jsonb)
- `user_column_prefs` — user_id, tenant_id, view_key (e.g. 'module:<slug>'), visible_fields text[]
- `invoices` — id, tenant_id, lead_id, invoice_number, invoice_date, seller/buyer, items (jsonb), gst amounts
- `support_tickets`, `user_creation_requests`, `audit_log` — phase 7 additions

RLS is enabled on all tenanted tables. DB helper functions: `is_superadmin(uid)`, `tenant_role(uid, tid)`, `get_user_id_by_email(email)`.

Trigger `on_auth_user_created_invite` fires on `auth.users` INSERT: reads `raw_user_meta_data.tenant_id` + `.role` (set by `inviteUserByEmail`) and auto-inserts into `tenant_users`.

Full ER diagram + column-level docs: `db/SCHEMA.md`.

## Migration files (run in order on a fresh Supabase project)
```
db/phase1.sql   ← baseline tables: tenants, tenant_users, field_definitions, leads
db/phase2.sql   ← roles, superadmins, RLS, invite trigger, helper functions
db/phase3.sql   ← per-tenant feature flags, field-definition mgmt
db/phase4.sql   ← saved views
db/phase5.sql   ← assignment, follow-ups, lead_activity timeline
db/phase6.sql   ← GST-compliant invoices
db/phase7.sql   ← branding (display_name + background) + support_tickets +
                  user_creation_requests + user_column_prefs + audit_log +
                  Supabase Storage bucket "branding" with tenant-scoped RLS
db/phase8.sql   ← tenants.layout_config JSONB (reserved) + dashboard / field_labels flags
db/phase9.sql   ← lead_modules + module_fields + leads.module_key
                  (configurable Lead-like modules per tenant; backfills the
                  default "lead" module for every existing tenant)
db/phase10.sql  ← module_statuses (per-module pipeline states) — DROPS the
                  hardcoded CHECK constraint on leads.status; validation
                  moves to the app layer, so tenants can define arbitrary
                  states. Backfills the 5 legacy statuses on the default module.
```
All files are idempotent — safe to re-run. Apply in staging first, then prod.

## Auth / invite flow
1. Superadmin → `/superadmin` → "Onboard company" → POST `/api/superadmin/onboard`
2. Route creates `tenants` row + calls `supabase.auth.admin.inviteUserByEmail` with `data: { tenant_id, role: 'admin' }`
3. Invitee clicks email link → `/auth/callback` (route handler)
4. Callback handles PKCE (`?code=`) or OTP (`?token_hash=&type=`) → redirects to `/auth/set-password`
5. User sets password → `/dashboard`
6. Company admin repeats for employees via `/dashboard/team` → POST `/api/team/invite`

Password reset / first-time: `/login` "Forgot / first time?" link → `resetPasswordForEmail` → same callback → `/auth/set-password`.

**Required Supabase Dashboard settings (per environment):**
- Auth → URL Configuration → Site URL: your deployed URL (localhost for dev)
- Auth → URL Configuration → Redirect URLs: add `<url>/auth/callback` for every env
  (production URL, `https://*.vercel.app/auth/callback` for preview branches, `http://localhost:3000/auth/callback` for local dev)

## Superadmin bootstrap (one-time, per Supabase project, after first sign-in)
```sql
INSERT INTO public.superadmins (user_id)
SELECT id FROM auth.users WHERE email = 'kirankumar.kendre@cashfree.com'
ON CONFLICT (user_id) DO NOTHING;
```

## Deployment (Vercel)
- **Production branch:** `main` — auto-deploys on push
- **Preview:** every other branch/PR → unique `<project>-<hash>.vercel.app` URL per commit
- **Env vars are per-environment.** Set them in Vercel → Settings → Environment Variables.
  For staging + prod split: add each key twice (once for Production, once for Preview+Development)
  with different values pointing to different Supabase projects.
- **Local dev with staging DB:** `vercel env pull .env.local --environment=preview`
- **Rollback:** Vercel → Deployments → any previous green deploy → ⋯ → Promote to Production

## Landing page (`app/page.tsx`)
Server component. `getSession()` → if signed in, `redirect('/dashboard')`; else render marketing.
Contains hero, services grid, feature deep-dives, pricing tiers, testimonial, contact.
**Update `CONTACT` constant at top of file** (email, phone, WhatsApp) — placeholders in commit.
Uses inline SVG mockups (`DashboardMockup`, `InvoiceMockup`, `TeamMockup`) — no external images.

## Key files
```
app/page.tsx                              ← public landing page (server component, auth-aware)
proxy.ts                                  ← auth redirect guard (Next.js 16 name for middleware)
lib/authz.ts                              ← getSession / requireAdmin / requireSuperadmin
lib/supabase/server.ts                    ← SSR Supabase client
lib/supabase/admin.ts                     ← service-role client (bypasses RLS, server-only)
lib/supabase/client.ts                    ← browser Supabase client
lib/features.ts                           ← Features type + defaults (single source of truth for the JSONB shape)
lib/lead-modules.ts                       ← ModuleConfig types + getModuleConfig / listModulesForTenant / listModuleStatuses
                                            (client-safe; takes a supabase client as arg)
lib/lead-modules-server.ts                ← serverGetModuleConfig / serverListModules — server-only convenience wrappers
                                            (kept separate so client bundles don't drag in next/headers)
lib/layout-config.ts                      ← per-tenant leads-page section config (types + withLayoutDefaults + SECTION_META)

components/sidebar.tsx                    ← role-aware nav, dynamic module list, drag-reorderable in superadmin
components/kpi-card.tsx                   ← accent-bar KPI tile with hover-lift (post-UI-refresh)
components/lead-form.tsx                  ← module-aware form; loads module_fields, sets default status on insert
components/new-lead-button.tsx            ← gradient pill button, module-aware label
components/leads-table.tsx                ← table view (respects columnViewKey, module statuses, exportHrefBase)
components/lead-board.tsx                 ← kanban view (@dnd-kit, columns = module_statuses, drag → PATCH status)
components/lead-edit-modal.tsx            ← detail/activity tabs; status dropdown reads module_statuses
components/modules-admin-client.tsx       ← superadmin CRUD for lead_modules, drag-reorder rows (@dnd-kit)
components/module-fields-editor.tsx       ← per-module field picker + label overrides + inline "new field" form
components/module-statuses-editor.tsx     ← per-module status designer (label / color / default / terminal)
components/leads-page-sections-editor.tsx ← per-tenant leads-page section drag-reorder + visibility
components/lead-module-provider.tsx       ← LeadModuleContext (module singular/plural/fields/statuses for children)
components/loading-spinner.tsx            ← LoadingSpinner + FullPageSpinner (used by loading.tsx files)
components/tenant-config-client.tsx      ← superadmin: field editor + Page Visibility (feature flags)

app/dashboard/layout.tsx                  ← session gate, fetches modules + branding, renders shell
app/dashboard/page.tsx                    ← redirects to /dashboard/m/<default-slug>
app/dashboard/new/page.tsx                ← redirects to /dashboard/m/<default-slug>/new (legacy)
app/dashboard/m/[slug]/layout.tsx         ← resolves module by slug, wraps children in LeadModuleProvider
app/dashboard/m/[slug]/page.tsx           ← records list — renders sections in tenant's layout_config order
app/dashboard/m/[slug]/new/page.tsx       ← module-aware "New <Singular>" form
app/dashboard/m/[slug]/board/page.tsx     ← kanban view (paid, features.kanban)
app/dashboard/{loading,m/[slug]/loading}.tsx ← route-level suspense spinners
app/dashboard/team/page.tsx               ← admin-gated
app/dashboard/fields/page.tsx             ← custom-field management (admin)
app/dashboard/invoices/                   ← invoice list + create + detail (paid)
app/dashboard/settings/page.tsx           ← tenant branding + support tickets

app/superadmin/layout.tsx                 ← superadmin-gated
app/superadmin/page.tsx                   ← all tenants list
app/superadmin/tenants/[tenantId]/page.tsx
                                          ← per-tenant drill-down: fields, features, modules,
                                            records-page layout
app/superadmin/tenants/[tenantId]/modules/[slug]/fields/page.tsx
                                          ← per-module field picker (superadmin-only)
app/superadmin/tenants/[tenantId]/modules/[slug]/statuses/page.tsx
                                          ← per-module status designer (superadmin-only)
app/superadmin/{loading,tenants/[tenantId]/loading}.tsx ← route-level spinners

app/api/modules/route.ts                  ← GET (list, all users) + POST (create, superadmin)
app/api/modules/[id]/route.ts             ← PATCH / DELETE (superadmin)
app/api/modules/[id]/fields/route.ts      ← GET + PUT resolved field set (superadmin)
app/api/modules/[id]/statuses/route.ts    ← GET + PUT status list (superadmin)
app/api/modules/reorder/route.ts          ← POST bulk sort_order update (superadmin)
app/api/superadmin/tenant/[tenantId]/layout/route.ts
                                          ← GET / PATCH tenants.layout_config (superadmin)
app/api/leads/[id]/route.ts               ← PATCH (admin) + POST (self-assign, any tenant member)
app/api/export/route.ts                   ← module-scoped CSV (?module=<slug>)
app/api/team/*                            ← invite / role / remove (admin)
app/api/superadmin/onboard/route.ts       ← POST create tenant + admin invite (superadmin)
```

## Feature status
Built and shipped:
- Multi-tenant auth + 3-tier roles with RLS
- Email-invite onboarding (superadmin → company admin → employees)
- Records dashboard (KPIs, searchable/filterable table, saved views)
- New-record form + edit modal with activity timeline
- Custom fields per tenant (`/dashboard/fields`)
- Assignment + follow-up dates
- GST-compliant invoicing (`/dashboard/invoices`)
- Per-tenant feature flags (paid-feature gating)
- CSV export (module-scoped, resolved-label headers)
- Public marketing landing page at `/`

Metadata-driven platform layer (phases 9–10 + UI polish):
- **Configurable lead modules** per tenant (`lead_modules`) — rename "Lead" to
  anything (Walk-in, Online Inquiry, etc.), enable more than one via the paid
  `multi_modules` flag. Sidebar renders one entry per active module.
- **Per-module field selection + label overrides** via `module_fields`. Inline
  "New field" form on the fields editor pushes into both `field_definitions`
  (the catalog) and `module_fields` in one flow.
- **Per-module statuses** via `module_statuses`. Superadmin defines label,
  color (9 options), sort order, one default, terminal flag. `leads.status`
  CHECK constraint dropped in phase 10 — validation now app-side.
- **Drag-and-drop sidebar menu reorder** (`@dnd-kit`) — updates `lead_modules.sort_order`.
- **Drag-and-drop records-page layout builder** — reorder / hide the 5 sections
  (header, follow_up_banner, kpi_strip, duplicate_hint, leads_table). Stored in
  `tenants.layout_config`.
- **Kanban board view** (paid `kanban` flag) — `/dashboard/m/[slug]/board`.
  Columns come from module_statuses. Drag-across-columns triggers a PATCH to
  update the lead's status (optimistic, rolls back on error). Reuses the same
  filter builder + saved views as the table view.
- **UI refresh** — brand gradient utility classes in `globals.css`
  (`.brand-gradient`, `.brand-text`), sticky glassy header, rounded-2xl cards,
  pill-shaped buttons, subtle hover lift, softer focus rings, custom scrollbar.
- **Route-level loading spinners** via Next.js `loading.tsx` at
  `/dashboard`, `/dashboard/m/[slug]`, `/superadmin`, `/superadmin/tenants/[tenantId]`.

Access model
- Module management (create/rename/reorder/statuses/fields/layout) is
  **superadmin-only**. Tenant admins consume the metadata but cannot edit it.
- All metadata write APIs use `requireSuperadmin`; reads use `requireSession`
  (any tenant member can list their own tenant's modules for the sidebar).

## React 19 lint rules to watch
- `Date.now()` or `new Date()` inside a component body → extract to a plain function defined outside the component (violates `react-hooks/purity`)
- `setState()` directly in `useEffect` body → initialise with lazy state: `useState(() => value)`
- `useSearchParams()` → must be inside a child component wrapped with `<Suspense>` at the page level

## Hydration gotchas
- **Never call `toLocaleDateString()` / `toLocaleString()` with `undefined` locale** — server and client resolve to different defaults (`en-GB` vs `en-US`) causing hydration mismatches. Always pass an explicit locale — this codebase uses `'en-GB'` throughout (matches Indian date convention `26 Jul 2026`).
- Same rule for `toLocaleTimeString`, `Intl.NumberFormat`, currency formatting, etc.
- Cause of past bug: `components/leads-table.tsx`, `lead-edit-modal.tsx`, `team-page-client.tsx` used `undefined` locale → console-error hydration mismatch → fixed by pinning to `'en-GB'`.
