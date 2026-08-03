import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireSession()
  const { id } = await ctx.params
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  if (!session.tenantId) return Response.json({ error: 'No tenant' }, { status: 400 })

  const supabase = await createClient()
  // Explicit ownership filter — belt-and-suspenders on top of RLS.
  // Prevents another user from deleting someone else's saved view by ID.
  const { error, count } = await supabase
    .from('saved_views')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', session.user.id)
    .eq('tenant_id', session.tenantId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (count === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
