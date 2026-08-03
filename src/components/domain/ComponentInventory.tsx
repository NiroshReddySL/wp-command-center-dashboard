import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { useComponents } from '@/hooks/useComponents'
import { byRisk, countByStatus, statusOf, type ComponentStatus } from '@/lib/componentStatus'
import ComponentForm from './ComponentForm'
import ComponentTable from './ComponentTable'
import InventoryTiles from './InventoryTiles'

type TypeFilter = 'all' | 'plugin' | 'theme'

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'plugin', label: 'Plugins' },
  { key: 'theme', label: 'Themes' },
]

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Plugins and themes tracked for a site.
 *
 * Ordered by risk rather than alphabetically: the reason to open this panel is
 * to find what needs attention, and that should never be a scrolling exercise.
 * Type and status filter independently, and the status counts follow the type
 * filter — a blended number leaves you unable to say whether the vulnerable
 * thing is a plugin or the theme.
 */
export default function ComponentInventory({ siteId }: { siteId?: string }) {
  const { data, isLoading } = useComponents(siteId)
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<ComponentStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const components = useMemo(() => data ?? [], [data])
  const plugins = useMemo(() => components.filter((c) => c.component_type === 'plugin'), [components])
  const themes = useMemo(() => components.filter((c) => c.component_type === 'theme'), [components])

  const scoped = type === 'all' ? components : type === 'plugin' ? plugins : themes
  const counts = useMemo(() => countByStatus(scoped), [scoped])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped
      .filter((c) => status === 'all' || statusOf(c) === status)
      .filter((c) => !q || c.slug.includes(q) || (c.name ?? '').toLowerCase().includes(q))
      .sort(byRisk)
  }, [scoped, status, search])

  // Null for "All": the type tabs already state the scope, so naming it on
  // every tile would just be four repetitions of the same word.
  const scopeNoun =
    type === 'plugin' ? { one: 'plugin', many: 'plugins' }
    : type === 'theme' ? { one: 'theme', many: 'themes' }
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card dark:border-border-dark dark:bg-card-dark">
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary dark:text-text-primary-dark">
            Plugins &amp; Themes
          </h3>
          <p className="mt-0.5 text-[12px] text-text-secondary dark:text-text-secondary-dark">
            {components.length === 0
              ? 'Nothing tracked yet — add components to check them for updates and known vulnerabilities.'
              : `${plural(plugins.length, 'plugin')} · ${plural(themes.length, 'theme')} tracked`}
          </p>
        </div>
        {siteId && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add component
          </Button>
        )}
      </div>

      {components.length > 0 && (
        <>
          <div className="flex gap-1 px-6 pb-3" role="tablist" aria-label="Component type">
            {TYPE_TABS.map((t) => {
              const n = t.key === 'all' ? components.length : t.key === 'plugin' ? plugins.length : themes.length
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={type === t.key}
                  onClick={() => { setType(t.key); setStatus('all') }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    type === t.key
                      ? 'bg-primary text-white dark:bg-primary-dark'
                      : 'text-text-secondary hover:bg-surface dark:text-text-secondary-dark dark:hover:bg-surface-dark'
                  )}
                >
                  {t.label}
                  <span className={cn('ml-1.5', type === t.key ? 'text-white/70' : 'opacity-60')}>{n}</span>
                </button>
              )
            })}
          </div>
          <InventoryTiles counts={counts} scope={scopeNoun} active={status} onSelect={setStatus} />
        </>
      )}

      <div className="p-6 pt-4">
        {!siteId && (
          <p className="rounded-lg border border-border bg-surface/40 px-4 py-3 text-[12px] text-text-secondary dark:border-border-dark dark:bg-surface-dark dark:text-text-secondary-dark">
            Select a single site to add or edit components.
          </p>
        )}

        {adding && siteId && <ComponentForm siteId={siteId} onDone={() => setAdding(false)} />}

        {scoped.length > 4 && (
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
            {scoped.length === 0
              ? `No ${scopeNoun?.many ?? 'components'} tracked yet.`
              : 'Nothing matches this filter.'}
          </p>
        ) : (
          <ComponentTable components={visible} />
        )}
      </div>
    </div>
  )
}
