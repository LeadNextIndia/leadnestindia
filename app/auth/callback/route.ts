import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_NEXT = '/auth/set-password'

// Allowlist of paths a callback can redirect to. Prevents open-redirect
// attacks where an attacker crafts /auth/callback?...&next=https://evil.example.com
// or protocol-relative //evil.example.com.
const ALLOWED_NEXT_PREFIXES = ['/dashboard', '/superadmin', '/auth/set-password']

function safeNext(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT
  // Reject anything that isn't a pure path (protocol, //, backslash, whitespace)
  if (!raw.startsWith('/')) return DEFAULT_NEXT
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT
  if (raw.includes('://')) return DEFAULT_NEXT
  if (!ALLOWED_NEXT_PREFIXES.some((p) => raw === p || raw.startsWith(p + '/') || raw.startsWith(p + '?'))) {
    return DEFAULT_NEXT
  }
  return raw
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code      = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type      = url.searchParams.get('type')   // 'invite' | 'recovery' | 'email' …
  const next      = safeNext(url.searchParams.get('next'))

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
