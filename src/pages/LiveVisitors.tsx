import { useEffect, useRef, useState } from 'react'
import {
  Plus, Upload, Trash2, Radio, AlertCircle, ExternalLink, CalendarDays, Download, Loader2,
} from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import QueryError from '@/components/ui/QueryError'
import { useSiteContext } from '@/contexts/SiteContext'
import { useSites } from '@/hooks/useSites'
import {
  useWatchedUrls, useAddWatchedUrls, useAddWatchedUrlsCsv, useDeleteWatchedUrl,
  fetchDailyActiveUsers,
  type AddUrlsResult, type DateRangeKey, type DailyRangeKey,
  type WatchedUrl, type DailyActiveUsersResponse,
} from '@/hooks/useWatchedUrls'
import { cn, timeAgo } from '@/lib/utils'

function apiErrorDetail(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
}

// Same date-range vocabulary GA4's own reports offer — "Realtime" is the
// one option that isn't a fixed date range (Active Users right now).
const RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
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

// A day-wise breakdown has no meaning for "right now" — every picker for it
// offers everything except Realtime.
const DAILY_RANGE_OPTIONS = RANGE_OPTIONS.filter((o) => o.value !== 'realtime') as
  { value: DailyRangeKey; label: string }[]

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** "Jul 15 – Jul 21, 2026" (shared year shown once), "Dec 29, 2025 – Jan 4,
 * 2026" (spans years), or just "Jul 21, 2026" for a single day — used for
 * both the on-screen range picker and the dated "Active Users" label. */
function formatRangeLabel(startIso: string, endIso: string): string {
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
function rangeSummaryLabel(rangeStart: string | null, rangeEnd: string | null): string {
  return rangeStart && rangeEnd ? formatRangeLabel(rangeStart, rangeEnd) : 'Realtime'
}

/** The dated header requested for the Active Users column/CSV — shown on
 * both the on-screen table and the export, so they never disagree. */
function activeUsersLabel(rangeStart: string | null, rangeEnd: string | null): string {
  return `Active Users (${rangeSummaryLabel(rangeStart, rangeEnd)})`
}

/** Real calendar dates in the filename — never the preset key ("7d",
 * "custom", "today"). A single day collapses to one date, not a range. */
function filenameDateSuffix(rangeStart: string | null, rangeEnd: string | null): string {
  if (!rangeStart || !rangeEnd) return 'realtime'
  return rangeStart === rangeEnd ? rangeStart : `${rangeStart}_to_${rangeEnd}`
}

/** "1m 32s" / "45s" — seconds is what GA4 gives us, but nobody reads raw
 * seconds comfortably past about a minute. Null (Realtime has no such
 * metric) reads as a plain dash rather than "0s", which would look like data. */
function formatEngagementTime(seconds: number | null): string {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/** GA4 gives bounce rate as a 0-1 ratio — always shown as a percentage
 * with 1 decimal place, per this app's number-formatting convention. */
function formatBounceRate(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${(ratio * 100).toFixed(1)}%`
}

function formatAddedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type ExportColumnKey = 'title' | 'activeUsers' | 'avgEngagementTime' | 'bounceRate' | 'source' | 'added'

// Title/Active Users/Avg. Engagement Time/Bounce Rate are the analytics
// data most exports want; Source/Added are on-screen bookkeeping columns,
// so they're available to include but off by default.
const EXPORT_COLUMN_OPTIONS: { key: ExportColumnKey; label: string; defaultChecked: boolean }[] = [
  { key: 'title', label: 'Title', defaultChecked: true },
  { key: 'activeUsers', label: 'Active Users', defaultChecked: true },
  { key: 'avgEngagementTime', label: 'Avg. Engagement Time', defaultChecked: true },
  { key: 'bounceRate', label: 'Bounce Rate', defaultChecked: true },
  { key: 'source', label: 'Source', defaultChecked: false },
  { key: 'added', label: 'Added date', defaultChecked: false },
]

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function downloadCsv(rows: string[][], filename: string): void {
  const csvText = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function buildFilename(siteName: string | null | undefined, suffix: string): string {
  const safeSite = (siteName || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `live-visitors-${safeSite}-${suffix}.csv`
}

/** Current-view export — URL is always included; every other column is
 * whatever the user checked in the Export modal. */
function exportCurrentViewCsv(
  items: WatchedUrl[], siteName: string | null | undefined,
  rangeStart: string | null, rangeEnd: string | null,
  columns: Set<ExportColumnKey>,
): void {
  const header = ['URL']
  if (columns.has('title')) header.push('Title')
  if (columns.has('activeUsers')) header.push(activeUsersLabel(rangeStart, rangeEnd))
  if (columns.has('avgEngagementTime')) header.push('Avg. Engagement Time')
  if (columns.has('bounceRate')) header.push('Bounce Rate')
  if (columns.has('source')) header.push('Source')
  if (columns.has('added')) header.push('Added')

  const rows = items.map((item) => {
    const row = [item.url]
    if (columns.has('title')) row.push(item.title ?? '')
    if (columns.has('activeUsers')) row.push(String(item.active_users))
    if (columns.has('avgEngagementTime')) row.push(formatEngagementTime(item.avg_engagement_time))
    if (columns.has('bounceRate')) row.push(formatBounceRate(item.bounce_rate))
    if (columns.has('source')) row.push(item.source)
    if (columns.has('added')) row.push(formatAddedDate(item.created_at))
    return row
  })

  downloadCsv([header, ...rows], buildFilename(siteName, filenameDateSuffix(rangeStart, rangeEnd)))
}

/** Day-wise export — one row per URL, one column per calendar date. Title
 * is the only optional column (the daily endpoint doesn't carry source/
 * engagement data — those aren't computed per-day). */
function exportDailyCsv(
  data: DailyActiveUsersResponse, siteName: string | null | undefined, includeTitle: boolean,
): void {
  const header = ['URL', ...(includeTitle ? ['Title'] : []), ...data.dates]
  const rows = data.items.map((item) => [
    item.url, ...(includeTitle ? [item.title ?? ''] : []), ...data.dates.map((d) => String(item.daily[d] ?? 0)),
  ])
  const suffix = data.dates.length
    ? `${filenameDateSuffix(data.dates[0], data.dates[data.dates.length - 1])}-daily`
    : 'daily'
  downloadCsv([header, ...rows], buildFilename(siteName, suffix))
}

/** Shared draft-date-range logic: "From"/"To" restrict each other, but via
 * snapping the OTHER field when a change would violate From<=To — never via
 * native min/max cross-referencing the other field's current value, which
 * deadlocks (the browser's own date picker blocks selecting anything past
 * `max` before onChange ever fires, so once both are set, moving "From"
 * past the current "To" is refused with no way to move "To" out of the way
 * first). Shared by the header's CustomRangePicker and the export modal's
 * inline custom-range inputs so the fix lives in exactly one place. */
function useSnappedDateRange(initialStart: string, initialEnd: string) {
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
function CustomRangePicker({
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

function AddUrlsModal({ open, onClose, siteId }: { open: boolean; onClose: () => void; siteId: string | null }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<AddUrlsResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addUrls = useAddWatchedUrls(siteId)
  const addCsv = useAddWatchedUrlsCsv(siteId)

  const reset = () => { setText(''); setResult(null); setError('') }

  const handleAddManual = async () => {
    setError('')
    const urls = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!urls.length) { setError('Paste at least one URL or path.'); return }
    try {
      const res = await addUrls.mutateAsync(urls)
      setResult(res)
      setText('')
    } catch (err) {
      setError(apiErrorDetail(err, 'Failed to add URLs.'))
    }
  }

  const handleCsvSelect = async (file: File) => {
    setError('')
    try {
      const res = await addCsv.mutateAsync(file)
      setResult(res)
    } catch (err) {
      setError(apiErrorDetail(err, 'Failed to import CSV.'))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Add URLs to watch">
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
            Paste URLs or paths — one per line
          </label>
          <textarea
            rows={5}
            placeholder={'https://yoursite.com/pricing/\n/blog/my-post/\nmy-post'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1.5 w-full px-3 py-2 text-[13px] rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary resize-none"
          />
          <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-1">
            A full URL must belong to this site — a bare path or slug is resolved against it automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" loading={addUrls.isPending} onClick={handleAddManual}>
            <Plus className="h-3.5 w-3.5" /> Add URLs
          </Button>
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">or</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvSelect(e.target.files[0])}
          />
          <Button variant="secondary" size="sm" loading={addCsv.isPending}
            onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload CSV
          </Button>
        </div>

        {error && (
          <p className="text-[12px] text-danger flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </p>
        )}

        {result && (
          <div className="text-[12px] bg-surface dark:bg-surface-dark rounded-md p-3 space-y-1">
            <p className="text-success font-medium">{result.added.length} URL(s) added</p>
            {result.skipped_duplicate.length > 0 && (
              <p className="text-text-secondary dark:text-text-secondary-dark">
                {result.skipped_duplicate.length} already being watched
              </p>
            )}
            {result.invalid.length > 0 && (
              <div className="text-danger">
                {result.invalid.length} invalid:
                <ul className="list-disc list-inside">
                  {result.invalid.slice(0, 5).map((inv, i) => (
                    <li key={i}>{inv.input} — {inv.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={() => { onClose(); reset() }}>Done</Button>
        </div>
      </div>
    </Modal>
  )
}

type ExportMode = 'current' | 'daily'

function ExportModal({
  open, onClose, siteId, siteName, currentItems, currentRangeLabel, currentRangeStart, currentRangeEnd,
}: {
  open: boolean
  onClose: () => void
  siteId: string | null
  siteName: string | null | undefined
  currentItems: WatchedUrl[]
  currentRangeLabel: string
  currentRangeStart: string | null
  currentRangeEnd: string | null
}) {
  const [mode, setMode] = useState<ExportMode>('current')
  const [dailyRange, setDailyRange] = useState<DailyRangeKey>('7d')
  const daily = useSnappedDateRange(daysAgoIso(6), daysAgoIso(0))
  const [columns, setColumns] = useState<Set<ExportColumnKey>>(
    () => new Set(EXPORT_COLUMN_OPTIONS.filter((c) => c.defaultChecked).map((c) => c.key))
  )
  const [includeDailyTitle, setIncludeDailyTitle] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const today = daysAgoIso(0)

  const close = () => { onClose(); setError(''); setIsExporting(false) }

  const toggleColumn = (key: ExportColumnKey) => {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleExport = async () => {
    setError('')
    if (mode === 'current') {
      exportCurrentViewCsv(currentItems, siteName, currentRangeStart, currentRangeEnd, columns)
      close()
      return
    }

    if (dailyRange === 'custom' && !(daily.start && daily.end)) {
      setError('Choose both a From and To date.')
      return
    }
    if (!siteId) return

    setIsExporting(true)
    try {
      const data = await fetchDailyActiveUsers(siteId, dailyRange, daily.start, daily.end)
      exportDailyCsv(data, siteName, includeDailyTitle)
      close()
    } catch (err) {
      setError(apiErrorDetail(err, 'Failed to fetch day-wise data.'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Export options">
      <div className="flex flex-col gap-3">
        <label className={cn(
          'flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition-colors',
          mode === 'current'
            ? 'border-primary/50 bg-primary/5 dark:border-primary-dark/50 dark:bg-primary-dark/10'
            : 'border-border dark:border-border-dark hover:bg-surface/50 dark:hover:bg-surface-dark/50'
        )}>
          <input type="radio" name="export-mode" className="mt-0.5 accent-primary" checked={mode === 'current'}
            onChange={() => setMode('current')} />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">Current view</p>
            <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-2">
              Totals for {currentRangeLabel} · {currentItems.length} page{currentItems.length === 1 ? '' : 's'}
            </p>
            {mode === 'current' && (
              <div
                className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 border-t border-border/60 dark:border-border-dark/60"
                onClick={(e) => e.stopPropagation()}
              >
                {EXPORT_COLUMN_OPTIONS.map((col) => (
                  <label key={col.key} className="flex items-center gap-1.5 pt-1.5 text-[11.5px] text-text-primary dark:text-text-primary-dark cursor-pointer">
                    <input type="checkbox" className="accent-primary" checked={columns.has(col.key)}
                      onChange={() => toggleColumn(col.key)} />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className={cn(
          'flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition-colors',
          mode === 'daily'
            ? 'border-primary/50 bg-primary/5 dark:border-primary-dark/50 dark:bg-primary-dark/10'
            : 'border-border dark:border-border-dark hover:bg-surface/50 dark:hover:bg-surface-dark/50'
        )}>
          <input type="radio" name="export-mode" className="mt-0.5 accent-primary" checked={mode === 'daily'}
            onChange={() => setMode('daily')} />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">Day-by-day breakdown</p>
            <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-2">
              One column per day, for whichever range you pick below.
            </p>
            {mode === 'daily' && (
              <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <Select value={dailyRange} onChange={(e) => setDailyRange(e.target.value as DailyRangeKey)}>
                  {DAILY_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
                {dailyRange === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={daily.start} max={today}
                      onChange={(e) => daily.changeStart(e.target.value)}
                      className="h-9 flex-1 min-w-0 rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark" />
                    <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark flex-shrink-0">to</span>
                    <input type="date" value={daily.end} max={today}
                      onChange={(e) => daily.changeEnd(e.target.value)}
                      className="h-9 flex-1 min-w-0 rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark" />
                  </div>
                )}
                <label className="flex items-center gap-1.5 pt-0.5 text-[11.5px] text-text-primary dark:text-text-primary-dark cursor-pointer">
                  <input type="checkbox" className="accent-primary" checked={includeDailyTitle}
                    onChange={(e) => setIncludeDailyTitle(e.target.checked)} />
                  Include page title column
                </label>
              </div>
            )}
          </div>
        </label>

        {error && (
          <p className="text-[12px] text-danger flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" loading={isExporting} onClick={handleExport} className="flex items-center gap-1.5">
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function LiveVisitors() {
  const { selectedSiteId } = useSiteContext()
  const { data: sites } = useSites()
  const [showAdd, setShowAdd] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [range, setRange] = useState<DateRangeKey>('realtime')
  const [customStart, setCustomStart] = useState(() => daysAgoIso(7))
  const [customEnd, setCustomEnd] = useState(() => daysAgoIso(0))

  const { data, isLoading, isError, error, refetch } = useWatchedUrls(selectedSiteId, {
    range, startDate: customStart, endDate: customEnd,
  })
  const deleteUrl = useDeleteWatchedUrl(selectedSiteId)

  // A 422 means the date range itself was invalid (e.g. an incomplete
  // custom range slipped through) — that's a "fix your input" problem, not
  // a "something broke" problem, so it gets its own clear message instead
  // of the generic connection-failure banner.
  const invalidRangeStatus = (error as { response?: { status?: number } })?.response?.status
  const isInvalidRange = isError && invalidRangeStatus === 422

  const siteName = selectedSiteId ? sites?.find((s) => s.id === selectedSiteId)?.name : null

  return (
    <PageShell
      title="Live Visitors"
      subtitle="Track active users on the specific pages that matter most, over the same date ranges as GA4."
      actions={
        selectedSiteId ? (
          <>
            <Button variant="secondary" size="sm" disabled={!data?.items.length}
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add URLs
            </Button>
          </>
        ) : undefined
      }
    >
      {!selectedSiteId ? (
        <EmptyState
          title="Select a site"
          description="Pick a site from the site switcher above to manage its watched URLs."
        />
      ) : (
        <Card className="p-0">
          <CardHeader className="px-6 pt-5 pb-4 border-b border-border dark:border-border-dark mb-0 flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Watched pages{siteName ? ` — ${siteName}` : ''}
            </CardTitle>
            <div className="flex items-center gap-2">
              {data && !data.ga_connected && (
                <Badge variant="warning">Google Analytics not connected</Badge>
              )}
              {range === 'custom' && (
                <CustomRangePicker
                  start={customStart}
                  end={customEnd}
                  onApply={(start, end) => { setCustomStart(start); setCustomEnd(end) }}
                />
              )}
              <Select value={range} onChange={(e) => setRange(e.target.value as DateRangeKey)} className="w-40">
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isInvalidRange ? (
              <div className="p-6">
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-danger/25 bg-danger/5 px-6 py-10 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger">
                    <AlertCircle className="h-[18px] w-[18px]" />
                  </span>
                  <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
                    That date range isn&apos;t valid
                  </p>
                  <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark max-w-sm">
                    {apiErrorDetail(error, 'Please choose a From and To date and try again.')}
                  </p>
                </div>
              </div>
            ) : isError ? (
              <div className="p-6"><QueryError what="watched URLs" onRetry={() => refetch()} /></div>
            ) : isLoading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data?.items.length ? (
              <EmptyState
                title="No URLs watched yet"
                description="Add pages manually or upload a CSV to start tracking their active users."
                action={{ label: 'Add URLs', onClick: () => setShowAdd(true) }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="w-40">{activeUsersLabel(data.range_start, data.range_end)}</TableHead>
                    <TableHead className="w-36">Avg. Engagement Time</TableHead>
                    <TableHead className="w-28">Bounce Rate</TableHead>
                    <TableHead className="w-32">Added</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary dark:text-text-primary-dark hover:text-primary dark:hover:text-primary-dark">
                          <span className="line-clamp-1">{item.title || item.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 text-text-secondary dark:text-text-secondary-dark" />
                        </a>
                        <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark line-clamp-1">{item.url}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {range === 'realtime' && item.active_users > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                          )}
                          <span className={cn(
                            'inline-flex items-center justify-center min-w-[2.25rem] px-2 py-1 rounded-md text-[13px] font-semibold',
                            item.active_users > 0
                              ? 'bg-primary/10 text-primary dark:bg-primary-dark/15 dark:text-primary-dark'
                              : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark'
                          )}>
                            {item.active_users}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-text-primary dark:text-text-primary-dark">
                        {formatEngagementTime(item.avg_engagement_time)}
                      </TableCell>
                      <TableCell className="text-[13px] text-text-primary dark:text-text-primary-dark">
                        {formatBounceRate(item.bounce_rate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={item.source === 'csv' ? 'info' : 'default'}>{item.source}</Badge>
                          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                            {timeAgo(item.created_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm"
                          loading={deleteUrl.isPending && deleteUrl.variables === item.id}
                          onClick={() => deleteUrl.mutate(item.id)}
                          className="text-danger hover:bg-danger/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <AddUrlsModal open={showAdd} onClose={() => setShowAdd(false)} siteId={selectedSiteId} />
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        siteId={selectedSiteId}
        siteName={siteName}
        currentItems={data?.items ?? []}
        currentRangeLabel={rangeSummaryLabel(data?.range_start ?? null, data?.range_end ?? null)}
        currentRangeStart={data?.range_start ?? null}
        currentRangeEnd={data?.range_end ?? null}
      />
    </PageShell>
  )
}
