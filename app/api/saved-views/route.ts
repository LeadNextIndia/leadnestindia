import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await requireSession()
  if (!session.tenantId) return Response.json({ views: [] })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('saved_views')
    .select('id,name,filter,created_at')
    .eq('tenant_id', session.tenantId)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ views: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.tenantId) {
    return Response.json({ error: 'You are not attached to a tenant.' }, { status: 400 })
  }

  let body: { name?: string; filter?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 })
  if (name.length > 60) return Response.json({ error: 'Name must be under 60 characters.' }, { status: 400 })

  const filter = body.filter && typeof body.filter === 'object' ? body.filter : { conditions: [] }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('saved_views')
    .insert({
      tenant_id: session.tenantId,
      user_id: session.user.id,
      name,
      filter,
    })
    .select('id,name,filter,created_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A view with that name already exists.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}
