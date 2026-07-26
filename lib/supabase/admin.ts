import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS.
 * Server-side only. Callers MUST verify the current user's permissions first.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
