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
- `tenants` — id, name, created_at, created_by, features (jsonb), gstin, gst_rate, state_code, etc.
- `tenant_users` — user_id, tenant_id, role ('admin'|'user'), email, created_at. UNIQUE(user_id, tenant_id)
- `leads` — id, tenant_id, status, custom_data (jsonb), source, assigned_to, follow_up_at, created_at
- `field_definitions` — tenant_id, key, label, type, required, options, active, sort_order
- `superadmins` — user_id (PK)
- `lead_activity` — id, tenant_id, lead_id, user_id, kind, body, metadata, created_at
- `saved_views` — id, tenant_id, user_id, name, filter (jsonb)
- `invoices` — id, tenant_id, lead_id, invoice_number, invoice_date, seller/buyer, items (jsonb), gst amounts

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
app/page.tsx                          ← public landing page (server component, auth-aware)
proxy.ts                              ← auth redirect guard (Next.js 16 name for middleware)
lib/authz.ts                          ← getSession / requireAdmin / requireSuperadmin
lib/supabase/server.ts                ← SSR Supabase client
lib/supabase/admin.ts                 ← service-role client (bypasses RLS, server-only)
lib/supabase/client.ts                ← browser Supabase client
components/sidebar.tsx                ← role-aware nav (accepts role + isSuperadmin props)
components/team-page-client.tsx       ← invite / role-change / remove UI
components/superadmin-page-client.tsx ← onboard company UI
app/dashboard/layout.tsx              ← session gate + limbo page if no tenant
app/dashboard/page.tsx                ← main leads view (KPIs + table)
app/dashboard/new/page.tsx            ← new-lead form
app/dashboard/team/page.tsx           ← admin-gated, fetches members server-side
app/dashboard/fields/page.tsx         ← custom-field management (admin)
app/dashboard/invoices/                ← invoice list + create + detail (paid feature)
app/dashboard/settings/page.tsx       ← tenant GST config etc.
app/superadmin/layout.tsx             ← superadmin-gated layout
app/superadmin/page.tsx               ← all tenants list
app/superadmin/tenants/[tenantId]/    ← per-tenant drill-down (fields, features, members)
app/auth/callback/route.ts            ← PKCE + OTP code exchange
app/auth/set-password/page.tsx        ← invitees set password here
app/api/team/invite/route.ts          ← POST, admin-only
app/api/team/role/route.ts            ← POST, admin-only
app/api/team/remove/route.ts          ← POST, admin-only
app/api/superadmin/onboard/route.ts   ← POST, superadmin-only
```

## Feature status
Built and shipped in production:
- Multi-tenant auth + 3-tier roles with RLS
- Email-invite onboarding (superadmin → company admin → employees)
- Lead dashboard (KPIs, searchable/filterable table, saved views)
- New lead form + edit modal with activity timeline
- Custom fields per tenant (`/dashboard/fields`)
- Lead assignment + follow-up dates
- GST-compliant invoicing (`/dashboard/invoices`)
- Per-tenant feature flags (paid-feature gating)
- CSV export
- Public marketing landing page at `/`

## React 19 lint rules to watch
- `Date.now()` or `new Date()` inside a component body → extract to a plain function defined outside the component (violates `react-hooks/purity`)
- `setState()` directly in `useEffect` body → initialise with lazy state: `useState(() => value)`
- `useSearchParams()` → must be inside a child component wrapped with `<Suspense>` at the page level

## Hydration gotchas
- **Never call `toLocaleDateString()` / `toLocaleString()` with `undefined` locale** — server and client resolve to different defaults (`en-GB` vs `en-US`) causing hydration mismatches. Always pass an explicit locale — this codebase uses `'en-GB'` throughout (matches Indian date convention `26 Jul 2026`).
- Same rule for `toLocaleTimeString`, `Intl.NumberFormat`, currency formatting, etc.
- Cause of past bug: `components/leads-table.tsx`, `lead-edit-modal.tsx`, `team-page-client.tsx` used `undefined` locale → console-error hydration mismatch → fixed by pinning to `'en-GB'`.
