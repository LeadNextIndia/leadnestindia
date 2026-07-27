import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_EXT: Record<(typeof ALLOWED_MIME)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// PATCH — update display_name (JSON body)
export async function PATCH(req: Request) {
  const session = await requireAdmin()
  if (!session.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = (body as { display_name?: unknown }).display_name
  if (raw !== null && typeof raw !== 'string') {
    return NextResponse.json({ error: 'display_name must be a string or null' }, { status: 400 })
  }
  const displayName = raw === null ? null : String(raw).trim().slice(0, 120) || null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants')
    .update({ display_name: displayName })
    .eq('id', session.tenantId)
    .select('id, display_name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'branding.display_name.update',
    target_type: 'tenants',
    target_id: session.tenantId,
    metadata: { display_name: displayName },
  })

  return NextResponse.json(data)
}

// POST — upload background image (multipart form-data with 'file' field)
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 })
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WEBP images are allowed' }, { status: 400 })
  }

  const ext = ALLOWED_EXT[file.type as (typeof ALLOWED_MIME)[number]]
  const path = `${session.tenantId}/background.${ext}`

  const admin = createAdminClient()
  const buf = new Uint8Array(await file.arrayBuffer())

  // Remove any older background file (different extension) first.
  const prior = await admin.storage.from('branding').list(session.tenantId, { limit: 20 })
  if (prior.data && prior.data.length > 0) {
    const toDelete = prior.data
      .map((o) => `${session.tenantId}/${o.name}`)
      .filter((p) => p !== path)
    if (toDelete.length > 0) await admin.storage.from('branding').remove(toDelete)
  }

  const uploadRes = await admin.storage.from('branding').upload(path, buf, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 500 })
  }

  const { data: updated, error: updateErr } = await admin
    .from('tenants')
    .update({ background_path: path })
    .eq('id', session.tenantId)
    .select('id, background_path')
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'branding.background.upload',
    target_type: 'tenants',
    target_id: session.tenantId,
    metadata: { path, size: file.size, mime: file.type },
  })

  return NextResponse.json(updated)
}

// DELETE — remove background image
export async function DELETE() {
  const session = await requireAdmin()
  if (!session.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const admin = createAdminClient()
  const prior = await admin.storage.from('branding').list(session.tenantId, { limit: 20 })
  if (prior.data && prior.data.length > 0) {
    const toDelete = prior.data.map((o) => `${session.tenantId}/${o.name}`)
    await admin.storage.from('branding').remove(toDelete)
  }

  const { error } = await admin
    .from('tenants')
    .update({ background_path: null })
    .eq('id', session.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'branding.background.remove',
    target_type: 'tenants',
    target_id: session.tenantId,
    metadata: {},
  })

  return NextResponse.json({ ok: true })
}
