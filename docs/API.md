# API Reference

Every REST endpoint the app exposes, grouped by concern. All routes live under `/api/**`.

**Auth for every route:** cookie-based Supabase session (set by `/login` or `/auth/callback`). No API keys. Users can only be created via the invite flow.

**Authorization column:**
- `session` — any signed-in user
- `admin` — company admin or superadmin
- `superadmin` — founder only

**Standard error shape:**
```json
{ "error": "human-readable message" }
```
with an appropriate 4xx/5xx status code.

---

## Contents

- [Superadmin](#superadmin)
- [Tenant configuration](#tenant-configuration) (admin)
- [Team](#team) (admin)
- [Leads](#leads)
- [Lead activity](#lead-activity)
- [Saved views](#saved-views)
- [Invoices](#invoices) (admin)
- [Export](#export)

---

## Superadmin

### `POST /api/superadmin/onboard`
Create a new tenant and invite its first admin.

- **Auth:** superadmin
- **Body:**
  ```json
  { "companyName": "Acme Retail Pvt Ltd", "adminEmail": "owner@acme.com" }
  ```
- **Success:** `{ "ok": true, "tenantId": "<uuid>", "mode": "invited" }` — sends invite email.
- **Errors:** 400 (bad email / missing name), 409 (email already tied to another tenant).
- **Source:** `app/api/superadmin/onboard/route.ts`

### `POST /api/superadmin/tenant/[tenantId]/fields`
Add a custom field to a tenant.

- **Auth:** superadmin
- **Body:**
  ```json
  {
    "label": "Phone Number",
    "type": "tel",        // text | number | email | tel | date | select | textarea
    "required": true,
    "options": []          // required if type = "select"
  }
  ```
- **Behaviour:** auto-generates `key` from `label` (`Phone Number` → `phone_number`), computes `sort_order = max+1`.
- **Success:** the created row.
- **Errors:** 409 if the derived `key` already exists for that tenant.
- **Source:** `app/api/superadmin/tenant/[tenantId]/fields/route.ts`

### `PATCH /api/superadmin/tenant/[tenantId]/fields/[fieldId]`
Update label, type, required, options, or active flag.

- **Auth:** superadmin
- **Source:** `app/api/superadmin/tenant/[tenantId]/fields/[fieldId]/route.ts`

### `DELETE /api/superadmin/tenant/[tenantId]/fields/[fieldId]`
Delete a field definition. Old lead data survives in `custom_data` — just stops rendering.

- **Auth:** superadmin

### `PATCH /api/superadmin/tenant/[tenantId]/features`
Toggle per-tenant feature flags.

- **Auth:** superadmin
- **Body:**
  ```json
  {
    "team":      true,
    "export":    true,
    "settings":  false,
    "analytics": false,
    "invoicing": false,
    "activity":  false
  }
  ```
- **Success:** `{ "ok": true, "features": { ... } }` — persisted to `tenants.features` JSONB.
- **Source:** `app/api/superadmin/tenant/[tenantId]/features/route.ts`

---

## Tenant configuration

### `PATCH /api/tenant/gst`
Update the company's GST / seller details (used on future invoices).

- **Auth:** admin
- **Body (any subset):**
  ```json
  {
    "gstin": "27AAAAA0000A1Z5",
    "company_address": "Building, Street, City, PIN",
    "state": "Maharashtra",
    "state_code": "27",
    "gst_rate": 18,
    "default_hsn": "998314"
  }
  ```
- **Validation:** GSTIN matches `2 digit + 5 letter + 4 digit + 1 letter + 1 alnum + Z + 1 alnum`; `state_code` is 1–2 digits; `gst_rate` in [0, 40].
- **Success:** `{ "ok": true, "gst": { ... } }`
- **Source:** `app/api/tenant/gst/route.ts`

---

## Team

### `POST /api/team/invite`
Invite a teammate by email — either send an invite email (new user) or upsert into the tenant (existing user).

- **Auth:** admin
- **Body:**
  ```json
  { "email": "teammate@acme.com", "role": "user" }   // role: "admin" | "user"
  ```
- **Success:**
  - If email is new to the platform: `{ "ok": true, "mode": "invited" }` — Supabase sends the invite.
  - If email already exists: `{ "ok": true, "mode": "added" }` — silently added to your tenant.
- **Source:** `app/api/team/invite/route.ts`

### `POST /api/team/role`
Change a member's role (`admin` ↔ `user`).

- **Auth:** admin
- **Body:** `{ "userId": "<uuid>", "role": "admin" }`
- **Constraint:** cannot demote the last admin.
- **Source:** `app/api/team/role/route.ts`

### `POST /api/team/remove`
Remove a member from the tenant.

- **Auth:** admin
- **Body:** `{ "userId": "<uuid>" }`
- **Constraint:** cannot remove the last admin.
- **Source:** `app/api/team/remove/route.ts`

---

## Leads

### `PATCH /api/leads/[id]`
Update a lead. Any subset of fields may be provided; each triggers an activity log row.

- **Auth:** admin
- **Body (any subset):**
  ```json
  {
    "status": "won",
    "custom_data": { "phone_number": "+91 98765 43210", "interest_in": "SUV" },
    "assigned_to": "<uuid or null>",
    "follow_up_at": "2026-08-01T09:00:00.000Z"
  }
  ```
- **Side effects:** diffs before/after and inserts `lead_activity` rows for each changed field (`status_change`, `assigned`, `follow_up_set`, `edited`).
- **Source:** `app/api/leads/[id]/route.ts`

### `POST /api/leads/[id]`
Special action: self-assign or unassign. Bypasses the admin gate on PATCH so any user can (un)assign themselves.

- **Auth:** session (with tenant match)
- **Body:**
  ```json
  { "action": "assign", "assigned_to": "<own user_id or null>" }
  ```
- **Constraint:** non-admins can only assign themselves or unassign.
- **Source:** `app/api/leads/[id]/route.ts` (POST export)

---

## Lead activity

### `GET /api/leads/[id]/activity`
List the activity timeline for a lead (auto-events + notes).

- **Auth:** session (with tenant match — auto-events always readable)
- **Response:**
  ```json
  {
    "activity": [
      {
        "id": "<uuid>",
        "kind": "status_change",
        "body": null,
        "metadata": { "from": "new", "to": "contacted" },
        "created_at": "2026-07-26T…",
        "user_id": "<uuid>",
        "user_email": "kiran@…"
      }
    ]
  }
  ```
- **Source:** `app/api/leads/[id]/activity/route.ts`

### `POST /api/leads/[id]/activity`
Add a manual note to a lead. **Gated by `features.activity`** — free-tier tenants get 403.

- **Auth:** session (with tenant match)
- **Body:** `{ "body": "Called on Tuesday, said call back Friday." }`
- **Success:** the created activity row.
- **Errors:** 403 if activity feature is disabled; 400 for empty or oversized note.
- **Source:** `app/api/leads/[id]/activity/route.ts`

---

## Saved views

### `GET /api/saved-views`
List the calling user's saved filter views for the current tenant.

- **Auth:** session
- **Response:** `{ "views": [ { "id", "name", "filter", "created_at" } ] }`
- **Source:** `app/api/saved-views/route.ts`

### `POST /api/saved-views`
Save a new named filter view.

- **Auth:** session
- **Body:**
  ```json
  {
    "name": "Hot leads this month",
    "filter": { "conditions": [ { "id": "…", "field": "status", "op": "in", "value": ["new","contacted"] } ] }
  }
  ```
- **Constraint:** `UNIQUE (tenant_id, user_id, name)` — 409 on dupe.
- **Source:** `app/api/saved-views/route.ts`

### `DELETE /api/saved-views/[id]`
Delete a saved view (owner or superadmin).

- **Auth:** session
- **Source:** `app/api/saved-views/[id]/route.ts`

---

## Invoices

All invoice endpoints require the `invoicing` feature flag to be enabled for the tenant (superadmin bypasses).

### `GET /api/invoices`
List invoices for the current tenant (all leads, all users).

- **Auth:** session
- **Response:** `{ "invoices": [ { "id", "invoice_number", "invoice_date", "buyer_name", "total", "gst_rate", "inter_state", "created_at" } ] }`
- **Source:** `app/api/invoices/route.ts`

### `POST /api/invoices`
Generate a new invoice. Server assigns the invoice number (`INV/YYYY-YY/NNNN`) and snapshots seller info from `tenants`.

- **Auth:** admin
- **Body:**
  ```json
  {
    "lead_id": "<uuid or null>",
    "invoice_date": "2026-07-26",
    "buyer_name": "Ramesh Kumar",
    "buyer_gstin": "27ABCDE1234F1Z5",
    "buyer_phone": "+91 98765 43210",
    "buyer_email": "ramesh@…",
    "buyer_address": "…",
    "buyer_state": "Maharashtra",
    "buyer_state_code": "27",
    "items": [
      { "description": "Consulting", "hsn": "998314", "qty": 10, "rate": 5000, "amount": 50000 }
    ],
    "gst_rate": 18,
    "inter_state": false,
    "notes": "Payment terms: 30 days"
  }
  ```
- **Server-computed:** `subtotal`, `cgst_amount`, `sgst_amount`, `igst_amount`, `total`, `invoice_number`.
- **Success:** the full created invoice row.
- **Source:** `app/api/invoices/route.ts`

### `GET /api/invoices/[id]`
Fetch a single invoice.

- **Auth:** session (with tenant match)
- **Source:** `app/api/invoices/[id]/route.ts`

### `PATCH /api/invoices/[id]`
Update an invoice. Totals are recomputed server-side from the provided items + gst_rate.

- **Auth:** admin
- **Body (any subset):** any of `invoice_date`, buyer fields, `items`, `gst_rate`, `inter_state`, `notes`.
- **Note:** `invoice_number`, seller snapshot, and `tenant_id` are immutable.
- **Source:** `app/api/invoices/[id]/route.ts`

### `DELETE /api/invoices/[id]`
Delete an invoice.

- **Auth:** admin
- **Source:** `app/api/invoices/[id]/route.ts`

---

## Export

### `GET /api/export`
Download the current filter's leads as CSV.

- **Auth:** session (gated by `features.export`)
- **Query:** `?filter=<url-encoded JSON>` (optional — falls back to all leads)
- **Response:** `text/csv` with `Content-Disposition: attachment; filename="leads.csv"`
- **Columns:** `created_at`, `status`, plus one column per key found in any lead's `custom_data`.
- **Filter:** decoded with `parseFilter()` and applied via the shared `applyFilter()` — result matches on-screen filter exactly.
- **Source:** `app/api/export/route.ts`

---

## Auth endpoints (not our code — Supabase Auth)

We rely on Supabase Auth for sign-in, invite emails, password reset. Our thin wrappers:

| Route | Purpose |
|---|---|
| `/auth/callback` (route handler) | Exchange PKCE `code` or OTP `token_hash` for a session — see `app/auth/callback/route.ts` |
| `/auth/set-password` (page) | First-time password set — client-side calls `supabase.auth.updateUser({ password })` |

---

## Adding a new endpoint

Checklist:

1. Under `app/api/…/route.ts`. Use `NextRequest` + typed `Ctx` for params.
2. First line: `await requireSession()` / `requireAdmin()` / `requireSuperadmin()` from `lib/authz.ts`.
3. For paid features, additionally check `tenants.features.<key>` — see `app/api/leads/[id]/activity/route.ts` POST for the pattern.
4. Use `createAdminClient()` from `lib/supabase/admin.ts` for writes that bypass RLS (only after permissions are verified).
5. Return `Response.json(…)` with an appropriate status code.
6. Add the route to this document.
