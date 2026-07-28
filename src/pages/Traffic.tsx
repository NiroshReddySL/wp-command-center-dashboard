import { useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Users, MousePointer, Clock, RefreshCw, Trash2, ExternalLink,
  Sparkles, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown, SlidersHorizontal, X, Check,
} from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import QueryError from '@/components/ui/QueryError'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import { SkeletonCard } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import StatusDot from '@/components/ui/StatusDot'
import Pagination from '@/components/ui/Pagination'
import AreaChart from '@/components/charts/AreaChart'
import ForecastChart, { type ForecastDataPoint } from '@/components/charts/ForecastChart'
import { useSiteContext } from '@/contexts/SiteContext'
import {
  useTrafficSummary,
  useTrafficTrend,
  useTrafficAlerts,
  useTopPages,
  useTrafficSnapshots,
  useGeoBreakdown,
  useFlushTraffic,
  useTrafficPredictions,
  useRegeneratePredictions,
  TRAFFIC_METRIC_OPTIONS,
  type TrafficMetric,
  type TrafficSnapshot,
} from '@/hooks/useTraffic'
import { formatNumber, timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15
const RANGE_OPTIONS: { value: 7 | 14 | 30 | 90; label: string }[] = [
  { value: 7, label: '7d' }, { value: 14, label: '14d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' },
]
const ALERT_SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
] as const
const ALERT_TYPE_OPTIONS = [
  { value: 'traffic_drop', label: 'Traffic drop' },
  { value: 'traffic_spike', label: 'Traffic spike' },
  { value: 'high_bounce_rate', label: 'High bounce rate' },
  { value: 'low_engagement', label: 'Low engagement' },
] as const
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'ga4', label: 'GA4' },
  { value: 'estimated', label: 'Estimated' },
] as const

type SnapSortField = 'date' | 'site_name' | 'pageviews' | 'sessions' | 'users' | 'bounce_rate' | 'avg_session_duration'

// Convert ISO 3166-1 alpha-2 code to flag emoji (e.g. "US" → 🇺🇸)
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  )
}

// ——— Shared segmented control (range toggle, metric toggle, horizon toggle) ————
function SegmentedControl<T extends string | number>({
  value, options, onChange, size = 'md',
}: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            'font-medium rounded-lg border transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]',
            value === opt.value
              ? 'bg-primary text-white border-primary'
              : 'bg-card dark:bg-card-dark border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary/50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ——— Sortable table header (client-side sort) ————————————————————
function SortableTh({
  label, field, sort, onSort, className,
}: {
  label: string
  field: SnapSortField
  sort: { field: SnapSortField; dir: 'asc' | 'desc' }
  onSort: (field: SnapSortField) => void
  className?: string
}) {
  const active = sort.field === field
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className={cn(
          'flex items-center gap-1 hover:text-text-primary dark:hover:text-text-primary-dark transition-colors',
          active ? 'text-primary dark:text-primary-dark font-semibold' : 'text-text-secondary dark:text-text-secondary-dark'
        )}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

// ——— Removable filter chip ————————————————————————————————————
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 dark:bg-primary-dark/15 text-primary dark:text-primary-dark text-[11px] font-medium">
      {label}
      <button onClick={onRemove} className="p-0.5 rounded-full hover:bg-primary/20 dark:hover:bg-primary-dark/25 transition-colors">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

// ——— Alerts advanced filter popover ————————————————————————————
function AlertFilterPanel({
  severity, type, onToggleSeverity, onToggleType, onClear, activeCount,
}: {
  severity: string[]
  type: string[]
  onToggleSeverity: (v: string) => void
  onToggleType: (v: string) => void
  onClear: () => void
  activeCount: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-8 flex items-center gap-1.5 px-3 rounded-md text-[12px] font-medium border transition-colors duration-150',
          activeCount > 0
            ? 'bg-primary/10 dark:bg-primary-dark/15 border-primary/40 dark:border-primary-dark/40 text-primary dark:text-primary-dark'
            : 'bg-card dark:bg-card-dark border-border dark:border-border-dark text-text-primary dark:text-text-primary-dark hover:bg-surface dark:hover:bg-surface-dark',
          open && 'ring-2 ring-primary/20 dark:ring-primary-dark/20'
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary dark:bg-primary-dark text-white text-[10px] font-semibold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[300px] rounded-lg border border-border dark:border-border-dark bg-white dark:bg-card-dark shadow-dropdown overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border dark:border-border-dark bg-surface/40 dark:bg-surface-dark/40">
            <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">Filters</span>
            {activeCount > 0 && (
              <button onClick={onClear} className="text-[11px] text-primary dark:text-primary-dark hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">Severity</p>
              <div className="flex flex-col gap-1.5">
                {ALERT_SEVERITY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-[12px] text-text-primary dark:text-text-primary-dark cursor-pointer">
                    <span
                      onClick={() => onToggleSeverity(opt.value)}
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        severity.includes(opt.value)
                          ? 'bg-primary border-primary dark:bg-primary-dark dark:border-primary-dark'
                          : 'border-border dark:border-border-dark'
                      )}
                    >
                      {severity.includes(opt.value) && <Check className="h-3 w-3 text-white" />}
                    </span>
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">Type</p>
              <div className="flex flex-col gap-1.5">
                {ALERT_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-[12px] text-text-primary dark:text-text-primary-dark cursor-pointer">
                    <span
                      onClick={() => onToggleType(opt.value)}
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        type.includes(opt.value)
                          ? 'bg-primary border-primary dark:bg-primary-dark dark:border-primary-dark'
                          : 'border-border dark:border-border-dark'
                      )}
                    >
                      {type.includes(opt.value) && <Check className="h-3 w-3 text-white" />}
                    </span>
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricTile({
  label, value, sub, icon, positive,
}: { label: string; value: string; sub?: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">{label}</span>
        <span className="text-text-secondary dark:text-text-secondary-dark">{icon}</span>
      </div>
      <p className="text-[22px] font-bold text-text-primary dark:text-text-primary-dark leading-none mb-1">{value}</p>
      {sub && (
        <p className={cn('text-[11px]', positive === undefined ? 'text-text-secondary dark:text-text-secondary-dark' : positive ? 'text-success' : 'text-danger')}>
          {sub}
        </p>
      )}
    </div>
  )
}

function ChangeBadge({ pct, hasComparison = true }: { pct: number; hasComparison?: boolean }) {
  if (!hasComparison) {
    return <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">—</span>
  }
  const pos = pct >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded',
      pos ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
    )}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function Traffic() {
  const { selectedSiteId } = useSiteContext()
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30)
  const [metric, setMetric] = useState<TrafficMetric>('pageviews')
  const [alertPage, setAlertPage] = useState(1)
  const [snapshotPage, setSnapshotPage] = useState(1)
  const [snapSort, setSnapSort] = useState<{ field: SnapSortField; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'desc' })
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ga4' | 'estimated'>('all')
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [predSiteIdx, setPredSiteIdx] = useState(0)
  const [horizon, setHorizon] = useState<7 | 14 | 30>(7)
  // When true, poll every 5s until data arrives (after flush or auto-trigger)
  const [collecting, setCollecting] = useState(false)
  const autoTriggered = useRef(false)

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useTrafficSummary(selectedSiteId || undefined, collecting)
  const { data: trend, isLoading: trendLoading } = useTrafficTrend(selectedSiteId || undefined, days, metric)
  const { data: alerts, isLoading: alertsLoading, isError: alertsError, refetch: refetchAlerts } = useTrafficAlerts(selectedSiteId || undefined)
  const { data: topPages, isLoading: topPagesLoading } = useTopPages(selectedSiteId || undefined, days)
  const { data: snapshots, isLoading: snapshotsLoading } = useTrafficSnapshots(selectedSiteId || undefined, days)
  // Forecast history needs a longer, stable lookback independent of the
  // Overview/Snapshots range toggle above — otherwise picking "7d" would
  // starve the forecast chart of history too.
  const { data: forecastHistory } = useTrafficSnapshots(selectedSiteId || undefined, 90)
  const { data: geo, isLoading: geoLoading } = useGeoBreakdown(selectedSiteId || undefined, days)
  const { data: predictions, isLoading: predictionsLoading } = useTrafficPredictions(selectedSiteId || undefined, horizon)
  const regenerate = useRegeneratePredictions()
  const flush = useFlushTraffic()
  const qc = useQueryClient()

  // Auto-trigger traffic collection if there's no data on first load
  useEffect(() => {
    if (summaryLoading || autoTriggered.current) return
    if (!summary || summary.length > 0) return
    autoTriggered.current = true
    setCollecting(true)
    flush.mutate(selectedSiteId || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot trigger; `flush` identity changes every render
  }, [summaryLoading, summary, selectedSiteId])

  // Stop collecting indicator once data arrives, or after 90s timeout
  useEffect(() => {
    if (!collecting) return
    if (summary && summary.length > 0) {
      setCollecting(false)
      // Summary landed — refresh the sibling tables (trend, alerts, snapshots…)
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('traffic') })
      return
    }
    const t = setTimeout(() => setCollecting(false), 90_000)
    return () => clearTimeout(t)
  }, [collecting, summary, qc])

  // Reset pagination whenever the underlying filtered set changes shape
  useEffect(() => { setSnapshotPage(1) }, [days, sourceFilter, selectedSiteId])
  useEffect(() => { setAlertPage(1) }, [severityFilter, typeFilter, selectedSiteId])
  useEffect(() => { setPredSiteIdx(0) }, [selectedSiteId, horizon])

  // Aggregate totals across sites
  const totals = summary?.reduce(
    (acc, s) => ({
      pageviews: acc.pageviews + s.pageviews_today,
      sessions: acc.sessions + s.sessions_today,
      users: acc.users + s.users_today,
    }),
    { pageviews: 0, sessions: 0, users: 0 }
  ) ?? { pageviews: 0, sessions: 0, users: 0 }

  const sitesWithComparison = summary?.filter((s) => s.has_comparison) ?? []
  const avgChangePct = sitesWithComparison.length
    ? sitesWithComparison.reduce((a, s) => a + s.change_pct, 0) / sitesWithComparison.length
    : null
  const anyStale = summary?.some((s) => s.is_stale) ?? false

  const avgBounce = summary?.length
    ? summary.reduce((a, s) => a + s.bounce_rate, 0) / summary.length
    : 0

  const avgDuration = summary?.length
    ? summary.reduce((a, s) => a + s.avg_session_duration, 0) / summary.length
    : 0

  // Chart series
  const trendSeries = trend && trend.length > 0
    ? Array.from(new Set(trend.flatMap((r) => Object.keys(r).filter((k) => k !== 'date'))))
        .map((key) => ({ key, label: key }))
    : []
  const trendFilled = trend?.map((row) => {
    const r: Record<string, unknown> = { date: row.date }
    trendSeries.forEach(({ key }) => { r[key] = (row[key] as number) ?? 0 })
    return r
  }) ?? []

  // Snapshots: client-side source filter + sort (dataset is already bounded/fully fetched)
  const filteredSnapshots = useMemo(() => {
    let rows = snapshots ?? []
    if (sourceFilter !== 'all') rows = rows.filter((s) => s.source === sourceFilter)
    const dir = snapSort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = a[snapSort.field]
      const bv = b[snapSort.field]
      if (av === bv) return 0
      return av < bv ? -1 * dir : 1 * dir
    })
  }, [snapshots, sourceFilter, snapSort])

  function handleSnapSort(field: SnapSortField) {
    setSnapSort((prev) => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' })
  }

  // Alerts: client-side severity/type filter
  const filteredAlerts = useMemo(() => {
    let rows = alerts ?? []
    if (severityFilter.length) rows = rows.filter((a) => severityFilter.includes(a.severity))
    if (typeFilter.length) rows = rows.filter((a) => typeFilter.includes(a.type))
    return rows
  }, [alerts, severityFilter, typeFilter])

  function toggleSeverity(v: string) {
    setSeverityFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }
  function toggleType(v: string) {
    setTypeFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }
  const alertFilterCount = severityFilter.length + typeFilter.length

  // Paginated slices
  const alertSlice = filteredAlerts.slice((alertPage - 1) * PAGE_SIZE, alertPage * PAGE_SIZE)
  const snapshotSlice = filteredSnapshots.slice((snapshotPage - 1) * PAGE_SIZE, snapshotPage * PAGE_SIZE)

  // Predictions: `predictions` has one entry per site. When "All sites" is
  // selected there can be several — always showing index 0 would silently
  // hide every other site's forecast, so a site picker appears once there's
  // more than one to choose from.
  const activePred = predictions?.[predSiteIdx] ?? predictions?.[0]
  const forecastChartData: ForecastDataPoint[] = (() => {
    if (!activePred) return []
    const forecastDates = new Set(activePred.daily_forecasts.map((f) => f.date))
    const historyPoints: ForecastDataPoint[] = (forecastHistory ?? [])
      .filter((s) => !forecastDates.has(s.date) && (activePred.site_id ? s.site_id === activePred.site_id : true))
      .map((s) => ({ date: s.date, actual: s.pageviews, base: null, optimistic: null, pessimistic: null }))
      .slice(-60) // cap history at 60 days for readability
    const forecastPoints: ForecastDataPoint[] = activePred.daily_forecasts.map((f) => ({
      date: f.date, actual: null, base: f.base, optimistic: f.optimistic, pessimistic: f.pessimistic,
    }))
    return [...historyPoints, ...forecastPoints].sort((a, b) => a.date.localeCompare(b.date))
  })()

  const handleFlush = () => {
    if (confirm('Flush traffic data and re-run the traffic agent?')) {
      setCollecting(true)
      flush.mutate(selectedSiteId || undefined)
    }
  }

  const metricLabel = TRAFFIC_METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? 'Pageviews'

  return (
    <PageShell
      title="Traffic"
      subtitle="Monitor pageviews, sessions, and engagement across all your sites."
    >
      {(summaryError || alertsError) && (
        <QueryError
          what="traffic data"
          onRetry={() => { refetchSummary(); refetchAlerts() }}
          className="-mt-2 mb-2"
        />
      )}

      {/* Controls */}
      <div className="flex items-center justify-between -mt-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">Range</span>
          <SegmentedControl value={days} options={RANGE_OPTIONS} onChange={setDays} size="sm" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={flush.isPending}
          onClick={handleFlush}
          className="flex items-center gap-1.5 text-text-secondary dark:text-text-secondary-dark"
        >
          <Trash2 className="h-3.5 w-3.5" /> Flush & Re-run
        </Button>
      </div>

      {/* Collecting banner */}
      {collecting && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-primary/8 border border-primary/20 rounded-lg text-[12px] text-primary mb-4">
          <RefreshCw className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
          Collecting traffic data — this usually takes 10–30 seconds. Page will update automatically.
        </div>
      )}

      {/* Stale-data banner */}
      {!collecting && anyStale && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning/8 border border-warning/20 rounded-lg text-[12px] text-warning mb-4">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Some sites haven't synced today's traffic yet — showing the most recent data available.
        </div>
      )}

      {/* Summary metric tiles */}
      <div className="grid grid-cols-4 gap-4">
        {summaryLoading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricTile
              label="Pageviews today"
              value={formatNumber(totals.pageviews)}
              icon={<MousePointer className="h-4 w-4" />}
              sub={avgChangePct != null ? `${avgChangePct >= 0 ? '+' : ''}${avgChangePct.toFixed(1)}% vs previous day` : 'No comparison data yet'}
              positive={avgChangePct != null ? avgChangePct >= 0 : undefined}
            />
            <MetricTile
              label="Sessions"
              value={formatNumber(totals.sessions)}
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <MetricTile
              label="Users"
              value={formatNumber(totals.users)}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricTile
              label="Avg session"
              value={avgDuration > 0 ? `${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s` : '—'}
              sub={avgBounce > 0 ? `${avgBounce.toFixed(1)}% bounce rate` : undefined}
              positive={avgBounce > 0 ? avgBounce < 60 : undefined}
              icon={<Clock className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="top-pages">Top Pages</TabsTrigger>
          <TabsTrigger value="snapshots">Daily Snapshots</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {(alerts?.length ?? 0) > 0 && (
              <Badge variant="warning" className="ml-1.5">{alerts!.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="predictions">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Predictions
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-5 gap-4">
            {/* Trend chart */}
            <Card className="col-span-3">
              <CardHeader className="flex-col items-start gap-2">
                <div className="flex items-center justify-between w-full">
                  <CardTitle>{metricLabel} — last {days} days</CardTitle>
                  <SegmentedControl value={metric} options={TRAFFIC_METRIC_OPTIONS} onChange={setMetric} size="sm" />
                </div>
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  {summary?.[0]?.source === 'ga4' ? 'Google Analytics · real data' : 'Estimated from post data'}
                </span>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : trendFilled.length > 0 ? (
                  <AreaChart data={trendFilled} series={trendSeries} height={200} formatter={(v) => formatNumber(v)} showLegend />
                ) : (
                  <EmptyState title="No trend data" description={collecting ? "Collecting now — data will appear shortly." : "Click Flush & Re-run to collect traffic data."} />
                )}
              </CardContent>
            </Card>

            {/* Per-site summary */}
            <div className="col-span-2 flex flex-col gap-3">
              {summaryLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : !summary?.length ? (
                <EmptyState
                  title="No traffic data yet"
                  description={collecting ? "Collecting now — refresh in a moment." : "Sync a site and connect Google Analytics, then click Flush & Re-run."}
                />
              ) : (
                summary.map((s) => (
                  <div key={s.site_id} className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark truncate">{s.site_name}</span>
                      <ChangeBadge pct={s.change_pct} hasComparison={s.has_comparison} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Views', value: formatNumber(s.pageviews_today) },
                        { label: 'Sessions', value: formatNumber(s.sessions_today) },
                        { label: 'Users', value: formatNumber(s.users_today) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{label}</p>
                          <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">{value}</p>
                        </div>
                      ))}
                    </div>
                    {s.is_stale && (
                      <p className="text-[10px] text-warning mt-2">Data as of {s.snapshot_date} — today not synced yet</p>
                    )}
                    {s.source === 'estimated' && (
                      <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark mt-2">
                        Estimated · Connect GA4 for real data
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Top Pages ────────────────────────────────────────────── */}
        <TabsContent value="top-pages">
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                Last {days} days{!selectedSiteId ? ' · all sites' : ''}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {topPagesLoading ? (
                <div className="p-6"><Skeleton className="h-64 w-full" /></div>
              ) : !topPages?.length ? (
                <div className="p-6">
                  <EmptyState title="No page data" description="Run the traffic agent to see top pages." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Page</TableHead>
                      {!selectedSiteId && <TableHead className="w-32">Site</TableHead>}
                      <TableHead className="w-32 text-right">Views</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPages.map((p, i) => {
                      const url = p.path || p.url || ''
                      const title = p.title || url
                      const max = topPages[0].views
                      const barPct = max > 0 ? (p.views / max) * 100 : 0
                      return (
                        <TableRow key={`${p.site_id}-${url || i}`}>
                          <TableCell className="text-[12px] text-text-secondary dark:text-text-secondary-dark">{i + 1}</TableCell>
                          <TableCell>
                            <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark truncate max-w-[360px]">{title}</p>
                            <div className="mt-1 h-1.5 w-full bg-surface dark:bg-surface-dark rounded-full overflow-hidden">
                              <div className="h-full bg-secondary rounded-full" style={{ width: `${barPct}%` }} />
                            </div>
                          </TableCell>
                          {!selectedSiteId && (
                            <TableCell>
                              <span className="text-[11px] bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">{p.site_name}</span>
                            </TableCell>
                          )}
                          <TableCell className="text-right text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">
                            {formatNumber(p.views)}
                          </TableCell>
                          <TableCell>
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Daily Snapshots ──────────────────────────────────────── */}
        <TabsContent value="snapshots">
          <div className="flex items-center justify-between mb-3">
            <SegmentedControl value={sourceFilter} options={SOURCE_OPTIONS} onChange={setSourceFilter} size="sm" />
            <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
              {filteredSnapshots.length} snapshot{filteredSnapshots.length === 1 ? '' : 's'} · last {days} days
            </span>
          </div>
          {snapshotsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !snapshots?.length ? (
            <EmptyState title="No snapshots" description="Run the traffic agent to start collecting daily snapshots." />
          ) : !filteredSnapshots.length ? (
            <EmptyState title="No results" description="No snapshots match the selected source filter." />
          ) : (
            <>
              <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTh label="Date" field="date" sort={snapSort} onSort={handleSnapSort} />
                      <SortableTh label="Site" field="site_name" sort={snapSort} onSort={handleSnapSort} />
                      <SortableTh label="Pageviews" field="pageviews" sort={snapSort} onSort={handleSnapSort} />
                      <SortableTh label="Sessions" field="sessions" sort={snapSort} onSort={handleSnapSort} />
                      <SortableTh label="Users" field="users" sort={snapSort} onSort={handleSnapSort} />
                      <SortableTh label="Bounce" field="bounce_rate" sort={snapSort} onSort={handleSnapSort} />
                      <SortableTh label="Avg Duration" field="avg_session_duration" sort={snapSort} onSort={handleSnapSort} />
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshotSlice.map((s: TrafficSnapshot) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-[12px]">{s.date}</TableCell>
                        <TableCell>
                          <span className="text-[11px] bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">{s.site_name}</span>
                        </TableCell>
                        <TableCell className="text-[12px] font-semibold">{formatNumber(s.pageviews)}</TableCell>
                        <TableCell className="text-[12px]">{formatNumber(s.sessions)}</TableCell>
                        <TableCell className="text-[12px]">{formatNumber(s.users)}</TableCell>
                        <TableCell className={`text-[12px] ${s.bounce_rate > 70 ? 'text-danger' : s.bounce_rate > 50 ? 'text-warning' : 'text-success'}`}>
                          {s.bounce_rate > 0 ? `${s.bounce_rate.toFixed(1)}%` : '—'}
                        </TableCell>
                        <TableCell className="text-[12px]">
                          {s.avg_session_duration > 0
                            ? `${Math.floor(s.avg_session_duration / 60)}m ${Math.floor(s.avg_session_duration % 60)}s`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.source === 'ga4' ? 'success' : 'info'} className="text-[10px]">
                            {s.source}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={snapshotPage} total={filteredSnapshots.length} pageSize={PAGE_SIZE} onPageChange={setSnapshotPage} />
            </>
          )}
        </TabsContent>

        {/* ── Geography ───────────────────────────────────────────── */}
        <TabsContent value="geography">
          {geoLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
          ) : !geo?.countries?.length ? (
            <EmptyState title="No geo data" description="Connect Google Analytics and run the traffic agent to see geographic breakdown." />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Region breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>By Region</CardTitle>
                    <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">Last {days} days</span>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2.5">
                      {(geo.regions ?? []).map((r) => (
                        <div key={r.region}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">{r.region}</span>
                            <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                              {formatNumber(r.views)} · {r.pct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface dark:bg-surface-dark rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary dark:bg-primary-dark transition-all"
                              style={{ width: `${r.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top cities */}
                <Card>
                  <CardHeader><CardTitle>Top Cities</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-1">
                      {(geo.cities ?? []).slice(0, 10).map((c, i) => (
                        <div key={`${c.city}-${i}`} className="flex items-center justify-between py-1.5 border-b border-border dark:border-border-dark last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark w-4">{i + 1}</span>
                            <span className="text-[12px] text-text-primary dark:text-text-primary-dark">{c.city}</span>
                            <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{c.country}</span>
                          </div>
                          <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">
                            {formatNumber(c.views)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Country table */}
              <Card>
                <CardHeader><CardTitle>By Country</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Pageviews</TableHead>
                        <TableHead>Sessions</TableHead>
                        <TableHead className="w-48">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {geo.countries.map((c, i) => (
                        <TableRow key={c.country_code}>
                          <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{i + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-[16px]">{countryFlag(c.country_code)}</span>
                              <span className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">{c.country}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[12px] font-semibold">{formatNumber(c.views)}</TableCell>
                          <TableCell className="text-[12px]">{formatNumber(c.sessions)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-surface dark:bg-surface-dark rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-secondary"
                                  style={{ width: `${c.pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark w-10 text-right">
                                {c.pct}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Alerts ───────────────────────────────────────────────── */}
        <TabsContent value="alerts">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {severityFilter.map((v) => (
                <FilterChip
                  key={v}
                  label={ALERT_SEVERITY_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  onRemove={() => toggleSeverity(v)}
                />
              ))}
              {typeFilter.map((v) => (
                <FilterChip
                  key={v}
                  label={ALERT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  onRemove={() => toggleType(v)}
                />
              ))}
            </div>
            <AlertFilterPanel
              severity={severityFilter}
              type={typeFilter}
              onToggleSeverity={toggleSeverity}
              onToggleType={toggleType}
              onClear={() => { setSeverityFilter([]); setTypeFilter([]) }}
              activeCount={alertFilterCount}
            />
          </div>
          {alertsLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !alerts?.length ? (
            <EmptyState title="No traffic alerts" description="No anomalies detected. Traffic looks stable." />
          ) : !filteredAlerts.length ? (
            <EmptyState title="No results" description="No alerts match the selected filters." />
          ) : (
            <>
              <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Alert</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Detected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertSlice.map((a) => {
                      const changePct = a.metadata?.change_pct as number | undefined
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <StatusDot status={a.severity as 'critical' | 'warning' | 'info'} pulse={a.severity === 'critical'} />
                          </TableCell>
                          <TableCell>
                            <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">{a.title}</p>
                            <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{a.description}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">{a.site_name}</span>
                          </TableCell>
                          <TableCell>
                            <code className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{a.type}</code>
                          </TableCell>
                          <TableCell>
                            {changePct != null ? <ChangeBadge pct={changePct} /> : '—'}
                          </TableCell>
                          <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                            {timeAgo(a.created_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={alertPage} total={filteredAlerts.length} pageSize={PAGE_SIZE} onPageChange={setAlertPage} />
            </>
          )}
        </TabsContent>
        {/* ── Predictions ─────────────────────────────────────────── */}
        <TabsContent value="predictions">
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SegmentedControl value={horizon} options={[{ value: 7, label: '7d' }, { value: 14, label: '14d' }, { value: 30, label: '30d' }]} onChange={setHorizon} />
            </div>
            <div className="flex items-center gap-3">
              {activePred?.generated_at && (
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  Generated {new Date(activePred.generated_at).toLocaleString()}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                loading={regenerate.isPending}
                onClick={() => regenerate.mutate({ site_id: selectedSiteId || undefined, horizon_days: horizon })}
                className="flex items-center gap-1.5 text-text-secondary dark:text-text-secondary-dark"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          </div>

          {/* Site picker — only needed when "All sites" is selected and more
              than one site has a forecast, so no site's data is ever silently
              dropped. */}
          {(predictions?.length ?? 0) > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {predictions!.map((p, i) => (
                <button
                  key={p.site_id}
                  onClick={() => setPredSiteIdx(i)}
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors',
                    predSiteIdx === i
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card dark:bg-card-dark border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary/50'
                  )}
                >
                  {p.site_name}
                </button>
              ))}
            </div>
          )}

          {predictionsLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : activePred?.insufficient_data ? (
            <EmptyState
              title="Not enough data"
              description="Need at least 14 days of traffic history to generate a forecast. Keep collecting data."
            />
          ) : !activePred ? (
            <EmptyState
              title="No predictions yet"
              description="Run the traffic agent first to collect snapshots, then predictions will be generated automatically."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Forecast chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Traffic Forecast — next {horizon} days{predictions && predictions.length > 1 ? ` · ${activePred.site_name}` : ''}</CardTitle>
                  <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    {activePred.model_version} · shaded band = pessimistic–optimistic range
                  </span>
                </CardHeader>
                <CardContent>
                  {forecastChartData.length > 0 ? (
                    <ForecastChart
                      data={forecastChartData}
                      boundaryDate={activePred.daily_forecasts[0]?.date ?? ''}
                      height={260}
                    />
                  ) : (
                    <Skeleton className="h-64 w-full" />
                  )}
                </CardContent>
              </Card>

              {/* Narrative */}
              {activePred.narrative && (
                <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl p-5">
                  <p className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Narrative
                  </p>
                  <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed whitespace-pre-line">
                    {activePred.narrative}
                  </p>
                </div>
              )}

              {/* Anomalies */}
              {activePred.anomalies.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Detected Anomalies</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-24">Severity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activePred.anomalies.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[12px]">{a.date}</TableCell>
                            <TableCell>
                              <code className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{a.type}</code>
                            </TableCell>
                            <TableCell className="text-[12px] text-text-primary dark:text-text-primary-dark">{a.description}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className={cn(
                                  'h-3.5 w-3.5',
                                  a.severity === 'high' ? 'text-danger' : a.severity === 'medium' ? 'text-warning' : 'text-text-secondary'
                                )} />
                                <span className={cn(
                                  'text-[11px] font-medium',
                                  a.severity === 'high' ? 'text-danger' : a.severity === 'medium' ? 'text-warning' : 'text-text-secondary'
                                )}>{a.severity}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
