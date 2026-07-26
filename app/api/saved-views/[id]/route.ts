import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  await requireSession()
  const { id } = await ctx.params

  const supabase = await createClient()
  const { error } = await supabase.from('saved_views').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
