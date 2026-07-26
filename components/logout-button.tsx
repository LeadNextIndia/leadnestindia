'use client'

import { createClient } from '@/lib/supabase/client'
import { LogOutIcon } from './icons'

export function LogoutButton() {
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md px-2.5 py-1.5 hover:bg-gray-100 transition"
    >
      <LogOutIcon className="w-4 h-4" />
      <span>Log out</span>
    </button>
  )
}
