import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code      = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type      = url.searchParams.get('type')   // 'invite' | 'recovery' | 'email' …
  const next      = url.searchParams.get('next') ?? '/auth/set-password'

  const supabase = await createClient()

  // PKCE flow — sent when Supabase Auth has "Use PKCE flow" enabled (default for SSR)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }

  // OTP / email-link flow — older projects or Dashboard-sent invites
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }

  return NextResponse.redirect(
    new URL('/login?error=Invite+link+invalid+or+expired.+Request+a+new+one.', url.origin)
  )
}
