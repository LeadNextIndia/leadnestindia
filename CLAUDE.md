@AGENTS.md

# LeadNestIndia — Project Context

## What this is
A multi-tenant SaaS lead-management platform for small Indian businesses. Each customer company
("tenant") gets an isolated dashboard to capture, view, filter, and export leads.
The founder (platform superadmin) onboards new companies from a dedicated `/superadmin` UI.

## Tech stack
- **Next.js 16.2.11** with App Router + Turbopack (`middleware.ts` is now called `proxy.ts`)
- **React 19** — new lint rules (`react-hooks/purity`, `react-hooks/set-state-in-effect`) are active
- **Supabase** — auth (email invite flow), Postgres DB, Row-Level Security
- **Tailwind CSS v4** — no `tailwind.config.js`; tokens live in `globals.css`
- **TypeScript strict**

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
- `tenants` — id, name, created_at, created_by
- `tenant_users` — user_id, tenant_id, role ('admin'|'user'), email, created_at. UNIQUE(user_id, tenant_id)
- `leads` — id, tenant_id, status, custom_data (jsonb), source, created_at
- `field_definitions` — tenant_id, key, label, type, required, options, active, sort_order
- `superadmins` — user_id (PK)

RLS is enabled on all five tables. DB helper functions: `is_superadmin(uid)`, `tenant_role(uid, tid)`, `get_user_id_by_email(email)`.

Trigger `on_auth_user_created_invite` fires on `auth.users` INSERT: reads `raw_user_meta_data.tenant_id` + `.role` (set by `inviteUserByEmail`) and auto-inserts into `tenant_users`.

Migration file: `db/phase2.sql` — run once in Supabase SQL editor.

## Auth / invite flow
1. Superadmin → `/superadmin` → "Onboard company" → POST `/api/superadmin/onboard`
2. Route creates `tenants` row + calls `supabase.auth.admin.inviteUserByEmail` with `data: { tenant_id, role: 'admin' }`
3. Invitee clicks email link → `/auth/callback` (route handler)
4. Callback handles PKCE (`?code=`) or OTP (`?token_hash=&type=`) → redirects to `/auth/set-password`
5. User sets password → `/dashboard`
6. Company admin repeats for employees via `/dashboard/team` → POST `/api/team/invite`

Password reset / first-time: `/login` "Forgot / first time?" link → `resetPasswordForEmail` → same callback → `/auth/set-password`.

**Required Supabase Dashboard settings:**
- Auth → URL Configuration → Site URL: `http://localhost:3000` (prod: your domain)
- Auth → URL Configuration → Redirect URLs: add `http://localhost:3000/auth/callback`

## Superadmin bootstrap (one-time, after first sign-in)
```sql
INSERT INTO public.superadmins (user_id)
SELECT id FROM auth.users WHERE email = 'kirankumar.kendre@cashfree.com'
ON CONFLICT (user_id) DO NOTHING;
```

## Key files
```
proxy.ts                              ← auth redirect guard (Next.js 16 name for middleware)
lib/authz.ts                          ← getSession / requireAdmin / requireSuperadmin
lib/supabase/server.ts                ← SSR Supabase client
lib/supabase/admin.ts                 ← service-role client (bypasses RLS, server-only)
lib/supabase/client.ts                ← browser Supabase client
components/sidebar.tsx                ← role-aware nav (accepts role + isSuperadmin props)
components/team-page-client.tsx       ← invite / role-change / remove UI
components/superadmin-page-client.tsx ← onboard company UI
app/dashboard/layout.tsx              ← session gate + limbo page if no tenant
app/dashboard/team/page.tsx           ← admin-gated, fetches members server-side
app/superadmin/layout.tsx             ← superadmin-gated layout
app/superadmin/page.tsx               ← all tenants list
app/auth/callback/route.ts            ← PKCE + OTP code exchange
app/auth/set-password/page.tsx        ← invitees set password here
app/api/team/invite/route.ts          ← POST, admin-only
app/api/team/role/route.ts            ← POST, admin-only
app/api/team/remove/route.ts          ← POST, admin-only
app/api/superadmin/onboard/route.ts   ← POST, superadmin-only
```

## Phases completed
- **Phase 1**: Login page, dashboard layout + sidebar, KPI cards, leads table (filterable/searchable), new-lead form, CSV export, placeholder pages
- **Phase 2**: 3-tier roles (superadmin/admin/user), RLS on all tables, email invite flow, `/superadmin`, `/dashboard/team` live, role-aware sidebar, `/auth/callback` + `/auth/set-password`

## Phase 3 backlog (not yet built)
- Custom field management UI (Fields page — currently "Soon")
- Filtered CSV export (by status, date range, field values)
- Per-tenant reports / charts (lead volume over time, status breakdown)
- Superadmin: drill into a specific tenant's leads

## React 19 lint rules to watch
- `Date.now()` inside a component → extract to a plain function defined outside the component
- `setState()` directly in `useEffect` body → initialise with lazy state: `useState(() => value)`
- `useSearchParams()` → must be inside a child component wrapped with `<Suspense>` at the page level
