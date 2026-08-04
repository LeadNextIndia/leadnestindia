// Configurable Lead modules (Phase 9).
//
// Each tenant has one or more `lead_modules`. The default one is created by
// the phase9 migration with slug='lead'. `module_fields` is a per-module
// override on the tenant's `field_definitions` catalog: presence means the
// field is part of the module; label/required can be overridden.
//
// This file is safe to import from client components — it only exports types
// and pure helpers, plus functions that TAKE a Supabase client as an argument
// (so they don't import next/headers themselves). Server-side convenience
// wrappers that create the client live in `lib/lead-modules-server.ts`.

export type ModuleSummary = {
  id: string
  slug: string
  singular: string
  plural: string
  icon: string | null
  sortOrder: number
  isDefault: boolean
  active: boolean
}

export type ResolvedFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'textarea'

export type ResolvedField = {
  fieldId: string
  key: string
  label: string
  type: ResolvedFieldType
  required: boolean
  options: string[] | null
  sortOrder: number
}

export type StatusColor =
  | 'gray'
  | 'blue'
  | 'indigo'
  | 'amber'
  | 'green'
  | 'red'
  | 'purple'
  | 'pink'
  | 'teal'

export type ModuleStatus = {
  id: string
  key: string
  label: string
  color: StatusColor
  sortOrder: number
  isDefault: boolean
  isTerminal: boolean
}

export type ModuleConfig = ModuleSummary & {
  fields: ResolvedField[]
  statuses: ModuleStatus[]
}

// Untyped Supabase client to sidestep generated-schema generics; every helper
// here narrows the row shape it returns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

function mapSummaryRow(row: {
  id: string
  slug: string
  singular: string
  plural: string
  icon: string | null
  sort_order: number | null
  is_default: boolean | null
  active: boolean | null
}): ModuleSummary {
  return {
    id: row.id,
    slug: row.slug,
    singular: row.singular,
    plural: row.plural,
    icon: row.icon ?? null,
    sortOrder: row.sort_order ?? 0,
    isDefault: !!row.is_default,
    active: row.active !== false,
  }
}

/** All active modules for a tenant, ordered by sort_order then created_at. */
export async function listModulesForTenant(
  supabase: SupabaseAny,
  tenantId: string,
): Promise<ModuleSummary[]> {
  const { data } = await supabase
    .from('lead_modules')
    .select('id,slug,singular,plural,icon,sort_order,is_default,active')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')

  return ((data ?? []) as Array<Parameters<typeof mapSummaryRow>[0]>).map(mapSummaryRow)
}

/**
 * Resolve a module by slug into the shape UI components consume.
 * Returns null if the slug doesn't exist for this tenant.
 * Fields are already ordered and filtered to visible=true.
 */
export async function getModuleConfig(
  supabase: SupabaseAny,
  tenantId: string,
  slug: string,
): Promise<ModuleConfig | null> {
  const { data: moduleRow } = await supabase
    .from('lead_modules')
    .select('id,slug,singular,plural,icon,sort_order,is_default,active')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .maybeSingle()

  if (!moduleRow) return null
  const summary = mapSummaryRow(moduleRow as Parameters<typeof mapSummaryRow>[0])

  const { data: fieldRows } = await supabase
    .from('module_fields')
    .select(
      'field_id,label_override,required_override,sort_order,visible,' +
        'field_definitions!inner(id,key,label,type,required,options,active)',
    )
    .eq('module_id', summary.id)
    .eq('visible', true)
    .order('sort_order')

  type FieldJoinRow = {
    field_id: string
    label_override: string | null
    required_override: boolean | null
    sort_order: number | null
    visible: boolean | null
    field_definitions: {
      id: string
      key: string
      label: string
      type: string
      required: boolean | null
      options: string[] | null
      active: boolean | null
    } | null
  }

  const fields: ResolvedField[] = ((fieldRows ?? []) as FieldJoinRow[])
    .filter((r) => r.field_definitions && r.field_definitions.active !== false)
    .map((r) => {
      const def = r.field_definitions!
      return {
        fieldId: def.id,
        key: def.key,
        label: r.label_override ?? def.label,
        type: (def.type as ResolvedFieldType) ?? 'text',
        required: r.required_override ?? !!def.required,
        options: def.options ?? null,
        sortOrder: r.sort_order ?? 0,
      }
    })

  const statuses = await listModuleStatuses(supabase, summary.id)
  return { ...summary, fields, statuses }
}

/** Statuses for a given module id (ordered by sort_order). */
export async function listModuleStatuses(
  supabase: SupabaseAny,
  moduleId: string,
): Promise<ModuleStatus[]> {
  const { data } = await supabase
    .from('module_statuses')
    .select('id,key,label,color,sort_order,is_default,is_terminal')
    .eq('module_id', moduleId)
    .order('sort_order')
    .order('created_at')

  type Row = {
    id: string
    key: string
    label: string
    color: string
    sort_order: number | null
    is_default: boolean | null
    is_terminal: boolean | null
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    color: (r.color as StatusColor) ?? 'gray',
    sortOrder: r.sort_order ?? 0,
    isDefault: !!r.is_default,
    isTerminal: !!r.is_terminal,
  }))
}

/** The tenant's default module (backfilled on migration; always exists). */
export async function getDefaultModule(
  supabase: SupabaseAny,
  tenantId: string,
): Promise<ModuleSummary | null> {
  const { data } = await supabase
    .from('lead_modules')
    .select('id,slug,singular,plural,icon,sort_order,is_default,active')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .maybeSingle()

  if (!data) return null
  return mapSummaryRow(data as Parameters<typeof mapSummaryRow>[0])
}

/**
 * Normalize an input string into a URL-safe slug matching the DB CHECK
 * constraint: lowercase, digits, hyphens; no leading/trailing hyphen.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
