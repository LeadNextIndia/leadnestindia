import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'user'

export type Session = {
  user: User
  isSuperadmin: boolean
  tenantId: string | null
  role: Role | null
}

/** Returns the current session with role info, or null if signed out. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [saRes, tuRes] = await Promise.all([
    supabase.from('superadmins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  return {
    user,
    isSuperadmin: !!saRes.data,
    tenantId: tuRes.data?.tenant_id ?? null,
    role: (tuRes.data?.role ?? null) as Role | null,
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (!s) redirect('/login')
  return s
}

/** Requires the caller to be a tenant admin, or a superadmin. */
export async function requireAdmin(): Promise<Session> {
  const s = await requireSession()
  if (s.isSuperadmin) return s
  if (s.role !== 'admin') redirect('/dashboard')
  return s
}

/** Requires the caller to be a platform superadmin. */
export async function requireSuperadmin(): Promise<Session> {
  const s = await requireSession()
  if (!s.isSuperadmin) redirect('/dashboard')
  return s
}
