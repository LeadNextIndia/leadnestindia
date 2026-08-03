'use client'

import { useSyncExternalStore } from 'react'
import { SunIcon, MoonIcon } from './icons'

type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function getServerSnapshot(): Theme | null {
  // Server has no way to know the user's saved theme — return null so we
  // render a neutral placeholder until the client's first paint.
  return null
}

function setTheme(next: Theme) {
  const root = document.documentElement
  if (next === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  try {
    localStorage.setItem('theme', next)
  } catch {
    // storage may be unavailable (private mode) — no-op
  }
  listeners.forEach((cb) => cb())
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const isDark = theme === 'dark'
  const label = theme === null ? 'Toggle theme' : isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] transition"
    >
      {theme === null ? (
        <span className="w-4 h-4" aria-hidden />
      ) : isDark ? (
        <SunIcon className="w-4 h-4" />
      ) : (
        <MoonIcon className="w-4 h-4" />
      )}
    </button>
  )
}
