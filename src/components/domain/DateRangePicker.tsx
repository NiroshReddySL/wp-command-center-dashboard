import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'

/** Mirrors GA4's own date-range picker — "realtime" is the one exception
 * (Active Users right now); everything else is a normal report range.
 * Shared by every page that offers this same picker (Live Visitors, Flow
 * Categories, ...) so they all resolve ranges identically. */
export type DateRangeKey = 'realtime' | 'today' | 'yesterday' | '7d' | '28d' | '90d' | 'qtd' | 'ytd' | 'custom'

/** Same as DateRangeKey minus "realtime" — a day-wise breakdown (or
 * anything that isn't inherently live) has no meaning for "right now", so
 * every range picker for those excludes that option. */
export type DailyRangeKey = Exclude<DateRangeKey, 'realtime'>

export const RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: 'realtime', label: 'Realtime' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '28d', label: 'Last 28 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'qtd', label: 'This Quarter' },
  { value: 'ytd', label: 'This Year' },
  { value: 'custom', label: 'Custom range' },
]

export const DAILY_RANGE_OPTIONS = RANGE_OPTIONS.filter((o) => o.value !== 'realtime') as
  { value: DailyRangeKey; label: string }[]

export function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** "Jul 15 – Jul 21, 2026" (shared year shown once), "Dec 29, 2025 – Jan 4,
 * 2026" (spans years), or just "Jul 21, 2026" for a single day. */
export function formatRangeLabel(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)
  if (startIso === endIso) {
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const sameYear = start.getFullYear() === end.getFullYear()
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' })
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

/** Plain "Jul 15 – Jul 21, 2026" / "Realtime" — used wherever the range
 * needs to read as a range, not as a column label. */
export function rangeSummaryLabel(rangeStart: string | null, rangeEnd: string | null): string {
  return rangeStart && rangeEnd ? formatRangeLabel(rangeStart, rangeEnd) : 'Realtime'
}

/** Shared draft-date-range logic: "From"/"To" restrict each other, but via
 * snapping the OTHER field when a change would violate From<=To — never via
 * native min/max cross-referencing the other field's current value, which
 * deadlocks (the browser's own date picker blocks selecting anything past
 * `max` before onChange ever fires, so once both are set, moving "From"
 * past the current "To" is refused with no way to move "To" out of the way
 * first). */
export function useSnappedDateRange(initialStart: string, initialEnd: string) {
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)

  const changeStart = (value: string) => {
    setStart(value)
    if (value && end && value > end) setEnd(value)
  }
  const changeEnd = (value: string) => {
    setEnd(value)
    if (value && start && value < start) setStart(value)
  }
  const reset = (newStart: string, newEnd: string) => {
    setStart(newStart)
    setEnd(newEnd)
  }

  return { start, end, changeStart, changeEnd, reset }
}

/** GA4-style custom range: both dates are drafted in a popover and only
 * take effect on "Apply" — picking a date never fires a request by itself.
 *
 * "From" and "To" restrict each other, but NOT via the native `min`/`max`
 * input attributes cross-referencing one another — that was the original
 * deadlock bug: the browser's own date picker blocks selecting anything
 * outside `max` before `onChange` ever fires, so once both dates are set,
 * moving "From" past the current "To" is refused by the calendar widget
 * itself, with no way to move "To" out of the way first. Each field is
 * only capped at "no future dates"; the From<=To invariant is instead
 * enforced by snapping the OTHER field the moment a change would violate
 * it — always achievable, never a standoff. */
export function CustomRangePicker({
  start, end, onApply,
}: { start: string; end: string; onApply: (start: string, end: string) => void }) {
  const [open, setOpen] = useState(false)
  const draft = useSnappedDateRange(start, end)
  const ref = useRef<HTMLDivElement>(null)
  const today = daysAgoIso(0)
  const bothDatesSet = Boolean(draft.start && draft.end)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openPicker = () => {
    draft.reset(start, end)
    setOpen(true)
  }

  const apply = () => {
    if (!bothDatesSet) return
    onApply(draft.start, draft.end)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openPicker}
        className={cn(
          'h-9 flex items-center gap-1.5 px-3 rounded-md text-[12px] font-medium',
          'border border-border dark:border-border-dark',
          'bg-surface/50 dark:bg-surface-dark/50 hover:bg-surface dark:hover:bg-surface-dark',
          'text-text-primary dark:text-text-primary-dark transition-colors duration-150',
          open && 'ring-1 ring-primary/30 dark:ring-primary-dark/30 border-primary/40 dark:border-primary-dark/40'
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 text-primary dark:text-primary-dark" />
        {formatRangeLabel(start, end)}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-64 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-card-dark shadow-dropdown overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border dark:border-border-dark bg-surface/40 dark:bg-surface-dark/40">
            <CalendarDays className="h-3.5 w-3.5 text-primary dark:text-primary-dark" />
            <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">
              Select date range
            </span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">From</label>
              <input
                type="date" value={draft.start} max={today}
                onChange={(e) => draft.changeStart(e.target.value)}
                className="h-9 rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">To</label>
              <input
                type="date" value={draft.end} max={today}
                onChange={(e) => draft.changeEnd(e.target.value)}
                className="h-9 rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15"
              />
            </div>
            {!bothDatesSet && (
              <p className="text-[11px] text-danger flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 flex-shrink-0" /> Both From and To dates are required.
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={!bothDatesSet} onClick={apply}>Apply</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** The full picker as one unit: the preset <Select>, plus the custom-range
 * popover whenever "custom" is selected — exactly the pairing every page
 * using this picker needs, so call sites don't re-assemble it by hand. */
export function RangeControl<T extends DateRangeKey>({
  value, onChange, options, customStart, customEnd, onCustomApply, className,
}: {
  value: T
  onChange: (range: T) => void
  options: { value: T; label: string }[]
  customStart: string
  customEnd: string
  onCustomApply: (start: string, end: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {value === 'custom' && (
        <CustomRangePicker start={customStart} end={customEnd} onApply={onCustomApply} />
      )}
      <Select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-40">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Select>
    </div>
  )
}
