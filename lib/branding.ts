import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fetch tenant branding: display name + a short-lived signed URL for the
 * background image (if configured). Returns nulls when the tenant has no
 * branding set.
 *
 * Signed URLs expire in 1 hour. Since pages are re-rendered on navigation,
 * this is refreshed frequently enough for interactive sessions.
 */
export async function getTenantBranding(tenantId: string | null): Promise<{
  displayName: string | null
  backgroundUrl: string | null
}> {
  if (!tenantId) return { displayName: null, backgroundUrl: null }

  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('display_name, background_path, name')
    .eq('id', tenantId)
    .maybeSingle()

  if (!data) return { displayName: null, backgroundUrl: null }

  const displayName = (data.display_name as string | null) || (data.name as string | null) || null

  let backgroundUrl: string | null = null
  if (data.background_path) {
    const signed = await admin.storage
      .from('branding')
      .createSignedUrl(data.background_path as string, 60 * 60)
    if (signed.data?.signedUrl) backgroundUrl = signed.data.signedUrl
  }

  return { displayName, backgroundUrl }
}
