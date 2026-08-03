'use client'

import { createContext, useContext } from 'react'
import type { ModuleConfig } from '@/lib/lead-modules'

const LeadModuleContext = createContext<ModuleConfig | null>(null)

export function LeadModuleProvider({
  value,
  children,
}: {
  value: ModuleConfig
  children: React.ReactNode
}) {
  return <LeadModuleContext.Provider value={value}>{children}</LeadModuleContext.Provider>
}

/**
 * Read the current module's config. Returns null outside a module route
 * (callers should fall back to hardcoded "Lead" copy when null).
 */
export function useLeadModule(): ModuleConfig | null {
  return useContext(LeadModuleContext)
}
