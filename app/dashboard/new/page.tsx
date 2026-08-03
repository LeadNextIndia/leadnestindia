import { redirect } from 'next/navigation'
import { getSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { getDefaultModule } from '@/lib/lead-modules'

// Legacy /dashboard/new → redirect to the default module's new-lead page.
export default async function LegacyNewLeadPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.tenantId) redirect('/dashboard')

  const supabase = await createClient()
  const def = await getDefaultModule(supabase, session.tenantId)
  if (!def) redirect('/dashboard/settings/modules')
  redirect(`/dashboard/m/${def.slug}/new`)
}
