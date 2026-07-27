import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSites } from '@/hooks/useSites'
import { useSiteContext } from '@/contexts/SiteContext'

function StatusDot({ status }: { status: 'active' | 'inactive' | 'error' }) {
  return (
    <span
      className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', {
        'bg-success': status === 'active',
        'bg-warning': status === 'inactive',
        'bg-danger': status === 'error',
      })}
    />
  )
}

export default function SitePicker() {
  const { data: sites } = useSites()
  const { selectedSiteId, setSelectedSiteId } = useSiteContext()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedSite = sites?.find((s) => s.id === selectedSiteId) ?? null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // If the persisted site no longer exists in the list, clear it
  useEffect(() => {
    if (sites && selectedSiteId && !sites.find((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(null)
    }
  }, [sites, selectedSiteId, setSelectedSiteId])

  return (
    <div ref={ref} className="relative px-3 py-2 border-b border-border dark:border-border-dark">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left',
          'transition-colors duration-150',
          'bg-surface/50 dark:bg-surface-dark/50 hover:bg-surface dark:hover:bg-surface-dark',
          'border border-border dark:border-border-dark',
          open && 'ring-1 ring-primary/30 dark:ring-primary-dark/30'
        )}
      >
        <Globe className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary dark:text-text-secondary-dark" />
        <div className="flex-1 min-w-0">
          {selectedSite ? (
            <>
              <div className="flex items-center gap-1.5">
                <StatusDot status={selectedSite.status} />
                <span className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark truncate">
                  {selectedSite.name}
                </span>
              </div>
              <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark truncate mt-0.5 pl-3">
                {selectedSite.url.replace(/^https?:\/\//, '')}
              </p>
            </>
          ) : (
            <span className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
              All Sites
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-text-secondary dark:text-text-secondary-dark transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-50 mt-1 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-card-dark shadow-lg overflow-hidden">
          <div className="py-1">
            <button
              onClick={() => { setSelectedSiteId(null); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left',
                'transition-colors duration-100 hover:bg-surface dark:hover:bg-surface-dark',
                !selectedSiteId && 'bg-surface dark:bg-surface-dark'
              )}
            >
              <Globe className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary dark:text-text-secondary-dark" />
              <span className="flex-1 text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
                All Sites
              </span>
              {!selectedSiteId && (
                <Check className="h-3.5 w-3.5 text-primary dark:text-primary-dark flex-shrink-0" />
              )}
            </button>

            {sites && sites.length > 0 && (
              <div className="my-1 border-t border-border dark:border-border-dark" />
            )}

            {sites?.map((site) => (
              <button
                key={site.id}
                onClick={() => { setSelectedSiteId(site.id); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left',
                  'transition-colors duration-100 hover:bg-surface dark:hover:bg-surface-dark',
                  selectedSiteId === site.id && 'bg-surface dark:bg-surface-dark'
                )}
              >
                <StatusDot status={site.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark truncate">
                    {site.name}
                  </p>
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark truncate">
                    {site.url.replace(/^https?:\/\//, '')}
                  </p>
                </div>
                {selectedSiteId === site.id && (
                  <Check className="h-3.5 w-3.5 text-primary dark:text-primary-dark flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
