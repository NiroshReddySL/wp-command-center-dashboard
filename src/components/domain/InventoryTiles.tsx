import { ShieldAlert, ArrowUpCircle, HelpCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComponentStatus, StatusCounts } from '@/lib/componentStatus'

const TILES: {
  key: ComponentStatus
  label: string
  icon: typeof ShieldAlert
  tone: string
}[] = [
  { key: 'vulnerable', label: 'Vulnerable', icon: ShieldAlert, tone: 'text-danger' },
  { key: 'outdated', label: 'Update available', icon: ArrowUpCircle, tone: 'text-warning' },
  {
    key: 'untracked',
    label: 'Not tracked',
    icon: HelpCircle,
    tone: 'text-text-secondary dark:text-text-secondary-dark',
  },
  { key: 'current', label: 'Up to date', icon: CheckCircle2, tone: 'text-success' },
]

/**
 * Status counts that double as filters.
 *
 * The numbers are scoped to whatever type filter is active, so "Vulnerable 2"
 * under Themes means two themes — a single blended figure would leave you
 * unable to tell which kind of component needed attention.
 */
export default function InventoryTiles({
  counts,
  scope,
  active,
  onSelect,
}: {
  counts: StatusCounts
  /** Singular/plural noun for what the numbers count, or null when the view
   *  spans both types and the type tabs above already say so. Repeating a
   *  noun on all four tiles is noise; omitting it when it is ambiguous is
   *  worse. */
  scope: { one: string; many: string } | null
  active: ComponentStatus | 'all'
  onSelect: (next: ComponentStatus | 'all') => void
}) {
  return (
    <div
      className="grid grid-cols-2 gap-px border-y border-border bg-border dark:border-border-dark dark:bg-border-dark sm:grid-cols-4"
      role="group"
      aria-label={`Status of tracked ${scope?.many ?? 'components'}`}
    >
      {TILES.map((t) => {
        const value = counts[t.key]
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            onClick={() => onSelect(isActive ? 'all' : t.key)}
            aria-pressed={isActive}
            className={cn(
              'flex flex-col gap-1 px-5 py-4 text-left transition-colors',
              isActive
                ? 'bg-surface dark:bg-surface-dark'
                : 'bg-card hover:bg-surface/50 dark:bg-card-dark dark:hover:bg-surface-dark/60'
            )}
          >
            <span className="flex items-center gap-1.5">
              {/* Icon and label always accompany the colour: the brand's
                  warning and danger hues sit at ΔE 14.4, too close to carry
                  the distinction on their own. */}
              <t.icon className={cn('h-3.5 w-3.5', value > 0 ? t.tone : 'text-text-secondary/50')} />
              <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">
                {t.label}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
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
              {scope && (
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  {value === 1 ? scope.one : scope.many}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
