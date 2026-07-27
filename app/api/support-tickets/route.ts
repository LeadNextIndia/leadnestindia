import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SUBJECT = 200
const MAX_BODY = 5000
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export async function POST(req: Request) {
  const session = await requireSession()
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as { subject?: unknown; body?: unknown; priority?: unknown }
  const subject = typeof b.subject === 'string' ? b.subject.trim() : ''
  const description = typeof b.body === 'string' ? b.body.trim() : ''
  const priority = typeof b.priority === 'string' ? b.priority : 'normal'

  if (!subject || subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `Subject required (max ${MAX_SUBJECT} chars)` }, { status: 400 })
  }
  if (!description || description.length > MAX_BODY) {
    return NextResponse.json({ error: `Description required (max ${MAX_BODY} chars)` }, { status: 400 })
  }
  if (!PRIORITIES.includes(priority as typeof PRIORITIES[number])) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('support_tickets')
    .insert({
      tenant_id: session.tenantId,
      created_by: session.user.id,
      subject,
      body: description,
      priority,
    })
    .select('id, subject, priority, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('audit_log').insert({
    actor_user_id: session.user.id,
    tenant_id: session.tenantId,
    action: 'support_ticket.create',
    target_type: 'support_tickets',
    target_id: data.id,
    metadata: { subject, priority },
  })

  return NextResponse.json(data, { status: 201 })
}
