'use client'

import { useEffect, useState } from 'react'
import { SunIcon, MoonIcon } from './icons'

type Theme = 'light' | 'dark'

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // storage may be unavailable (private mode) — no-op
    }
  }, [theme])

  const isDark = theme === 'dark'
  const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={nextLabel}
      title={nextLabel}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] transition"
    >
      {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
    </button>
  )
}
