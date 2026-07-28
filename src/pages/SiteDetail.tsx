import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, RefreshCw, ExternalLink, ExternalLink as LinkIcon, Sparkles, Building2, Users, Mic2,
  Globe, AlertTriangle, FileText, Gauge, Clock, TrendingUp, TrendingDown,
} from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import StatusDot from '@/components/ui/StatusDot'
import Pagination from '@/components/ui/Pagination'
import MetricCard from '@/components/ui/MetricCard'
import HealthRing from '@/components/charts/HealthRing'
import ContentScoreBar from '@/components/domain/ContentScoreBar'
import AlertFeedItem from '@/components/domain/AlertFeedItem'
import { useSiteDetail, useSyncSite } from '@/hooks/useSites'
import { post as apiPost } from '@/lib/api'
import { useAlerts, useAcknowledgeAlert, useDismissAlert } from '@/hooks/useAlerts'
import { get } from '@/lib/api'
import { useSiteContext } from '@/contexts/SiteContext'
import { cn, timeAgo, formatNumber, formatMs } from '@/lib/utils'

const ALERTS_PAGE_SIZE = 15
const CONTENT_PREVIEW_SIZE = 10
const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

interface PerfSnapshot {
  id: string
  page_url: string
  lcp: number
  cls: number
  fid: number
  ttfb: number
  speed_score: number
  strategy: string
  snapshot_at: string
}

interface ContentPost {
  id: string
  title: string
  url: string
  health_score: number
  traffic_30d: number
  issues: string[]
  last_analyzed_at: string | null
}

interface SiteContext {
  business_type?: string
  industry?: string
  primary_offerings?: string[]
  target_audience?: string
  brand_tone?: string
  main_topics?: string[]
  location_focus?: string
  summary?: string
  analyzed_at?: string
  wp_name?: string
  wp_tagline?: string
}

interface SiteContextResponse {
  site_id: string
  context: SiteContext
  analyzed_at: string | null
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm capitalize">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

// ——— Small point-delta indicator (raw points, not a percentage — Performance tab only) ———
function ScoreDelta({ delta }: { delta: number }) {
  if (delta === 0) return null
  const pos = delta > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium', pos ? 'text-success' : 'text-danger')}>
      {pos ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(delta)}
    </span>
  )
}

function SiteContextCard({ siteId }: { siteId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['site-context', siteId],
    queryFn: () => get<SiteContextResponse>(`/sites/${siteId}/context`),
    staleTime: 5 * 60_000,
  })
  const analyze = useMutation({
    mutationFn: () => apiPost<SiteContext>(`/sites/${siteId}/analyze-context`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-context', siteId] }),
  })

  const ctx = data?.context
  const hasContext = ctx && Object.keys(ctx).length > 0 && ctx.summary

  const toneColors: Record<string, string> = {
    professional: 'bg-primary/10 text-primary',
    casual: 'bg-success/10 text-success',
    technical: 'bg-warning/10 text-warning',
    educational: 'bg-violet-500/10 text-violet-600',
    conversational: 'bg-emerald-500/10 text-emerald-600',
    authoritative: 'bg-primary/10 text-primary',
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>AI Site Context</CardTitle>
          {hasContext && (
            <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark ml-1">
              {data?.analyzed_at ? `analyzed ${new Date(data.analyzed_at).toLocaleDateString()}` : ''}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={analyze.isPending}
          onClick={() => analyze.mutate()}
          className="flex items-center gap-1.5 text-[12px]"
        >
          <RefreshCw className="h-3 w-3" />
          {hasContext ? 'Re-analyze' : 'Analyze now'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-surface dark:bg-surface-dark rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !hasContext ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
            <Sparkles className="h-8 w-8 text-text-secondary dark:text-text-secondary-dark opacity-40" />
            <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">No site context yet</p>
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark max-w-sm">
              Click "Analyze now" to let AI understand what your site does — this personalises all future content recommendations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed border-l-2 border-primary/30 pl-3">
              {ctx.summary}
            </p>

            {/* Key attributes grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5 bg-surface dark:bg-surface-dark rounded-lg p-3">
                <Building2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Business type</p>
                  <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark capitalize">
                    {ctx.business_type?.replace(/_/g, ' ') ?? '—'}
                    {ctx.industry ? ` · ${ctx.industry}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-surface dark:bg-surface-dark rounded-lg p-3">
                <Users className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Target audience</p>
                  <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark line-clamp-2">
                    {ctx.target_audience ?? '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-surface dark:bg-surface-dark rounded-lg p-3">
                <Mic2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Brand tone</p>
                  <span className={cn(
                    'inline-block text-[11px] font-medium px-2 py-0.5 rounded-md capitalize',
                    toneColors[ctx.brand_tone ?? ''] ?? 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark'
                  )}>
                    {ctx.brand_tone ?? '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-surface dark:bg-surface-dark rounded-lg p-3">
                <Globe className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Location focus</p>
                  <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark capitalize">
                    {ctx.location_focus ?? '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Offerings */}
            {(ctx.primary_offerings?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">Primary offerings</p>
                <div className="flex flex-wrap gap-1.5">
                  {ctx.primary_offerings!.map((o) => (
                    <span key={o} className="text-[11px] bg-primary/8 text-primary px-2 py-0.5 rounded-md">{o}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Main topics */}
            {(ctx.main_topics?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">Content topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {ctx.main_topics!.map((t) => (
                    <span key={t} className="text-[11px] bg-surface dark:bg-surface-dark border border-border dark:border-border-dark px-2 py-0.5 rounded-md text-text-secondary dark:text-text-secondary-dark">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SiteDetail() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()
  const { setSelectedSiteId } = useSiteContext()
  const { data: site, isLoading } = useSiteDetail(siteId ?? '')
  // No `agent` filter — this page needs the site's FULL alert history across
  // every agent, not just Watchdog's. `limit` raised to the API's max so a
  // busy site's alerts aren't silently truncated before pagination even sees them.
  const { data: alerts } = useAlerts({ site_id: siteId, limit: 500 })
  const alertsAtCap = (alerts?.length ?? 0) >= 500
  const sync = useSyncSite()
  const acknowledge = useAcknowledgeAlert()
  const dismiss = useDismissAlert()

  const [alertSeverity, setAlertSeverity] = useState<'' | (typeof ALERT_SEVERITIES)[number]>('')
  const [alertPage, setAlertPage] = useState(1)
  useEffect(() => { setAlertPage(1) }, [alertSeverity])

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['site-performance', siteId],
    queryFn: () => get<PerfSnapshot[]>(`/sites/${siteId}/performance`),
    enabled: Boolean(siteId),
    staleTime: 60_000,
  })

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ['site-content', siteId],
    queryFn: () => get<ContentPost[]>(`/sites/${siteId}/content`),
    enabled: Boolean(siteId),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-[180px] w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (!site) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary dark:text-text-secondary-dark">Site not found.</p>
        <Button variant="ghost" onClick={() => navigate('/')} className="mt-4">Go back</Button>
      </div>
    )
  }

  const openAlerts = alerts?.filter((a) => a.status === 'open') ?? []
  const criticalCount = openAlerts.filter((a) => a.severity === 'critical').length

  const filteredOpenAlerts = alertSeverity ? openAlerts.filter((a) => a.severity === alertSeverity) : openAlerts
  const alertSlice = filteredOpenAlerts.slice((alertPage - 1) * ALERTS_PAGE_SIZE, alertPage * ALERTS_PAGE_SIZE)

  // Group performance snapshots by page
  const perfByPage = (performance ?? []).reduce<Record<string, PerfSnapshot[]>>((acc, s) => {
    if (!acc[s.page_url]) acc[s.page_url] = []
    acc[s.page_url].push(s)
    return acc
  }, {})

  // Latest snapshot per page, plus up to 5 most-recent for a trend delta
  const latestPerPage = Object.entries(perfByPage).map(([url, snaps]) => ({
    url,
    latest: snaps[0],
    history: snaps.slice(0, 5),
  }))

  const contentTotal = site.content_count ?? content?.length ?? 0
  const contentPreview = content?.slice(0, CONTENT_PREVIEW_SIZE) ?? []

  function viewFullContentHealth() {
    setSelectedSiteId(site!.id)
    navigate('/optimizer?tab=content')
  }

  return (
    <PageShell breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: site.name }]}>
      {/* Hero band */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-secondary p-6 shadow-card"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/70">
              <Globe className="h-3.5 w-3.5" />
              Connected Site
            </div>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight text-white truncate">{site.name}</h1>
            <a
              href={site.url} target="_blank" rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[13px] text-white/80 hover:text-white hover:underline"
            >
              {site.url} <LinkIcon className="h-3 w-3" />
            </a>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill
                color={site.status === 'active' ? 'bg-emerald-300' : site.status === 'error' ? 'bg-rose-300' : 'bg-white/40'}
                label={site.status}
              />
              {criticalCount > 0 && <StatusPill color="bg-rose-300" label={`${criticalCount} critical`} />}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                <Clock className="h-3 w-3" />
                Synced {site.last_synced_at ? timeAgo(site.last_synced_at) : 'never'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="ghost" size="sm" onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <a href={site.url} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="ghost" size="sm"
                  className="flex items-center gap-1.5 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Visit site
                </Button>
              </a>
              <Button
                variant="ghost" size="sm" loading={sync.isPending}
                onClick={() => {
                  if (confirm('This will delete all posts, alerts, performance data, and review items for this site, then re-sync from scratch. Continue?')) {
                    sync.mutate({ id: site.id, flush: true })
                  }
                }}
                className="flex items-center gap-1.5 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Flush & Sync
              </Button>
              <Button
                variant="ghost" size="sm" loading={sync.isPending}
                onClick={() => sync.mutate({ id: site.id })}
                className="flex items-center gap-1.5 bg-white text-primary border border-white hover:bg-white/90"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Sync now
              </Button>
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-col items-center">
            <HealthRing value={site.health_score}>
              <span className="text-[34px] font-bold leading-none text-white">{site.health_score}</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/70">Health</span>
            </HealthRing>
          </div>
        </div>
      </motion.div>

      {/* Stat row */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-4 gap-4">
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Open Issues"
            value={site.issues_count ?? 0}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent={(site.issues_count ?? 0) > 20 ? 'danger' : (site.issues_count ?? 0) > 0 ? 'warning' : 'success'}
          >
            {criticalCount > 0 && <span className="text-[11px] text-danger font-medium">{criticalCount} critical</span>}
          </MetricCard>
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Content Posts"
            value={formatNumber(contentTotal)}
            icon={<FileText className="h-4 w-4" />}
            accent="primary"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Avg Speed Score"
            value={site.speed_score ?? '—'}
            icon={<Gauge className="h-4 w-4" />}
            accent={site.speed_score == null ? undefined : site.speed_score >= 85 ? 'success' : site.speed_score >= 58 ? 'warning' : 'danger'}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Last Synced"
            value={site.last_synced_at ? timeAgo(site.last_synced_at) : 'Never'}
            icon={<Clock className="h-4 w-4" />}
            accent="secondary"
          />
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">
            Performance
            {latestPerPage.some((p) => p.latest.speed_score < 65) && (
              <Badge variant="warning" className="ml-1.5">!</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="content">
            Content
            {contentTotal > 0 && (
              <Badge variant="default" className="ml-1.5">{formatNumber(contentTotal)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {openAlerts.length > 0 && (
              <Badge variant={criticalCount > 0 ? 'critical' : 'warning'} className="ml-1.5">
                {openAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ——— Overview ——— */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SiteContextCard siteId={site.id} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Site Information</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-1">URL</p>
                    <a href={site.url} className="text-[13px] text-primary dark:text-primary-dark hover:underline flex items-center gap-1" target="_blank" rel="noopener noreferrer">
                      {site.url} <LinkIcon className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-1">Created</p>
                      <p className="text-[13px] text-text-primary dark:text-text-primary-dark">{timeAgo(site.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-1">Last Sync</p>
                      <p className="text-[13px] text-text-primary dark:text-text-primary-dark">
                        {site.last_synced_at ? timeAgo(site.last_synced_at) : '—'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-2">Content Health</p>
                    {site.content_freshness != null
                      ? <ContentScoreBar score={site.content_freshness} />
                      : <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">No posts analyzed yet</p>
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Issue Breakdown</CardTitle></CardHeader>
              <CardContent>
                {openAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <StatusDot status="healthy" />
                    <p className="text-[13px] text-success font-medium">No open issues</p>
                    <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">Site is healthy</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {ALERT_SEVERITIES.map((sev) => {
                      const count = openAlerts.filter((a) => a.severity === sev).length
                      if (!count) return null
                      return (
                        <div key={sev} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusDot status={sev} pulse={sev === 'critical'} />
                            <span className="text-[13px] text-text-primary dark:text-text-primary-dark capitalize">{sev}</span>
                          </div>
                          <Badge variant={sev}>{count}</Badge>
                        </div>
                      )
                    })}
                    <div className="mt-3 pt-3 border-t border-border dark:border-border-dark flex flex-col gap-1">
                      {openAlerts.slice(0, 3).map((a) => (
                        <p key={a.id} className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">
                          • {a.title}
                        </p>
                      ))}
                      {openAlerts.length > 3 && (
                        <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                          +{openAlerts.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ——— Performance ——— */}
        <TabsContent value="performance">
          {perfLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : latestPerPage.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark">No performance data yet.</p>
                <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-1">
                  Click <strong>Sync now</strong> to run the Watchdog agent.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Strategy badge */}
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-text-secondary dark:text-text-secondary-dark">
                  Strategy:
                </span>
                <Badge variant="info">Desktop</Badge>
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  · Powered by Google PageSpeed Insights
                </span>
              </div>

              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>
                        <span title="PageSpeed Insights score (0–100)">PSI Score</span>
                      </TableHead>
                      <TableHead>
                        <span title="Largest Contentful Paint — target ≤ 2.5s">LCP</span>
                      </TableHead>
                      <TableHead>
                        <span title="Cumulative Layout Shift — target ≤ 0.1">CLS</span>
                      </TableHead>
                      <TableHead>
                        <span title="Total Blocking Time (proxy for FID) — target ≤ 200ms">TBT</span>
                      </TableHead>
                      <TableHead>
                        <span title="Time to First Byte — target ≤ 800ms">TTFB</span>
                      </TableHead>
                      <TableHead>Last Audited</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestPerPage.map(({ url, latest, history }) => {
                      const lcpS = latest.lcp / 1000
                      const lcpOk = latest.lcp <= 2500
                      const lcpWarn = latest.lcp <= 4000
                      const clsOk = latest.cls <= 0.1
                      const clsWarn = latest.cls <= 0.25
                      const tbtOk = latest.fid <= 200
                      const tbtWarn = latest.fid <= 600
                      const ttfbOk = latest.ttfb <= 800
                      const ttfbWarn = latest.ttfb <= 1800
                      const oldest = history[history.length - 1]
                      const speedDelta = history.length > 1 ? latest.speed_score - oldest.speed_score : 0

                      return (
                        <TableRow key={url}>
                          <TableCell>
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="text-[12px] text-primary dark:text-primary-dark hover:underline flex items-center gap-1 max-w-[280px]">
                              <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                              <LinkIcon className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant={latest.speed_score >= 90 ? 'success' : latest.speed_score >= 50 ? 'warning' : 'critical'}>
                                {latest.speed_score}
                              </Badge>
                              <ScoreDelta delta={speedDelta} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-[12px] ${lcpOk ? 'text-success' : lcpWarn ? 'text-warning' : 'text-danger'}`}>
                              {lcpS.toFixed(1)}s
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-[12px] ${clsOk ? 'text-success' : clsWarn ? 'text-warning' : 'text-danger'}`}>
                              {latest.cls > 0 ? latest.cls.toFixed(3) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-[12px] ${tbtOk ? 'text-success' : tbtWarn ? 'text-warning' : 'text-danger'}`}>
                              {latest.fid > 0 ? formatMs(latest.fid) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-[12px] ${ttfbOk ? 'text-success' : ttfbWarn ? 'text-warning' : 'text-danger'}`}>
                              {latest.ttfb > 0 ? formatMs(latest.ttfb) : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                            {timeAgo(latest.snapshot_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* CWV legend */}
              <div className="flex items-center gap-6 px-1">
                {[
                  { label: 'Good', color: 'text-success' },
                  { label: 'Needs improvement', color: 'text-warning' },
                  { label: 'Poor', color: 'text-danger' },
                ].map(({ label, color }) => (
                  <span key={label} className={`text-[11px] ${color} flex items-center gap-1`}>
                    <span className="inline-block w-2 h-2 rounded-full bg-current" /> {label}
                  </span>
                ))}
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark ml-auto">
                  LCP ≤2.5s · CLS ≤0.1 · TBT ≤200ms · TTFB ≤800ms
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ——— Content ——— */}
        <TabsContent value="content">
          {contentLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !content?.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark">No posts synced yet.</p>
                <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-1">Click Sync now to pull posts from WordPress.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">Needs Attention</h3>
                  <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
                    {contentPreview.length} of {formatNumber(contentTotal)} posts · lowest health score first
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={viewFullContentHealth} className="flex items-center gap-1.5">
                  View full Content Health <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Traffic (30d)</TableHead>
                      <TableHead>Top Issue</TableHead>
                      <TableHead>Last Analyzed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contentPreview.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <a href={post.url} target="_blank" rel="noopener noreferrer"
                            className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark hover:text-primary dark:hover:text-primary-dark truncate max-w-[280px] block">
                            {post.title}
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="w-28">
                            <ContentScoreBar score={post.health_score} showLabel />
                          </div>
                        </TableCell>
                        <TableCell className="text-[12px] text-text-primary dark:text-text-primary-dark">
                          {post.traffic_30d > 0 ? formatNumber(post.traffic_30d) : <span className="text-text-secondary dark:text-text-secondary-dark">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {post.issues[0]
                            ? <span className="text-[11px] text-warning truncate block">{post.issues[0]}</span>
                            : <span className="text-[11px] text-success">No issues</span>
                          }
                        </TableCell>
                        <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                          {post.last_analyzed_at ? timeAgo(post.last_analyzed_at) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ——— Alerts ——— */}
        <TabsContent value="alerts">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAlertSeverity('')}
                className={cn(
                  'px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors',
                  alertSeverity === ''
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card dark:bg-card-dark border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary/50'
                )}
              >
                All ({openAlerts.length})
              </button>
              {ALERT_SEVERITIES.map((sev) => {
                const count = openAlerts.filter((a) => a.severity === sev).length
                if (!count) return null
                return (
                  <button
                    key={sev}
                    onClick={() => setAlertSeverity(sev)}
                    className={cn(
                      'px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors capitalize',
                      alertSeverity === sev
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card dark:bg-card-dark border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary/50'
                    )}
                  >
                    {sev} ({count})
                  </button>
                )
              })}
            </div>

            <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
              {openAlerts.length === 0 ? (
                <p className="text-center py-10 text-[13px] text-text-secondary dark:text-text-secondary-dark">
                  No open alerts for this site.
                </p>
              ) : filteredOpenAlerts.length === 0 ? (
                <p className="text-center py-10 text-[13px] text-text-secondary dark:text-text-secondary-dark">
                  No {alertSeverity} alerts for this site.
                </p>
              ) : (
                <div className="divide-y divide-border dark:divide-border-dark">
                  {alertSlice.map((alert) => (
                    <AlertFeedItem
                      key={alert.id}
                      alert={alert}
                      showSite={false}
                      onAction={(id, action) => {
                        if (action === 'dismiss') dismiss.mutate(id)
                        else acknowledge.mutate(id)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            {filteredOpenAlerts.length > ALERTS_PAGE_SIZE && (
              <Pagination page={alertPage} total={filteredOpenAlerts.length} pageSize={ALERTS_PAGE_SIZE} onPageChange={setAlertPage} />
            )}
            {alertsAtCap && (
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark text-center">
                Showing the most recent 500 alerts for this site.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
