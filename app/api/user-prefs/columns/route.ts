import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

// Sanity limits so a malicious client can't push a giant blob into user_column_prefs
const MAX_FIELDS = 100
const MAX_KEY_LEN = 80

export async function GET(req: Request) {
  const session = await requireSession()
  if (!session.tenantId) return NextResponse.json({ visible_fields: null }, { status: 200 })

  const url = new URL(req.url)
  const viewKey = (url.searchParams.get('view_key') ?? '').trim()
  if (!viewKey) return NextResponse.json({ error: 'view_key required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_column_prefs')
    .select('visible_fields')
    .eq('user_id', session.user.id)
    .eq('tenant_id', session.tenantId)
    .eq('view_key', viewKey)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ visible_fields: data?.visible_fields ?? null })
}

export async function PUT(req: Request) {
  const session = await requireSession()
  if (!session.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as { view_key?: unknown; visible_fields?: unknown }
  const viewKey = typeof b.view_key === 'string' ? b.view_key.trim() : ''
  if (!viewKey || viewKey.length > 40) {
    return NextResponse.json({ error: 'view_key required (max 40 chars)' }, { status: 400 })
  }

  if (!Array.isArray(b.visible_fields)) {
    return NextResponse.json({ error: 'visible_fields must be an array' }, { status: 400 })
  }
  if (b.visible_fields.length > MAX_FIELDS) {
    return NextResponse.json({ error: `Too many fields (max ${MAX_FIELDS})` }, { status: 400 })
  }
  const fields: string[] = []
  for (const f of b.visible_fields) {
    if (typeof f !== 'string') {
      return NextResponse.json({ error: 'visible_fields must be an array of strings' }, { status: 400 })
    }
    if (f.length > MAX_KEY_LEN) {
      return NextResponse.json({ error: 'field key too long' }, { status: 400 })
    }
    fields.push(f)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_column_prefs')
    .upsert({
      user_id: session.user.id,
      tenant_id: session.tenantId,
      view_key: viewKey,
      visible_fields: fields,
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, visible_fields: fields })
}
