// Per-tenant page layout configuration.
// Stored in `tenants.layout_config` (JSONB, added by phase8 migration).
//
// The shape is versioned by the `version` field so we can evolve it without
// breaking older stored configs. `withLayoutDefaults` merges any stored value
// with defaults so callers always get a fully-populated object.
//
// Section types are a fixed enum for now — CRM-specific pieces of the leads
// page. When we generalise to a real page builder (see the platform plan),
// this becomes a metadata-driven widget registry.

export const LEADS_PAGE_SECTION_TYPES = [
  'header',
  'follow_up_banner',
  'kpi_strip',
  'duplicate_hint',
  'leads_table',
] as const

export type LeadsPageSectionType = (typeof LEADS_PAGE_SECTION_TYPES)[number]

export type LeadsPageSection = {
  type: LeadsPageSectionType
  visible: boolean
}

export type LayoutConfig = {
  version: 1
  leadsPage: {
    sections: LeadsPageSection[]
  }
}

export const DEFAULT_LEADS_PAGE_SECTIONS: LeadsPageSection[] = [
  { type: 'header',           visible: true },
  { type: 'follow_up_banner', visible: true },
  { type: 'kpi_strip',        visible: true },
  { type: 'duplicate_hint',   visible: true },
  { type: 'leads_table',      visible: true },
]

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  version: 1,
  leadsPage: {
    sections: DEFAULT_LEADS_PAGE_SECTIONS,
  },
}

/** Merge a stored layout config with defaults. Safe against null / partial / older versions. */
export function withLayoutDefaults(input: unknown): LayoutConfig {
  const obj = (input ?? {}) as Partial<LayoutConfig>
  const sectionsIn = obj.leadsPage?.sections ?? []
  const seen = new Set<LeadsPageSectionType>()
  const merged: LeadsPageSection[] = []

  // Keep the stored order for any known types.
  for (const s of sectionsIn) {
    if (
      s &&
      typeof s === 'object' &&
      LEADS_PAGE_SECTION_TYPES.includes(s.type as LeadsPageSectionType) &&
      !seen.has(s.type as LeadsPageSectionType)
    ) {
      seen.add(s.type as LeadsPageSectionType)
      merged.push({ type: s.type as LeadsPageSectionType, visible: s.visible !== false })
    }
  }
  // Append any section type the stored config was missing, in default order.
  for (const def of DEFAULT_LEADS_PAGE_SECTIONS) {
    if (!seen.has(def.type)) merged.push(def)
  }

  return {
    version: 1,
    leadsPage: { sections: merged },
  }
}

/** Human-readable labels for the section-type dropdown / drag list. */
export const SECTION_META: Record<LeadsPageSectionType, { label: string; desc: string }> = {
  header:           { label: 'Header',             desc: 'Page title + "New" button' },
  follow_up_banner: { label: 'Follow-up banner',   desc: 'Overdue / due-today alert for the current user' },
  kpi_strip:        { label: 'KPI cards',          desc: 'Total / This week / New / Won / Lost counts' },
  duplicate_hint:   { label: 'Duplicate warning',  desc: 'Alert when duplicate field labels are auto-hidden' },
  leads_table:      { label: 'Records table',      desc: 'The main list with filters, search, saved views' },
}
