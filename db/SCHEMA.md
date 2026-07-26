# LeadNestIndia — Database Schema

Full picture of the Supabase Postgres schema, what each table is for, and how the pieces connect.

> **Tip:** Supabase Dashboard → Database → **Schema Visualizer** gives you a live, click-through view of the same thing. Use this file as the durable, version-controlled reference and the dashboard as the interactive one.

---

## 1. Diagram (Mermaid ER)

```mermaid
erDiagram
    auth_users ||--o{ tenant_users     : "member of"
    auth_users ||--o{ superadmins      : "is"
    auth_users ||--o{ tenants          : "created by"
    auth_users ||--o{ leads            : "assigned to"
    auth_users ||--o{ lead_activity    : "authored by"
    auth_users ||--o{ saved_views      : "owned by"
    auth_users ||--o{ invoices         : "created by"

    tenants ||--o{ tenant_users        : "has members"
    tenants ||--o{ leads               : "owns"
    tenants ||--o{ field_definitions   : "defines schema"
    tenants ||--o{ saved_views         : "scopes"
    tenants ||--o{ lead_activity       : "scopes"
    tenants ||--o{ invoices            : "issues"

    leads ||--o{ lead_activity         : "has events"
    leads ||--o{ invoices              : "billed via"

    auth_users {
        uuid id PK
        text email
        jsonb raw_user_meta_data
        note "Managed by Supabase Auth"
    }

    superadmins {
        uuid user_id PK,FK
        timestamptz created_at
    }

    tenants {
        uuid id PK
        text name
        timestamptz created_at
        uuid created_by FK
        jsonb features "team, export, settings, analytics, invoicing, activity"
        text gstin
        text company_address
        text state
        text state_code
        numeric gst_rate
        text default_hsn
    }

    tenant_users {
        uuid user_id PK,FK
        uuid tenant_id PK,FK
        text role "admin | user"
        text email
        timestamptz created_at
    }

    field_definitions {
        uuid id PK
        uuid tenant_id FK
        text key "unique per tenant"
        text label
        text type "text | number | email | tel | date | select | textarea"
        boolean required
        jsonb options "for type=select"
        boolean active
        integer sort_order
        timestamptz created_at
    }

    leads {
        uuid id PK
        uuid tenant_id FK
        text status "new | contacted | qualified | won | lost"
        jsonb custom_data "keyed by field_definitions.key"
        text source
        timestamptz created_at
        uuid assigned_to FK
        timestamptz follow_up_at
    }

    lead_activity {
        uuid id PK
        uuid tenant_id FK
        uuid lead_id FK
        uuid user_id FK
        text kind "note | status_change | assigned | follow_up_set | edited | created"
        text body "for notes"
        jsonb metadata "for events: from/to values"
        timestamptz created_at
    }

    saved_views {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        text name
        jsonb filter "LeadFilter shape from lib/filters.ts"
        timestamptz created_at
    }

    invoices {
        uuid id PK
        uuid tenant_id FK
        uuid lead_id FK "nullable"
        text invoice_number "INV/YYYY-YY/NNNN"
        date invoice_date
        text seller_name "snapshotted"
        text seller_gstin "snapshotted"
        text buyer_name
        text buyer_gstin
        jsonb items "line items"
        numeric subtotal
        numeric gst_rate
        numeric cgst_amount
        numeric sgst_amount
        numeric igst_amount
        numeric total
        boolean inter_state
        text notes
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 2. Tables + use cases

### `auth.users` (Supabase-managed)
Identity source for every human on the platform. We never write to this directly — Supabase Auth owns it. Every FK to a "user" in our schema points here.

**Used by:** login, invite flow, RLS `auth.uid()` checks, activity attribution.

---

### `superadmins`
Platform founders (currently just Kiran). Bootstrapped once via SQL:

```sql
INSERT INTO superadmins (user_id)
SELECT id FROM auth.users WHERE email = 'kirankumar.kendre@cashfree.com';
```

**Use cases:**
- Onboarding new customer companies (`/superadmin` UI)
- Configuring per-tenant custom fields + feature flags
- Bypassing RLS for cross-tenant queries (via the `is_superadmin()` helper)

---

### `tenants`
One row per customer company. Also stores the company's **GST config** (used as seller info on invoices) and the **feature flags JSONB** that gates paid features.

**Use cases:**
- Data isolation boundary — every tenant-scoped query filters by `tenant_id`
- Superadmin's "companies" list on `/superadmin`
- GST invoice header (seller name, GSTIN, address snapshot at generation time)
- Per-tenant paywall (`features.analytics`, `features.invoicing`, `features.activity`)

**Key columns:**
- `features` — JSONB with six boolean keys. Missing keys read as `false` (safe default for the paid ones).
- `gstin`, `gst_rate`, `state_code`, etc. — used when generating invoices. Editable by tenant admin at `/dashboard/invoices` → "Company GST details".

---

### `tenant_users`
Many-to-many between users and tenants — the membership table. Each row = "this user belongs to this company as this role".

**Use cases:**
- Session lookup (`lib/authz.ts` → `getSession()`) figures out the current tenant + role from here
- Team page (`/dashboard/team`) — invite/remove/change-role UI
- Assign-to dropdown in the lead edit modal is populated from this table
- Superadmin's "Members" panel on `/superadmin/tenants/[id]`

**Design note:** `email` is duplicated from `auth.users` for convenience (avoids joining `auth` schema on every membership query). Backfilled by phase2.sql and kept in sync by the invite trigger.

---

### `field_definitions`
The **schema catalog** for per-tenant custom fields. Each row describes one column the tenant wants to capture on their leads. `UNIQUE (tenant_id, key)`.

**Use cases:**
- Renders the New Lead form (one input per definition)
- Populates the Leads table columns
- Feeds the filter builder's available fields
- Superadmin edits this at `/superadmin/tenants/[id]` — company admins never touch it

**Design note:** This is the *catalog* half of the EAV-lite pattern. See §3.

---

### `leads`
The core data table. One row per customer inquiry. Standard columns for status + timestamps, plus a `custom_data` JSONB blob keyed by `field_definitions.key`.

**Use cases:**
- The whole `/dashboard` leads table
- Assignment (`assigned_to`) — powers "My leads" filter, KPI banners, activity events
- Follow-up reminders (`follow_up_at`) — powers the amber "N overdue / M due today" banner
- Invoicing prefill — `?lead=<id>` on `/dashboard/invoices/new` sniffs `custom_data` for buyer info
- Filtered CSV export

**Design note:** No dedicated columns for custom fields. Everything variable lives in the JSONB. See §3.

---

### `lead_activity`
Timeline of what happened to each lead — a mix of auto-logged events and manual notes. Append-only.

**Kinds:**
- `note` — human-written text (gated by `features.activity` on POST)
- `status_change`, `assigned`, `follow_up_set`, `edited` — auto-inserted by `PATCH /api/leads/[id]`
- `created` — reserved for future use (currently no INSERT trigger)

**Use cases:**
- Activity tab in the lead edit modal
- Future audit/history features
- Per-lead follow-up context ("last called on…", "assigned to X yesterday")

**Design note:** Auto-events log for **all** tenants regardless of `features.activity`. This way when a free-tier tenant upgrades, their history is already there. Only manual notes are paywalled.

---

### `saved_views`
Per-user, per-tenant named filter presets. One row = "Kiran calls this filter 'Hot leads this month'".

**Use cases:**
- Saved Views dropdown in the Leads toolbar (only visible if `features.analytics` is on)
- Reload a complex filter with one click
- `UNIQUE (tenant_id, user_id, name)` prevents dupes

**Design note:** `filter` JSONB stores the `LeadFilter` shape from `lib/filters.ts`. Same evaluator applies it client-side (LeadsTable) and server-side (CSV export).

---

### `invoices`
GST-compliant tax invoices. Every invoice has snapshotted seller + buyer info, JSONB line items, and separate tax columns (CGST/SGST/IGST) plus totals. `UNIQUE (tenant_id, invoice_number)`.

**Use cases:**
- List page (`/dashboard/invoices`)
- Editor (`/dashboard/invoices/new`) — optionally prefilled from a lead via `?lead=<id>`
- View + print/PDF (`/dashboard/invoices/[id]`) — browser print CSS produces the downloadable PDF
- Compliance evidence (snapshotted seller GSTIN + state code + address)

**Design notes:**
- **Seller info snapshotted** — editing `tenants.gstin` later doesn't rewrite historical invoices.
- **Invoice number** = `INV/YYYY-YY/NNNN` per Indian fiscal year (Apr–Mar). Counter per tenant per FY.
- **CGST = SGST = gst_rate / 2** for intra-state. IGST at full rate for inter-state (via `inter_state=true`).
- **Line items in JSONB** — flexible schema per invoice. `[{description, hsn, qty, rate, amount}]`.

---

## 3. Custom fields — the EAV-lite pattern

Two tables, one string key, no foreign key between them:

```
field_definitions (catalog)           leads.custom_data (data)
├── key = "phone_number"      ────►   {"phone_number": "+91 98765 43210",
├── key = "customer_name"     ────►    "customer_name": "Ramesh Kumar",
└── key = "interest_in"       ────►    "interest_in": "SUV"}
```

**Why this design:**

| Alternative | Verdict |
|---|---|
| Column-per-field (`ALTER TABLE` on every field add) | ❌ Doesn't scale across 1000s of tenants |
| Table-per-tenant (`leads_acme`, `leads_beta`) | ❌ Breaks cross-tenant queries, RLS, migrations |
| Full EAV (`lead_values` row per field per lead) | ❌ Slow, JOIN-heavy anti-pattern |
| **JSONB `custom_data` + `field_definitions` catalog** | ✅ Zero-DDL to add fields; one `leads` table for everyone |

**Edge cases handled for free:**
- Field deleted → old leads keep their data in JSONB, just stop appearing in the columns list.
- Field renamed (label) → `key` is stable, existing data still maps.
- Type changed → historical string values sit unchanged; new inputs render the new type.
- Two tenants with the same key → completely independent thanks to `tenant_id` scoping.

**Scale note:** we filter client-side today. Past ~10k leads/tenant, add a GIN index:
```sql
CREATE INDEX leads_custom_data_gin ON leads USING gin (custom_data jsonb_path_ops);
```

---

## 4. Row-Level Security (RLS)

RLS is enabled on every table listed above (except `auth.users`, which Supabase owns). Two helper functions drive most policies:

- `public.is_superadmin(uid uuid) → boolean` — returns true if the user is in `superadmins`
- `public.tenant_role(uid uuid, tid uuid) → text` — returns `'admin'` / `'user'` / `NULL` for a given user/tenant pair

**Policy shapes across the schema:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `tenants` | Members or superadmin | Superadmin only | Superadmin only | Superadmin only |
| `tenant_users` | Members of same tenant, or superadmin | Admin or superadmin | Admin or superadmin | Admin or superadmin |
| `leads` | Any member, or superadmin | Any member | Admin or superadmin | Admin or superadmin |
| `field_definitions` | Any member | Superadmin only | Superadmin only | Superadmin only |
| `saved_views` | Owner (per user) or superadmin | Owner only | Owner only | Owner or superadmin |
| `lead_activity` | Any member | Any member (server enforces `note` kind) | – | Author, admin, or superadmin |
| `invoices` | Any member | Admin or superadmin | Admin or superadmin | Admin or superadmin |
| `superadmins` | Superadmin only | (bootstrap SQL) | – | – |

**Defense in depth:** RLS is the DB-level guard. API routes ALSO enforce role via `requireAdmin()` / `requireSuperadmin()` from `lib/authz.ts`. Paid features (`analytics`, `invoicing`, `activity`) are additionally checked at the API layer against `tenants.features`.

---

## 5. Migrations

Everything above is built up incrementally. Run in order:

| File | Adds |
|---|---|
| `phase2.sql` | tenants, tenant_users, superadmins, RLS helpers, invite trigger, base RLS policies |
| `phase3.sql` | field_definitions + features JSONB on tenants (with idempotent `ALTER` fixups) |
| `phase4.sql` | saved_views + RLS |
| `phase5.sql` | leads.assigned_to, leads.follow_up_at, lead_activity + RLS |
| `phase6.sql` | tenant GST columns, invoices + RLS |

All files use `IF NOT EXISTS` / `IF NOT EXISTS` on both CREATE and ALTER so they're safe to re-run on any state.

---

## 6. How to view / regenerate

**Live diagram (interactive):**
Supabase Dashboard → **Database** → **Schema Visualizer**. Zoom, click a table, see its columns + FKs.

**Rendered Mermaid diagram (this file):**
- **GitHub** renders it inline when you view `SCHEMA.md`.
- **Notion**: paste the ` ```mermaid … ``` ` block into a code block with language `mermaid`.
- **VS Code**: install the "Markdown Preview Mermaid Support" extension.
- **Standalone image**: paste into <https://mermaid.live>, export as SVG/PNG.

**Export the actual schema from Postgres** (source-of-truth, in case this file drifts):
```bash
# From Supabase Dashboard → Database → Backups → download → or via CLI:
supabase db dump --schema public > current_schema.sql
```
