import { useMemo, useState } from 'react'
import { Plus, ShieldAlert, ArrowUpCircle, HelpCircle, CheckCircle2, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { useComponents, type SiteComponent } from '@/hooks/useComponents'
import { byRisk, countByStatus, statusOf, type ComponentStatus } from '@/lib/componentStatus'
import ComponentForm from './ComponentForm'
import ComponentTable from './ComponentTable'

type Filter = 'all' | ComponentStatus

const TILES: { key: Exclude<Filter, 'all'>; label: string; icon: typeof ShieldAlert; tone: string }[] = [
  { key: 'vulnerable', label: 'Vulnerable', icon: ShieldAlert, tone: 'text-danger' },
  { key: 'outdated', label: 'Update available', icon: ArrowUpCircle, tone: 'text-warning' },
  { key: 'untracked', label: 'Not tracked', icon: HelpCircle, tone: 'text-text-secondary dark:text-text-secondary-dark' },
  { key: 'current', label: 'Up to date', icon: CheckCircle2, tone: 'text-success' },
]

/**
 * Plugins and themes tracked for a site.
 *
 * Reading them from WordPress needs an Application Password, so this is also
 * where they get recorded by hand when there isn't one. Ordered by risk
 * rather than alphabetically: the reason to open this panel is to find what
 * needs attention, and that should never be a scrolling exercise.
 */
export default function ComponentInventory({ siteId }: { siteId?: string }) {
  const { data, isLoading } = useComponents(siteId)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const components = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => countByStatus(components), [components])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return components
      .filter((c) => filter === 'all' || statusOf(c) === filter)
      .filter((c) => !q || c.slug.includes(q) || (c.name ?? '').toLowerCase().includes(q))
      .sort(byRisk)
  }, [components, filter, search])

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary dark:text-text-primary-dark">
            Plugins &amp; Themes
          </h3>
          <p className="mt-0.5 text-[12px] text-text-secondary dark:text-text-secondary-dark">
            {counts.total === 0
              ? 'Nothing tracked yet — add components to check them for updates and known vulnerabilities.'
              : `${counts.total} tracked across this site`}
          </p>
        </div>
        {siteId && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add component
          </Button>
        )}
      </div>

      {counts.total > 0 && (
        <div className="grid grid-cols-2 gap-px border-y border-border bg-border dark:border-border-dark dark:bg-border-dark sm:grid-cols-4">
          {TILES.map((t) => {
            const value = counts[t.key]
            const active = filter === t.key
            return (
              <button
                key={t.key}
                onClick={() => setFilter(active ? 'all' : t.key)}
                aria-pressed={active}
                className={cn(
                  'group flex flex-col gap-1 px-5 py-4 text-left transition-colors',
                  active
                    ? 'bg-surface dark:bg-surface-dark'
                    : 'bg-card hover:bg-surface/50 dark:bg-card-dark dark:hover:bg-surface-dark/60'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {/* Icon + label always accompany the colour: the brand's
                      warning and danger hues are only ΔE 14.4 apart, so hue
                      alone cannot carry the distinction. */}
                  <t.icon className={cn('h-3.5 w-3.5', value > 0 ? t.tone : 'text-text-secondary/50')} />
                  <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">
                    {t.label}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-[22px] font-semibold leading-none',
                    value > 0
                      ? 'text-text-primary dark:text-text-primary-dark'
                      : 'text-text-secondary/40 dark:text-text-secondary-dark/40'
                  )}
                >
                  {value}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="p-6 pt-4">
        {!siteId && (
          <p className="rounded-lg border border-border bg-surface/40 px-4 py-3 text-[12px] text-text-secondary dark:border-border-dark dark:bg-surface-dark dark:text-text-secondary-dark">
            Select a single site to add or edit components.
          </p>
        )}

        {adding && siteId && <ComponentForm siteId={siteId} onDone={() => setAdding(false)} />}

        {counts.total > 4 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or slug"
              aria-label="Filter components"
              className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13px] text-text-primary transition-colors placeholder:text-text-secondary focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15 dark:border-border-dark dark:bg-card-dark dark:text-text-primary-dark"
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-1">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : components.length === 0 ? (
          !adding && (
            <EmptyState
              title="No components tracked"
              description="Connect an Application Password to read them from WordPress, or add them by hand."
            />
          )
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-text-secondary dark:text-text-secondary-dark">
            Nothing matches this filter.
          </p>
        ) : (
          <ComponentTable components={visible as SiteComponent[]} />
        )}
      </div>
    </div>
  )
}
