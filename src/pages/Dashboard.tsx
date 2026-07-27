import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, FileText, Server, Globe, TrendingUp, TrendingDown, Minus, Zap, ArrowUpRight, BarChart2 } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import MetricCard from '@/components/ui/MetricCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import Skeleton from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import AlertFeedItem from '@/components/domain/AlertFeedItem'
import SiteHealthCard from '@/components/domain/SiteHealthCard'
import AgentStatusCard from '@/components/domain/AgentStatusCard'
import QueryError from '@/components/ui/QueryError'
import ActivityTimeline from '@/components/domain/ActivityTimeline'
import AreaChart from '@/components/charts/AreaChart'
import HealthRing from '@/components/charts/HealthRing'
import {
  useDashboardMetrics,
  usePriorityQueue,
  useTrafficOverview,
  useActivity,
  useGoogleStatus,
  useAgentSummary,
  isGaTraffic,
  type GaTrafficPoint,
  type SiteTrafficItem,
  type PriorityItem,
} from '@/hooks/useMetrics'
import { useSites } from '@/hooks/useSites'
import { useDismissAlert } from '@/hooks/useAlerts'
import { useSiteContext } from '@/contexts/SiteContext'
import { formatPercent, formatNumber } from '@/lib/utils'

const AGENT_ROUTE: Record<string, string> = {
  watchdog: '/watchdog',
  optimizer: '/optimizer',
  autopilot: '/review',
}

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedSiteId, setSelectedSiteId } = useSiteContext()
  const { data: metrics, isLoading: metricsLoading, isError: metricsError } = useDashboardMetrics()
  const { data: queue, isLoading: queueLoading, isError: queueError, refetch: refetchQueue } = usePriorityQueue()
  const { data: traffic, isLoading: trafficLoading } = useTrafficOverview()
  const { data: activity, isLoading: activityLoading } = useActivity()
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: googleStatus } = useGoogleStatus()
  const { data: agents, isLoading: agentsLoading } = useAgentSummary(selectedSiteId)
  const dismiss = useDismissAlert()

  // "Fix"/"Review" → focus the relevant site and jump to the agent that owns it
  function resolveAlert(item: PriorityItem) {
    setSelectedSiteId(item.site_id)
    navigate(AGENT_ROUTE[item.agent] ?? '/watchdog')
  }

  const selectedSite = selectedSiteId ? sites?.find((s) => s.id === selectedSiteId) : null

  // Apply site filter to list-based data
  const filteredSites = selectedSiteId ? sites?.filter((s) => s.id === selectedSiteId) : sites
  const filteredQueue = selectedSiteId ? queue?.filter((item) => item.site_id === selectedSiteId) : queue
  const filteredActivity = selectedSiteId
    ? activity?.filter((item) => selectedSite && item.site_name === selectedSite.name)
    : activity

  const trendDiff =
    metrics?.health_trend && metrics.health_trend.length > 1
      ? metrics.health_trend[metrics.health_trend.length - 1] - metrics.health_trend[0]
      : 0

  const gaMode = traffic && traffic.length > 0 && isGaTraffic(traffic)
  const gaData = gaMode ? (traffic as GaTrafficPoint[]) : null
  const fallbackData = !gaMode ? (traffic as SiteTrafficItem[] | undefined) : null

  // Filter GA series to selected site; filter fallback rows by site_id
  const filteredFallback = selectedSiteId
    ? fallbackData?.filter((item) => item.site_id === selectedSiteId)
    : fallbackData

  // Collect site-name keys — filtered to selected site when one is chosen
  const gaSeries = gaData
    ? Array.from(
        new Set(gaData.flatMap((row) => Object.keys(row).filter((k) => k !== 'date')))
      )
        .filter((key) => !selectedSite || key === selectedSite.name)
        .map((key) => ({ key, label: key }))
    : []

  // Fill missing site values with 0 so Recharts draws a continuous line
  const gaDataFilled = gaData?.map((row) => {
    const filled: GaTrafficPoint = { date: row.date }
    gaSeries.forEach(({ key }) => { filled[key] = (row[key] as number) ?? 0 })
    return filled
  }) ?? []

  // ── Hero summary ──────────────────────────────────────────────────────────
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const scope = filteredSites ?? []
  const healthy = scope.filter((s) => s.status === 'active' && s.health_score >= 80).length
  const degraded = scope.filter((s) => s.status === 'active' && s.health_score < 80).length
  const down = scope.filter((s) => s.status !== 'active').length

  const displayHealth = selectedSite ? selectedSite.health_score : metrics?.avg_health_score ?? 0
  const openIssues = filteredQueue?.length ?? metrics?.total_issues ?? 0

  // Never claim "running smoothly" when the data itself failed to load
  const heroLine = metricsError || queueError
    ? 'Live status is unavailable — the API is not responding. Figures below may be stale.'
    : selectedSite
      ? `${selectedSite.name} is at ${displayHealth}% health with ${selectedSite.issues_count ?? 0} open issue${(selectedSite.issues_count ?? 0) === 1 ? '' : 's'}.`
      : openIssues > 0
        ? `${openIssues} item${openIssues === 1 ? '' : 's'} need${openIssues === 1 ? 's' : ''} your attention across ${scope.length} site${scope.length === 1 ? '' : 's'}.`
        : `All ${scope.length} site${scope.length === 1 ? '' : 's'} are running smoothly. Nothing needs you right now.`

  const TrendIcon = trendDiff > 0 ? TrendingUp : trendDiff < 0 ? TrendingDown : Minus

  return (
    <PageShell>
      {/* Hero command band */}
      {metricsLoading || sitesLoading ? (
        <Skeleton className="h-[180px] w-full rounded-xl" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-secondary p-6 shadow-card"
        >
          {/* glow accents */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/70">
                <Zap className="h-3.5 w-3.5" />
                Command Center
              </div>
              <h2 className="mt-2 text-[24px] font-semibold leading-tight text-white">
                {greeting}.
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-white/80">{heroLine}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusPill color="bg-emerald-300" label={`${healthy} healthy`} />
                {degraded > 0 && <StatusPill color="bg-amber-300" label={`${degraded} degraded`} />}
                {down > 0 && <StatusPill color="bg-rose-300" label={`${down} down`} />}
                {metrics?.uptime_percent != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                    <Server className="h-3 w-3" />
                    {formatPercent(metrics.uptime_percent, 2)} uptime
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-center">
              <HealthRing value={displayHealth}>
                <span className="text-[34px] font-bold leading-none text-white">{displayHealth}</span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/70">
                  Health
                </span>
              </HealthRing>
              {!selectedSite && trendDiff !== 0 && (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-white/80">
                  <TrendIcon className="h-3 w-3" />
                  {trendDiff > 0 ? '+' : ''}{trendDiff} pts · 30d
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Metrics row */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-4 gap-4">
        <motion.div variants={fadeUp}>
          {metricsLoading ? <SkeletonCard /> : (
            <MetricCard
              label="Open Issues"
              value={metrics?.total_issues ?? 0}
              trend={metrics?.total_issues_change ?? undefined}
              invertTrend
              trendLabel="vs last week"
              icon={<AlertTriangle className="h-4 w-4" />}
              accent={
                (metrics?.total_issues ?? 0) > 10 ? 'danger'
                : (metrics?.total_issues ?? 0) > 5 ? 'warning'
                : 'success'
              }
              valueClassName={
                (metrics?.total_issues ?? 0) > 10 ? 'text-danger'
                : (metrics?.total_issues ?? 0) > 5 ? 'text-warning'
                : 'text-success'
              }
            />
          )}
        </motion.div>

        <motion.div variants={fadeUp}>
          {metricsLoading ? <SkeletonCard /> : (
            <MetricCard
              label="Content Published"
              value={metrics?.content_published_week ?? 0}
              trend={metrics?.content_published_change ?? undefined}
              trendLabel="vs last week"
              icon={<FileText className="h-4 w-4" />}
              accent="primary"
            />
          )}
        </motion.div>

        <motion.div variants={fadeUp}>
          {metricsLoading ? <SkeletonCard /> : (
            <MetricCard
              label="Sites Monitored"
              value={sites?.length ?? 0}
              icon={<Globe className="h-4 w-4" />}
              accent="secondary"
            />
          )}
        </motion.div>

        <motion.div variants={fadeUp}>
          {metricsLoading ? <SkeletonCard /> : (
            <MetricCard
              label="Uptime"
              value={metrics?.uptime_percent != null ? formatPercent(metrics.uptime_percent, 2) : '—'}
              icon={<Server className="h-4 w-4" />}
              accent="success"
              valueClassName={
                metrics?.uptime_percent == null
                  ? 'text-text-secondary dark:text-text-secondary-dark'
                  : 'text-success'
              }
            />
          )}
        </motion.div>
      </motion.div>

      {/* Agent command strip */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">
            Agents
          </h3>
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            Live status across your sites
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {agentsLoading || !agents
            ? [...Array(3)].map((_, i) => <SkeletonCard key={i} className="h-[148px]" />)
            : (['watchdog', 'optimizer', 'autopilot'] as const).map((name) => {
                const summary = agents.find((a) => a.agent === name) ?? {
                  agent: name,
                  open_count: 0,
                  critical_count: 0,
                  last_activity_at: null,
                }
                return (
                  <AgentStatusCard
                    key={name}
                    summary={summary}
                    onClick={() => navigate(AGENT_ROUTE[name])}
                  />
                )
              })}
        </div>
      </div>

      {/* Priority Queue */}
      <Card className="p-0">
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border dark:border-border-dark mb-0">
          <CardTitle className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Needs your attention
            {filteredQueue && filteredQueue.length > 0 && <Badge variant="critical">{filteredQueue.length}</Badge>}
          </CardTitle>
          <button
            onClick={() => navigate('/watchdog')}
            className="flex items-center gap-0.5 text-[12px] font-medium text-primary dark:text-primary-dark hover:underline"
          >
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {queueError ? (
            <QueryError what="the priority queue" onRetry={() => refetchQueue()} className="m-4" />
          ) : queueLoading ? (
            <div className="p-4 flex flex-col gap-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !filteredQueue?.length ? (
            <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark text-center py-10">
              All clear — no urgent items right now
            </p>
          ) : (
            <div className="divide-y divide-border dark:divide-border-dark">
              {filteredQueue.map((item) => (
                <AlertFeedItem
                  key={item.id}
                  alert={item}
                  onClick={() => resolveAlert(item)}
                  onAction={() => resolveAlert(item)}
                  onDismiss={(id) => dismiss.mutate(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Traffic + Sites grid */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <Card>
            <CardHeader className="items-start">
              <div>
                <CardTitle className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
                    <BarChart2 className="h-4 w-4" />
                  </span>
                  Traffic Overview
                  {googleStatus?.connected && (
                    <span className="ml-1 text-[10px] font-normal text-success bg-success/10 px-2 py-0.5 rounded-full">
                      Google Analytics
                    </span>
                  )}
                </CardTitle>
                <span className="mt-1 block pl-[38px] text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  {gaMode ? 'Last 30 days · real data' : 'Last 30 days · from synced posts'}
                </span>
              </div>
              <button
                onClick={() => navigate('/traffic')}
                className="flex items-center gap-0.5 text-[12px] font-medium text-primary dark:text-primary-dark hover:underline"
              >
                Details <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </CardHeader>
            <CardContent>
              {trafficLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : gaMode && gaDataFilled.length > 0 ? (
                <AreaChart
                  data={gaDataFilled}
                  series={gaSeries}
                  height={220}
                  formatter={(v) => formatNumber(v)}
                  showLegend
                />
              ) : filteredFallback && filteredFallback.length > 0 ? (
                <div className="flex flex-col gap-3 pt-1">
                  {filteredFallback.map((item) => {
                    const max = Math.max(...filteredFallback.map((t) => t.traffic_30d), 1)
                    const pct = (item.traffic_30d / max) * 100
                    return (
                      <div key={item.site_id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
                            {item.site_name}
                          </span>
                          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                            {formatNumber(item.traffic_30d)} views · {item.post_count} posts
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-border dark:bg-border-dark overflow-hidden">
                          <div className="h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark pt-1">
                    Connect Google Analytics in Settings for real daily traffic data.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark text-center">
                    No sites connected yet.
                    <br />
                    <span className="text-[11px]">Add a site in Settings to see data.</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2 flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">
            Site Health
          </h3>
          {sitesLoading ? (
            [...Array(3)].map((_, i) => <SkeletonCard key={i} className="p-4" />)
          ) : filteredSites?.length ? (
            filteredSites.map((site) => <SiteHealthCard key={site.id} site={site} />)
          ) : (
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">No sites connected</p>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary-dark/15 dark:text-primary-dark">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-3/4 mb-1.5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : !filteredActivity?.length ? (
            <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark text-center py-6">
              No activity yet — sync a site to start seeing agent results.
            </p>
          ) : (
            <ActivityTimeline items={filteredActivity} />
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
