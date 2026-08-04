// Per-tenant feature flags stored on tenants.features (JSONB).
// Superadmin toggles these from /superadmin/tenants/[id].

export type Features = {
  team: boolean          // Team management page
  export: boolean        // CSV export
  settings: boolean      // Settings page (legacy — Settings is now always on for admins)
  analytics: boolean     // Charts, advanced filter builder, saved views
  invoicing: boolean     // GST-compliant invoice generation
  activity: boolean      // Notes + activity timeline on each lead
  dashboard: boolean     // Standalone Dashboard view (KPIs + follow-ups)
  field_labels: boolean  // Admin can rename field labels in Settings
  multi_modules: boolean // Paid — create additional lead-like modules (Walk-in, Online Inquiry, etc.)
  kanban: boolean        // Paid — board view grouped by module status, drag cards between columns
}

export const DEFAULT_FEATURES: Features = {
  team: true,
  export: true,
  settings: false,
  analytics: false,   // paid — off by default
  invoicing: false,   // paid — off by default
  activity: false,    // paid — off by default
  dashboard: true,    // on by default — KPI overview
  field_labels: false, // opt-in — off by default
  multi_modules: false, // paid — off by default
  kanban: false,      // paid — off by default
}

// Legacy tenant rows may not have every key. Merge with defaults.
export function withDefaults(input: Partial<Features> | null | undefined): Features {
  return { ...DEFAULT_FEATURES, ...(input ?? {}) }
}
