# LeadNestIndia

Multi-tenant SaaS lead-management platform for small Indian businesses. Capture, manage, follow up, and bill — from one dashboard, per company, with GST-compliant invoicing.

- **Founder / superadmin** onboards companies from a dedicated `/superadmin` UI
- **Company admins** invite teammates, edit leads, generate invoices
- **Company users** capture leads, self-assign, add notes
- Every company sees **only their own data** — enforced by Postgres RLS

---

## Documentation

| Doc | What's inside |
|---|---|
| [`db/SCHEMA.md`](./db/SCHEMA.md) | ER diagram (Mermaid), every table with use cases, RLS matrix, migration order |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Tech stack, folder layout, key design patterns (feature flags, custom fields, filter model) |
| [`docs/FEATURES.md`](./docs/FEATURES.md) | Every feature the app ships with file-by-file references — click through to the code |
| [`docs/API.md`](./docs/API.md) | Full REST endpoint reference — routes, request/response shapes, auth requirements |
| [`docs/SETUP.md`](./docs/SETUP.md) | Local dev, environment vars, Supabase project setup, running migrations |

---

## Quick start

```bash
# 1. Install deps
npm install

# 2. Configure Supabase (see docs/SETUP.md for details)
cp .env.example .env.local   # or create .env.local manually

# 3. Run migrations in Supabase → SQL Editor in order:
#    db/phase2.sql → phase3.sql → phase4.sql → phase5.sql → phase6.sql

# 4. Start dev server
npm run dev
```

Open <http://localhost:3000>.

---

## Tech stack (at a glance)

- **Next.js 16.2.11** — App Router + Turbopack (`middleware.ts` is `proxy.ts` in this version)
- **React 19** — strict lint rules active (`react-hooks/purity`, `react-hooks/set-state-in-effect`)
- **Supabase** — auth (email invite flow), Postgres, Row-Level Security
- **Tailwind CSS v4** — tokens in `app/globals.css`, dark-mode via `.dark` class + CSS variables
- **Recharts** — charts on the analytics dashboard
- **PDF via `window.print()`** — no server-side PDF library needed

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full story.

---

## Feature summary

| Feature | Tier | Details |
|---|---|---|
| Lead dashboard (search, filter, KPIs) | Core | [`docs/FEATURES.md#lead-dashboard`](./docs/FEATURES.md#lead-dashboard) |
| Custom fields per company | Core | [`docs/FEATURES.md#custom-fields`](./docs/FEATURES.md#custom-fields) |
| 3-tier roles + email invites | Core | [`docs/FEATURES.md#roles--invites`](./docs/FEATURES.md#roles--invites) |
| Assignment & follow-ups | Core | [`docs/FEATURES.md#assignment--follow-ups`](./docs/FEATURES.md#assignment--follow-ups) |
| CSV export (filter-aware) | Core | [`docs/FEATURES.md#csv-export`](./docs/FEATURES.md#csv-export) |
| Analytics: charts, filter builder, saved views | **Paid** | [`docs/FEATURES.md#analytics-bundle`](./docs/FEATURES.md#analytics-bundle) |
| GST-compliant invoicing (CGST+SGST / IGST, print, PDF) | **Paid** | [`docs/FEATURES.md#gst-invoicing`](./docs/FEATURES.md#gst-invoicing) |
| Notes & activity timeline | **Paid** | [`docs/FEATURES.md#notes--activity-timeline`](./docs/FEATURES.md#notes--activity-timeline) |
| Dark mode | Core | [`docs/FEATURES.md#dark-mode`](./docs/FEATURES.md#dark-mode) |
| Row-Level Security | Core | [`db/SCHEMA.md#4-row-level-security-rls`](./db/SCHEMA.md#4-row-level-security-rls) |

---

## Project structure

```
leadnestindia/
├── app/                          # Next.js App Router
│   ├── api/                      # REST endpoints (see docs/API.md)
│   ├── auth/                     # Callback + set-password
│   ├── dashboard/                # Tenant-facing pages
│   │   ├── invoices/             # Paid: invoice list, new, view
│   │   ├── team/                 # Team management
│   │   └── new/                  # New lead form
│   ├── superadmin/               # Founder-only pages
│   │   └── tenants/[tenantId]/   # Per-tenant config
│   ├── login/                    # Marketing-style login page
│   ├── globals.css               # Tailwind v4 + CSS vars + print CSS
│   ├── layout.tsx                # Root layout + theme init
│   └── page.tsx                  # Redirects to /dashboard or /login
│
├── components/                   # Reusable UI
│   ├── leads-table.tsx           # Main leads grid
│   ├── lead-edit-modal.tsx       # Details + Activity tabs
│   ├── leads-filter-builder.tsx  # Multi-condition filter UI
│   ├── leads-charts.tsx          # Recharts pie/line/bar
│   ├── saved-views-menu.tsx      # Named filter presets
│   ├── invoice-editor.tsx        # Line items + GST math
│   ├── invoice-preview.tsx       # Print-ready invoice layout
│   ├── gst-config-form.tsx       # Company GST details
│   ├── tenant-config-client.tsx  # Superadmin per-tenant panel
│   ├── theme-toggle.tsx          # Dark mode switch
│   └── ...
│
├── lib/                          # Shared utilities
│   ├── authz.ts                  # getSession / requireAdmin / requireSuperadmin
│   ├── features.ts               # Features type + defaults
│   ├── filters.ts                # LeadFilter model + evaluator (shared client/server)
│   ├── invoice.ts                # Invoice types, GST math, INR formatting, words
│   └── supabase/
│       ├── server.ts             # SSR Supabase client
│       ├── admin.ts              # Service-role client (bypasses RLS)
│       └── client.ts             # Browser client
│
├── db/                           # SQL migrations
│   ├── phase2.sql                # Roles + RLS + invite flow
│   ├── phase3.sql                # Custom fields + feature flags
│   ├── phase4.sql                # Saved views
│   ├── phase5.sql                # Assignment + follow-ups + activity
│   ├── phase6.sql                # GST invoicing
│   └── SCHEMA.md                 # ER diagram + reference docs
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── API.md
│   └── SETUP.md
│
├── proxy.ts                      # Next.js 16 middleware — auth guard
├── AGENTS.md                     # Notes for AI collaborators
└── CLAUDE.md                     # Project context for Claude Code
```

---

## Contributing / working on this repo

- Every DB change goes in a `db/phaseN.sql` file. Use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (not `CREATE TABLE`) for existing tables — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#gotcha-legacy-tables) for why.
- Paid features are gated at three layers: sidebar visibility → page redirect → API check. See [`docs/ARCHITECTURE.md#feature-flags-and-paywall`](./docs/ARCHITECTURE.md#feature-flags-and-paywall).
- Run `npx tsc --noEmit && npm run lint && npm run build` before committing.
