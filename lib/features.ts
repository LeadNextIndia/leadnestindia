// Per-tenant feature flags stored on tenants.features (JSONB).
// Superadmin toggles these from /superadmin/tenants/[id].

export type Features = {
  team: boolean       // Team management page
  export: boolean     // CSV export
  settings: boolean   // Settings page (coming soon)
  analytics: boolean  // Charts, advanced filter builder, saved views
  invoicing: boolean  // GST-compliant invoice generation
  activity: boolean   // Notes + activity timeline on each lead
}

export const DEFAULT_FEATURES: Features = {
  team: true,
  export: true,
  settings: false,
  analytics: false, // paid — off by default
  invoicing: false, // paid — off by default
  activity: false,  // paid — off by default
}

// Legacy tenant rows may not have every key. Merge with defaults.
export function withDefaults(input: Partial<Features> | null | undefined): Features {
  return { ...DEFAULT_FEATURES, ...(input ?? {}) }
}
