import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface SiteContextValue {
  selectedSiteId: string | null
  setSelectedSiteId: (id: string | null) => void
}

const SiteContext = createContext<SiteContextValue | null>(null)

const STORAGE_KEY = 'wpcc_selected_site'

export function SiteProvider({ children }: { children: ReactNode }) {
  const [selectedSiteId, setSelectedSiteIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? null
  })

  const setSelectedSiteId = useCallback((id: string | null) => {
    setSelectedSiteIdState(id)
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, id)
    }
  }, [])

  return (
    <SiteContext.Provider value={{ selectedSiteId, setSelectedSiteId }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSiteContext() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSiteContext must be used inside SiteProvider')
  return ctx
}
