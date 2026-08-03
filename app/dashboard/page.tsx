import { redirect } from 'next/navigation'
import { getSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { getDefaultModule } from '@/lib/lead-modules'

// The old /dashboard route now redirects to the tenant's default module.
// Kept as a stable entry point for existing bookmarks and internal links.
export default async function DashboardIndex() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.tenantId) {
    // Layout renders the "not in a store yet" limbo page for this case.
    return null
  }

  const supabase = await createClient()
  const def = await getDefaultModule(supabase, session.tenantId)

  // Every tenant has a default module after phase9 migration; if for some
  // reason it's missing (fresh install pre-migration), send the user to
  // settings where they can create one.
  if (!def) redirect('/dashboard/settings/modules')
  redirect(`/dashboard/m/${def.slug}`)
}
