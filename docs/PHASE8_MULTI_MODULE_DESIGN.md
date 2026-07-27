# Phase 8 — Multi-vertical SaaS: Module Architecture

**Status:** design proposal — not yet built.
**Purpose:** turn LeadNestIndia into an Odoo/Zoho-style platform where each tenant is provisioned with only the modules they need (Leads, Inventory, Manufacturing, HR, etc.), configured entirely from the superadmin portal — no code changes to onboard a new vertical.

---

## 1. Goals & non-goals

### Goals
- **Config-driven module catalogue** — new modules can be added to the platform without changing route structure or auth logic.
- **Per-tenant module assignment** — superadmin decides which modules a tenant sees. Sidebar, routes, and data are filtered accordingly.
- **Strict data isolation** — a module's tables are still tenant-scoped and locked by RLS. Modules never share tables.
- **Backward compatible** — existing tenants continue to use `/dashboard` for Leads. New URL structure is additive.
- **Small blast radius** — adding a module cannot break any other module.

### Non-goals (for this phase)
- Marketplace or third-party module SDK. Modules are first-party only.
- Per-module billing meters — assume flat subscription for now.
- Migration of leads/invoices data across tenants.
- White-label / theming beyond the branding built in Phase 7b.

---

## 2. Model overview

```
┌──────────────┐          ┌──────────────────┐          ┌───────────────┐
│  modules     │ ───────▶ │  tenant_modules  │ ◀─────── │   tenants     │
│  (catalog)   │  many-   │   (join, config) │   many-  │  (customer)   │
└──────────────┘   to-    └──────────────────┘   to-    └───────────────┘
                  many                          many
                                │
                                ▼
                    module-specific tables
                    (leads, inventory_products,
                     manufacturing_orders, ...)
```

- **`modules`** — static list of what the platform can do. Populated by migrations, not user data.
- **`tenant_modules`** — which tenant has which module enabled, with optional per-tenant config.
- **Module tables** — each module owns its schema. Every table has `tenant_id` and RLS keyed on it.

---

## 3. Data model

### 3.1 `modules` (catalog)

```sql
CREATE TABLE public.modules (
  key             text PRIMARY KEY,       -- 'leads', 'inventory', 'manufacturing', 'hr', 'accounting'
  name            text NOT NULL,          -- display: 'Lead Management'
  description     text NOT NULL,          -- one-liner shown to superadmin
  category        text NOT NULL,          -- 'sales', 'operations', 'finance', 'hr'
  icon            text,                   -- icon key rendered by client
  route_prefix    text NOT NULL UNIQUE,   -- '/dashboard/leads', '/dashboard/inventory'
  sort_order      integer NOT NULL DEFAULT 100,
  active          boolean NOT NULL DEFAULT true,
  requires_flags  jsonb DEFAULT '[]',     -- list of feature flags this module implies
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

Seed data (one row per shipped module):
```sql
INSERT INTO public.modules (key, name, description, category, route_prefix, sort_order) VALUES
  ('leads',         'Lead Management',       'Capture, track, and convert customer enquiries.', 'sales',      '/dashboard/leads',         10),
  ('inventory',     'Inventory',              'Products, stock levels, reorder alerts.',         'operations', '/dashboard/inventory',     20),
  ('manufacturing', 'Manufacturing',          'BOMs, work orders, production runs.',             'operations', '/dashboard/manufacturing', 30),
  ('hr',            'HR',                     'Employees, attendance, payroll.',                 'hr',         '/dashboard/hr',            40),
  ('accounting',    'Accounting',             'Ledger, receivables, expenses.',                  'finance',    '/dashboard/accounting',    50)
ON CONFLICT (key) DO NOTHING;
```

### 3.2 `tenant_modules` (join)

```sql
CREATE TABLE public.tenant_modules (
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key    text NOT NULL REFERENCES public.modules(key) ON DELETE RESTRICT,
  enabled_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz,
  provisioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  config        jsonb NOT NULL DEFAULT '{}',   -- module-specific settings
  PRIMARY KEY (tenant_id, module_key)
);

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

-- Members read their own tenant's active modules; superadmin manages all.
CREATE POLICY tm_select ON public.tenant_modules FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR public.tenant_role(auth.uid(), tenant_id) IS NOT NULL
  );

CREATE POLICY tm_mutate ON public.tenant_modules FOR ALL
  USING (public.is_superadmin(auth.uid()));
```

Note: `enabled_at IS NOT NULL AND disabled_at IS NULL` = currently active.

### 3.3 Per-module tables

Existing Leads tables (`leads`, `field_definitions`, `saved_views`, `lead_activity`, `invoices`) are the "leads" module today.

New modules follow the same convention:
- Every table has `tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE`
- RLS enabled with the same helper functions (`is_superadmin`, `tenant_role`)
- Tables prefixed by module key: `inventory_products`, `inventory_stock`, `manufacturing_bom`, `hr_employees`, etc.

**Rule of thumb:** if it's uncomfortable to prefix a table with the module name, that table shouldn't exist yet.

---

## 4. Runtime architecture

### 4.1 URL structure

**Migration plan for existing routes** (breaking, needs proxy fallback):

| Old URL | New URL | Fallback |
|---|---|---|
| `/dashboard` | `/dashboard/leads` | `proxy.ts` redirects `/dashboard` → `/dashboard/leads` if user has leads module enabled |
| `/dashboard/new` | `/dashboard/leads/new` | Same redirect |
| `/dashboard/invoices` | `/dashboard/leads/invoices` | (invoices are a leads feature, not a top-level module in this design — reconsider if invoices grows) |
| `/dashboard/team` | `/dashboard/team` | Not module-scoped — team management is tenant-wide |
| `/dashboard/settings` | `/dashboard/settings` | Same |
| `/dashboard/fields` | `/dashboard/leads/fields` | Field definitions are per-module |

**New module URLs:**
- `/dashboard/inventory` — list products
- `/dashboard/inventory/new` — add product
- `/dashboard/manufacturing/orders` — production orders
- etc.

### 4.2 Sidebar

Fetch active modules at layout level:

```ts
const { data: activeModules } = await supabase
  .from('tenant_modules')
  .select('module_key, modules(name, icon, route_prefix, sort_order, category)')
  .eq('tenant_id', session.tenantId)
  .is('disabled_at', null)
  .order('sort_order', { referencedTable: 'modules' })
```

Sidebar groups modules by `category`, renders one nav section per group. Superadmins see all modules regardless of `tenant_modules`.

### 4.3 Route guarding

New helper in `lib/authz.ts`:

```ts
export async function requireModule(moduleKey: string): Promise<Session> {
  const session = await requireSession()
  if (session.isSuperadmin) return session
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_modules')
    .select('module_key')
    .eq('tenant_id', session.tenantId)
    .eq('module_key', moduleKey)
    .is('disabled_at', null)
    .maybeSingle()
  if (!data) redirect('/dashboard')
  return session
}
```

Every module page calls `requireModule('inventory')` at the top. Access control is centralised.

### 4.4 Feature flags vs modules

Feature flags (`tenants.features`, from Phase 3) remain for **granular gating within a module** — e.g. `analytics` is a feature of the Leads module, not a module itself. Modules are the coarse boundary; features are the fine one.

---

## 5. Superadmin experience

New page `/superadmin/tenants/[tenantId]/modules`:
- Table of all modules from the catalog
- Toggle switch per module (enabled/disabled)
- Enabling writes a row to `tenant_modules`
- Disabling sets `disabled_at` (soft, so historical data stays accessible via superadmin's cross-tenant read)
- Provisioning logs to `audit_log`

Onboarding flow update:
- `/superadmin` "Onboard company" wizard adds a "Which modules?" step
- Multi-select from module catalogue
- After tenant is created, selected modules are inserted into `tenant_modules` in the same transaction

---

## 6. Migration path (existing tenants → module-aware world)

**Phase 8.1 — Additive foundation (no user-visible change)**
1. Ship migration for `modules` + `tenant_modules` tables, seed the catalogue.
2. Backfill: `INSERT INTO tenant_modules SELECT id, 'leads', now() FROM tenants;` — every existing tenant gets the Leads module.
3. Ship the `requireModule` helper but don't wire it into any routes yet.

**Phase 8.2 — Sidebar-only migration**
1. Update sidebar to render from `tenant_modules` (still using existing URLs).
2. All existing routes keep working.

**Phase 8.3 — Route restructure**
1. Add proxy redirects: `/dashboard` → `/dashboard/leads` for tenants with leads module.
2. Update every `/dashboard/*` route to `/dashboard/leads/*`.
3. Guard each route with `requireModule('leads')`.
4. Update all in-app `<Link href="/dashboard/*">` calls.

**Phase 8.4 — First new module**
1. Pick smallest-scope module (Inventory: products + stock levels).
2. Build tables (`inventory_products`, `inventory_stock`), RLS, pages under `/dashboard/inventory/*`.
3. Provision one pilot tenant via superadmin → verify module appears in sidebar and works.

Each phase is deployable and reversible.

---

## 7. Cross-cutting concerns

### 7.1 Security
- RLS still keyed by `tenant_id` on every module table — same pattern as leads.
- `tenant_modules` is server-only write (superadmin RLS policy).
- `requireModule()` is the single gate; forgetting it is the only way to leak data across modules, so include it in a lint rule / code review checklist.

### 7.2 Custom fields per module
`field_definitions` currently keys off tenant. For multi-module, key off tenant + module:
```sql
ALTER TABLE public.field_definitions
  ADD COLUMN module_key text NOT NULL DEFAULT 'leads' REFERENCES public.modules(key);
ALTER TABLE public.field_definitions
  DROP CONSTRAINT field_definitions_tenant_key;
ALTER TABLE public.field_definitions
  ADD CONSTRAINT field_definitions_tenant_module_key UNIQUE (tenant_id, module_key, key);
```

Same treatment for `user_column_prefs` — column selections are per module.

### 7.3 Superadmin cross-module analytics
Superadmin gets a top-level "Activity" dashboard showing:
- Active modules per tenant
- Rows per module per tenant (via `audit_log` or dedicated `usage_stats`)
- Fed by materialised view refreshed nightly

### 7.4 Uninstall / downgrade
Disabling a module (`disabled_at = now()`) does NOT delete data. Superadmin can re-enable. Data purge is a separate destructive action requiring double-confirmation and its own audit event.

---

## 8. Cost & complexity

| Item | Estimate |
|---|---|
| Schema migration + seed | 1 day |
| Sidebar refactor | 1 day |
| Route restructure with proxy fallback | 2 days |
| First new module (Inventory MVP: products, stock, in/out) | ~5 days |
| Superadmin module-management UI | 2 days |
| Audit log integration + tests | 1 day |
| **Total for Phase 8.1 – 8.4** | **~12 dev days** |

Adding subsequent modules after Inventory follows the same recipe and should shrink to 3–4 days each.

---

## 9. Open questions (for review before build)

1. **Route change is breaking for existing users' bookmarks.** Do we accept the migration cost, or keep `/dashboard` = leads forever and only introduce new modules at new paths?
2. **Should modules ever share tables?** E.g. an `invoices` module used by both Leads and Inventory. Currently the design says no; invoices stays inside Leads. Revisit when the first real-world case emerges.
3. **Free tier vs paid tier per module?** Do we need per-module pricing metadata now, or defer until Phase 9 (billing)?
4. **Vertical-specific field presets** (Real Estate, Retail, Auto) — is that a Phase 8 feature (per-module templates) or Phase 3.5 (leads-only field templates)?
5. **Multi-workspace within a tenant** — e.g. one tenant runs three shops, each with its own leads. Is that a Phase 8 concern, or does it become a separate tenant per shop?

---

## 10. Recommendation

Proceed with **Phase 8.1 (additive foundation)** immediately after Phase 7 lands. It's zero-risk and unlocks the sidebar refactor and eventual module builds.

Defer **Phase 8.3 (route restructure)** until we have at least one non-leads module built and validated in staging — otherwise we churn the URL structure for no visible benefit.

Confirm answers to §9 before scoping 8.4.
