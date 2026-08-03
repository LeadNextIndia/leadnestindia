// Server-only convenience wrappers around lib/lead-modules.ts.
// Kept separate because they import `next/headers` (via lib/supabase/server),
// which would poison any client bundle that reaches into lib/lead-modules.ts.

import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  getModuleConfig,
  listModulesForTenant,
  type ModuleConfig,
  type ModuleSummary,
} from '@/lib/lead-modules'

export async function serverGetModuleConfig(
  tenantId: string,
  slug: string,
): Promise<ModuleConfig | null> {
  const supabase = await createServerClient()
  return getModuleConfig(supabase, tenantId, slug)
}

export async function serverListModules(tenantId: string): Promise<ModuleSummary[]> {
  const supabase = await createServerClient()
  return listModulesForTenant(supabase, tenantId)
}
