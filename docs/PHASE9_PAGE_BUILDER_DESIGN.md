# Phase 9 — Superadmin Drag-and-Drop Page Builder

**Status:** design proposal — no code yet.
**Purpose:** allow the platform superadmin to design each tenant's landing/dashboard layout visually, without code. Each tenant's layout is stored as JSON on `tenants.layout_config` (added in phase8.sql) and rendered at runtime.

Confirm the choices in §11 before Phase 9 build starts.

---

## 1. Goals & non-goals

### Goals
- **Visual layout designer** on `/superadmin/tenants/[id]/layout` — drag widgets onto a grid, drag to reorder, save.
- **Whitelisted widget catalog** — no arbitrary HTML; the builder picks from a fixed component list.
- **Per-tenant persistence** in `tenants.layout_config` JSONB.
- **Safe fallback** — if `layout_config` is null or invalid, render the current default layout (KPIs + follow-ups + Leads table). Nothing ever renders blank.
- **XSS-proof** — layouts hold widget *identifiers* + parameters, never HTML strings.

### Non-goals (Phase 9)
- Per-user layouts (all users of the tenant see the same layout for now).
- Cross-tenant sharing / templates (deferred to a Phase 10 marketplace).
- Layout versioning UI (we store `version: 1` internally but don't yet expose history).
- Runtime widget SDK for third parties.

---

## 2. Data model

### 2.1 Storage
Column added in `db/phase8.sql`:

```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS layout_config jsonb;
```

Read-path: only superadmin can write; every tenant member can read (RLS already restricts `tenants` to member/superadmin, which is sufficient).

### 2.2 JSON schema (v1)

```jsonc
{
  "version": 1,
  "target": "dashboard_overview",   // which page this layout controls
  "rows": [
    {
      "id": "row_1",
      "columns": [
        {
          "id": "col_1a",
          "width": 8,               // 1–12 grid columns
          "widgets": [
            { "id": "w1", "type": "kpi_total_leads" },
            { "id": "w2", "type": "kpi_this_week" }
          ]
        },
        {
          "id": "col_1b",
          "width": 4,
          "widgets": [
            { "id": "w3", "type": "follow_ups_summary" }
          ]
        }
      ]
    },
    {
      "id": "row_2",
      "columns": [
        {
          "id": "col_2a",
          "width": 12,
          "widgets": [
            { "id": "w4", "type": "leads_table", "config": { "limit": 10 } }
          ]
        }
      ]
    }
  ]
}
```

Rules:
- `width` per column sums to ≤ 12 within a row (validated at save time).
- `type` MUST be in the whitelist (§3). Unknown types are ignored at render (defensive), and the save endpoint rejects them (offensive).
- `config` is per-widget; each widget defines its own zod schema for the shape.
- `id` fields are UUIDs generated client-side for drag-tracking; not referenced elsewhere.

### 2.3 Validation with zod

At save time, the API route validates the whole tree against a zod schema. Widgets not in the whitelist fail validation. `config` is validated per-widget-type.

```ts
const WidgetSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('kpi_total_leads') }),
  z.object({ id: z.string(), type: z.literal('leads_table'),
             config: z.object({ limit: z.number().int().min(1).max(50) }).optional() }),
  // …one entry per whitelisted widget
])
```

---

## 3. Widget catalog (initial v1)

Each widget = one React component + one zod schema. Never mixes with tenant HTML.

| Widget `type` | Renders | Config |
|---|---|---|
| `kpi_total_leads` | KPI card: total lead count | — |
| `kpi_this_week` | KPI card: leads in the last 7 days | — |
| `kpi_new` | KPI card: new-status count | — |
| `kpi_won` | KPI card: won-status count | — |
| `kpi_lost` | KPI card: lost-status count | — |
| `kpi_conversion` | KPI card: won / total % | — |
| `follow_ups_summary` | Amber banner with overdue + due-today counts | — |
| `status_pie_chart` | Pie chart of lead status distribution | — |
| `weekly_timeline_chart` | Line chart of leads per day (last 14 days) | — |
| `leads_table` | Recent leads (compact) | `{ limit: 5–50 }` |
| `recent_activity` | Last N lead activity events | `{ limit: 5–20 }` |
| `open_tickets_summary` | Count of open support tickets (from Phase 7) | — |
| `text_block` | Static markdown-safe text (sanitized) | `{ markdown: string ≤ 2000 chars }` |

**All widgets have a fixed React component. Adding a widget = writing code + adding to the whitelist. There is no HTML injection surface.**

The `text_block` widget uses a hardened markdown renderer (`react-markdown` with default sanitize + no HTML passthrough) to prevent XSS even in the free-form field.

---

## 4. Rendering strategy

Layout rendering is 100% server-side to avoid layout-shift on load. Sketch:

```tsx
// app/dashboard/overview/page.tsx (Phase 9 revision)
const layout = await fetchLayout(session.tenantId)
const parsed = LayoutSchema.safeParse(layout)
if (!parsed.success) {
  // Fall back to default layout — never fail the page render.
  return <DefaultDashboard />
}

return (
  <div className="space-y-4">
    {parsed.data.rows.map((row) => (
      <div key={row.id} className="grid grid-cols-12 gap-4">
        {row.columns.map((col) => (
          <div key={col.id} className={`col-span-${col.width}`}>
            {col.widgets.map((w) => <WidgetRenderer key={w.id} widget={w} />)}
          </div>
        ))}
      </div>
    ))}
  </div>
)
```

`WidgetRenderer` is a lookup table:
```ts
const REGISTRY: Record<WidgetType, React.ComponentType<{ config?: unknown }>> = {
  kpi_total_leads: KpiTotalLeadsWidget,
  leads_table: LeadsTableWidget,
  // …
}

function WidgetRenderer({ widget }: { widget: Widget }) {
  const C = REGISTRY[widget.type]
  if (!C) return null            // unknown → silently skip (defense-in-depth)
  return <C config={widget.config} />
}
```

Because REGISTRY is a hard-coded object, **it is impossible for a malicious layout to load an arbitrary component**.

---

## 5. Builder UI (superadmin only)

Route: `/superadmin/tenants/[tenantId]/layout`

Screen split:
- **Left rail** (250px): widget palette — categorized (KPIs · Charts · Tables · Content). Each palette item is a draggable card.
- **Center canvas** (main): the current layout. Rows/columns/widgets; drag handles on each widget.
- **Right rail** (300px, collapsible): properties inspector when a widget is selected (for widgets with `config`).

Controls:
- **Add row** button below the last row.
- **Delete widget / column / row** on hover.
- **Reset to default** button (with confirm).
- **Save** button (primary, top-right).
- **Live preview** toggle: switches the canvas into a view-only "how it looks to users" mode.

### Drag-and-drop library

Recommendation: **`@dnd-kit/core`** + `@dnd-kit/sortable`.
- Actively maintained (Clauderr fork of the original @dnd-kit)
- Zero deps, ~8KB gzipped
- Works with server components fine (client boundary at the builder root)
- Simpler API than `react-dnd`, better for our use case than the grid-heavy `react-grid-layout`

Alternative considered: `react-grid-layout` — has nicer visual snap-to-grid but a bigger surface area and heavier bundle. Deferred until we need free-form pixel positioning (we don't — the 12-column grid is enough).

---

## 6. API surface

```
GET  /api/superadmin/tenant/[id]/layout    → returns current layout_config
PUT  /api/superadmin/tenant/[id]/layout    → { layout_config: <parsed JSON> }
DELETE /api/superadmin/tenant/[id]/layout  → sets layout_config to null (reset)
```

All three:
- Require `requireSuperadmin()`.
- Validate the body against the zod LayoutSchema.
- Write audit_log entry on every mutation.

---

## 7. Migration path for existing tenants

Phase 9.1 (additive): ship the migration + zod schema + renderer + a default layout constant. Every tenant's `layout_config` stays null → they see the built-in default. No user-visible change.

Phase 9.2: ship the builder UI on `/superadmin/tenants/[id]/layout`. Superadmin opt-in per tenant.

Phase 9.3: once we have positive feedback, offer per-role widget visibility (e.g. show/hide widget for admins vs users) if requested.

Each phase is deployable and reversible.

---

## 8. Security considerations

- **XSS**: widgets are picked from a fixed React registry — no arbitrary HTML. The only free-form widget (`text_block`) uses `react-markdown` with HTML disabled and default sanitize. Verified in tests.
- **Storage isolation**: layout_config is on `tenants` (already RLS'd). Only superadmin can write.
- **Config abuse**: every widget's `config` is validated by its own zod schema at save time. Numeric ranges are bounded (e.g. `limit ≤ 50`) to prevent an evil superadmin from crafting a widget that fetches 10M rows.
- **Audit**: every save is logged with `layout_config` before/after diff.

---

## 9. Performance considerations

- Layout rendering is 100% server-side in the same page component — no extra round-trips.
- Widgets that need data (leads_table, recent_activity, KPIs) share a single `leads` fetch at page level and pass it down as props. No N+1.
- Cache: layout_config rarely changes. Consider Next.js `unstable_cache` with tag `tenant-${id}-layout`; invalidate on save.
- Bundle: dnd-kit is only loaded inside the builder route, not the tenant-facing dashboard route.

---

## 10. Cost estimate

| Item | Days |
|---|---|
| Zod schema + type-safe widget registry + default layout | 1 |
| Renderer + default fallback + server rendering wiring | 1 |
| Builder UI (dnd-kit, palette, canvas, inspector, save/reset) | 4 |
| 13 widget components (KPIs, charts, table snippet, tickets, follow-ups, text) | 3 |
| Save/load API + audit + validation | 1 |
| Testing (unit + a Playwright smoke test) | 1.5 |
| Doc + admin walkthrough | 0.5 |
| **Total** | **~12 dev days** |

---

## 11. Open questions — needs your input before build

1. **Which page(s) should the builder control?** Options:
   - (a) Only `/dashboard/overview` (recommended — smallest scope, biggest win)
   - (b) Also `/dashboard` (the Leads table page) — but this page has table logic that isn't a "widget"
   - (c) A brand-new `/dashboard/home` route dedicated to layout-driven content
2. **Should the builder support tabs / multi-page layouts** in v1? I recommend no — start with one page, add tabs in v2.
3. **Per-tenant widget catalog restrictions** — e.g. hide the `invoicing_summary` widget from tenants without the invoicing feature flag. My recommendation: yes, filter the palette by the tenant's feature flags automatically.
4. **Preview-as-role** — should the superadmin be able to preview "how it looks to an `admin` vs `user`"? Not in v1 unless you want it.
5. **Layout templates** — do you want us to ship 2–3 built-in templates ("Sales-heavy", "Ops-focused") the superadmin can start from? +1 day.

---

## 12. Recommendation

Ship Phase 9.1 (schema + renderer + default layout) as a zero-risk foundation immediately after Phase 8 lands. Defer 9.2 (the builder UI) until you've locked answers to §11 questions 1–5.

Once 9.1 is deployed, we can offer manual layout editing via superadmin SQL as a stopgap while 9.2 is built.
