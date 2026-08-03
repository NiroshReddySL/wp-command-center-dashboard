import { useState, useEffect, useRef } from 'react'
import { ExternalLink, RefreshCw, X, Loader2, AlertTriangle } from 'lucide-react'
import { post } from '@/lib/api'
import Pagination from '@/components/ui/Pagination'
import PageShell from '@/components/layout/PageShell'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import StatusDot from '@/components/ui/StatusDot'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ComponentInventory from '@/components/domain/ComponentInventory'
import ComponentNotices from '@/components/domain/ComponentNotices'
import QueryError from '@/components/ui/QueryError'
import { useAlerts, useWatchdogSummary, useWatchdogLastRun, useAcknowledgeAlert, useDismissAlert } from '@/hooks/useAlerts'
import type { Alert, WatchdogRun } from '@/hooks/useAlerts'
import { useSiteContext } from '@/contexts/SiteContext'
import { formatMs, timeAgo } from '@/lib/utils'
import type { Severity } from '@/lib/constants'

const TABS = ['all', 'broken-links', 'performance', 'plugins'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  'all': 'All Issues',
  'broken-links': 'Broken Links',
  'performance': 'Performance',
  'plugins': 'Plugins & Themes',
}

const MODULE_MAP: Record<Tab, string | undefined> = {
  'all': undefined,
  'broken-links': 'links',
  'performance': 'performance',
  'plugins': 'plugins',
}

// Server-side bucket per tab: names the exact summary counts AND the list
// filter, so a tab's badge and its rows can never come from different rules.
// "component" spans plugins, themes and their audit notices — which the old
// substring type filter could not express.
const TAB_BUCKET: Record<Tab, string | undefined> = {
  'all': undefined,
  'broken-links': 'broken_link',
  'performance': 'performance',
  'plugins': 'component',
}

export default function Watchdog() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [severityFilter, setSeverityFilter] = useState<Severity | ''>('')
  const [flushing, setFlushing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const PAGE_SIZE = 15
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { selectedSiteId } = useSiteContext()

  // Exact counts for badges + pagination totals (never from a capped list)
  const { data: summary } = useWatchdogSummary(selectedSiteId || undefined, refreshing)
  const { data: lastRun } = useWatchdogLastRun(refreshing)
  // Server-side pagination — enterprise sites can have thousands of alerts
  const { data: alerts, isLoading, isError, refetch } = useAlerts({
    agent: 'watchdog',
    site_id: selectedSiteId || undefined,
    severity: severityFilter || undefined,
    bucket: TAB_BUCKET[activeTab],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }, refreshing)

  // Poll for ~90s after a flush so background agent results appear as they land
  const startRefreshing = () => {
    setRefreshing(true)
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => setRefreshing(false), 90_000)
  }
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])
  useEffect(() => { setPage(1) }, [selectedSiteId])

  const bucketCount = (tab: Tab): number => {
    if (!summary) return 0
    const bucket = TAB_BUCKET[tab]
    return bucket ? summary.by_type[bucket] ?? 0 : summary.total
  }

  // Total rows matching the CURRENT view (tab bucket × severity filter)
  const bucket = TAB_BUCKET[activeTab]
  const viewTotal = !summary ? 0
    : bucket
      ? (severityFilter ? summary.matrix[bucket]?.[severityFilter] ?? 0 : summary.by_type[bucket] ?? 0)
      : (severityFilter ? summary.by_severity[severityFilter] ?? 0 : summary.total)

  // One server-filtered page of rows. The active tab decides the `type`
  // filter above, so every tab panel renders this same list.
  const pagedAlerts = alerts ?? []

  const handleFlush = async () => {
    setFlushing(true)
    try {
      const body: { site_id?: string; module?: string } = {}
      if (selectedSiteId) body.site_id = selectedSiteId
      const mod = MODULE_MAP[activeTab]
      if (mod) body.module = mod

      await post('/watchdog/flush', body)
      // Agents (link checker, PageSpeed) run in the background and can take a
      // minute+ — poll instead of a single early refetch.
      startRefreshing()
    } finally {
      setFlushing(false)
    }
  }

  return (
    <PageShell
      title="Watchdog"
      subtitle="Monitor your sites for issues, vulnerabilities, and performance problems."
    >
      <Tabs defaultValue="all" onValueChange={(v) => { setActiveTab(v as Tab); setPage(1) }}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList>
            {TABS.map((tab) => {
              const count = bucketCount(tab)

              return (
                <TabsTrigger key={tab} value={tab}>
                  {TAB_LABELS[tab]}
                  {count > 0 && (
                    <Badge
                      variant={tab === 'all' || tab === 'broken-links' ? 'critical' : 'warning'}
                      className="ml-1.5"
                    >
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <div className="flex items-center gap-2">
            <Select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value as Severity | ''); setPage(1) }}
              className="w-36"
            >
              <option value="">All severity</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              loading={flushing}
              onClick={handleFlush}
              title="Flush alerts and re-run watchdog agents"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Flush & Re-run
            </Button>
          </div>
        </div>

        {refreshing && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-secondary/30 bg-surface dark:bg-surface-dark px-4 py-2.5 text-[12px] text-primary dark:text-primary-dark">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Re-running watchdog agents — results will appear here as they finish.
          </div>
        )}

        {/* An unreachable API must read as an outage, never as "all healthy" */}
        {isError && <QueryError what="watchdog alerts" onRetry={() => refetch()} className="mb-4" />}
        {!!lastRun?.failure_count && <RunFailureNotice run={lastRun} />}

        <TabsContent value="all">
          {!isError && <AlertsTable alerts={pagedAlerts} isLoading={isLoading} onView={setSelectedAlert} />}
          <Pagination page={page} total={viewTotal} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </TabsContent>

        <TabsContent value="broken-links">
          {!isError && <BrokenLinksTable alerts={pagedAlerts} isLoading={isLoading} onView={setSelectedAlert} />}
          <Pagination page={page} total={viewTotal} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </TabsContent>

        <TabsContent value="performance">
          {!isError && <PerformanceTable alerts={pagedAlerts} isLoading={isLoading} onView={setSelectedAlert} />}
          <Pagination page={page} total={viewTotal} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </TabsContent>

        <TabsContent value="plugins">
          {/* Site-level findings about the audit itself. Kept separate from
              the inventory because they are not components — rendering them
              as one produced a nameless "unknown · v—" row. */}
          <ComponentNotices siteId={selectedSiteId || undefined} />
          {/* Single source of truth for components. The alert list that used
              to sit here repeated the same plugins with less information, and
              the two disagreeing was what made the tab confusing. Their
              alerts remain triageable under All Issues. */}
          <ComponentInventory siteId={selectedSiteId || undefined} />
        </TabsContent>
      </Tabs>
      {selectedAlert && <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
    </PageShell>
  )
}

function AlertsTable({ alerts, isLoading, onView }: { alerts: ReturnType<typeof useAlerts>['data']; isLoading: boolean; onView: (a: Alert) => void }) {
  const acknowledge = useAcknowledgeAlert()
  const dismiss = useDismissAlert()

  if (isLoading) return (
    <div className="flex flex-col gap-2">
      {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  )
  if (!alerts?.length) return (
    <EmptyState title="No issues found" description="Your sites are healthy." />
  )

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Issue</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id} className="cursor-pointer hover:bg-surface/40 dark:hover:bg-surface-dark/40" onClick={() => onView(alert)}>
              <TableCell>
                <StatusDot status={alert.severity} pulse={alert.severity === 'critical'} />
              </TableCell>
              <TableCell>
                <p className="font-medium text-[13px] line-clamp-1">{alert.title}</p>
                <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark line-clamp-2 max-w-[360px]">{alert.description}</p>
              </TableCell>
              <TableCell>
                <span className="text-[11px] bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">
                  {alert.site_name}
                </span>
              </TableCell>
              <TableCell>
                <code className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  {alert.type}
                </code>
              </TableCell>
              <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                {timeAgo(alert.created_at)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => onView(alert)}>View</Button>
                  {alert.status !== 'acknowledged' && (
                    <Button variant="ghost" size="sm" loading={acknowledge.isPending} onClick={() => acknowledge.mutate(alert.id)}>
                      Ack
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" loading={dismiss.isPending} onClick={() => dismiss.mutate(alert.id)}>
                    Dismiss
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function BrokenLinksTable({ alerts, isLoading, onView }: { alerts: ReturnType<typeof useAlerts>['data']; isLoading: boolean; onView: (a: Alert) => void }) {
  const dismiss = useDismissAlert()

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (!alerts?.length) return <EmptyState title="No broken links" description="All links are working." />

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Broken URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Found on</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((a) => {
            const status = (a.metadata?.status_code as number) ?? 0
            const isInternal = a.metadata?.is_internal as boolean | undefined
            return (
              <TableRow key={a.id} className="cursor-pointer hover:bg-surface/40 dark:hover:bg-surface-dark/40" onClick={() => onView(a)}>
                <TableCell>
                  <StatusDot status={a.severity} pulse={a.severity === 'critical'} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {isInternal && (
                      <span className="text-[10px] bg-surface dark:bg-surface-dark px-1.5 py-0.5 rounded">internal</span>
                    )}
                    <code className="text-[11px] text-danger line-clamp-1 max-w-[240px] block">
                      {(a.metadata?.url as string) ?? a.description}
                    </code>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={status === 0 ? 'critical' : status >= 500 ? 'warning' : 'critical'}>
                    {status === 0 ? 'Timeout' : `HTTP ${status}`}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark line-clamp-1 max-w-[180px]">
                  {Array.isArray(a.metadata?.found_on)
                    ? (a.metadata.found_on as string[])[0] ?? '—'
                    : (a.metadata?.found_on as string) ?? '—'}
                </TableCell>
                <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  {timeAgo(a.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => onView(a)}>View</Button>
                    <Button variant="ghost" size="sm" loading={dismiss.isPending} onClick={() => dismiss.mutate(a.id)}>Dismiss</Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function PerformanceTable({ alerts, isLoading, onView }: { alerts: ReturnType<typeof useAlerts>['data']; isLoading: boolean; onView: (a: Alert) => void }) {
  const dismiss = useDismissAlert()

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (!alerts?.length) return <EmptyState title="No performance issues" description="All pages are loading fast." />

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Page</TableHead>
            <TableHead>PSI Score</TableHead>
            <TableHead>LCP</TableHead>
            <TableHead>CLS</TableHead>
            <TableHead>TTFB</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((a) => {
            const score = (a.metadata?.speed_score as number) ?? 0
            const lcp = (a.metadata?.lcp_ms as number) ?? 0
            const cls = (a.metadata?.cls as number) ?? null
            const ttfb = (a.metadata?.ttfb_ms as number) ?? 0
            const pageUrl = (a.metadata?.page_url as string) ?? a.title
            return (
              <TableRow key={a.id} className="cursor-pointer hover:bg-surface/40 dark:hover:bg-surface-dark/40" onClick={() => onView(a)}>
                <TableCell>
                  <StatusDot status={a.severity} pulse={a.severity === 'critical'} />
                </TableCell>
                <TableCell className="font-medium text-[12px] line-clamp-1 max-w-[220px]">{pageUrl}</TableCell>
                <TableCell>
                  <Badge variant={score >= 90 ? 'success' : score >= 50 ? 'warning' : 'critical'}>
                    {score > 0 ? score : '—'}
                  </Badge>
                </TableCell>
                <TableCell className={`text-[12px] ${lcp > 4000 ? 'text-danger' : lcp > 2500 ? 'text-warning' : 'text-success'}`}>
                  {lcp > 0 ? `${(lcp / 1000).toFixed(1)}s` : '—'}
                </TableCell>
                <TableCell className={`text-[12px] ${cls !== null && cls > 0.25 ? 'text-danger' : cls !== null && cls > 0.1 ? 'text-warning' : 'text-success'}`}>
                  {cls !== null ? cls.toFixed(3) : '—'}
                </TableCell>
                <TableCell className={`text-[12px] ${ttfb > 1800 ? 'text-danger' : ttfb > 800 ? 'text-warning' : 'text-success'}`}>
                  {ttfb > 0 ? formatMs(ttfb) : '—'}
                </TableCell>
                <TableCell>
                  <span className="text-[11px] bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">
                    {a.site_name}
                  </span>
                </TableCell>
                <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  {timeAgo(a.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => onView(a)}>View</Button>
                    <Button variant="ghost" size="sm" loading={dismiss.isPending && dismiss.variables === a.id} onClick={() => dismiss.mutate(a.id)}>
                      Dismiss
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ——— Alert Detail Modal ————————————————————————————————————
function AlertDetailModal({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const acknowledge = useAcknowledgeAlert()
  const dismiss = useDismissAlert()

  const isBrokenLink = alert.type?.includes('link')
  const isPerf = alert.type?.includes('performance')
  const isPlugin = alert.type?.includes('plugin')
  const m = alert.metadata ?? {}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border dark:border-border-dark">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={alert.severity as 'critical' | 'warning' | 'info'}>{alert.severity}</Badge>
              <code className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{alert.type}</code>
            </div>
            <p className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">{alert.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-secondary hover:bg-surface dark:hover:bg-surface-dark transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">Description</p>
            <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed">{alert.description}</p>
          </div>

          <div className="flex items-center gap-6 text-[12px]">
            <div>
              <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Site</p>
              <span className="bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">{alert.site_name}</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Detected</p>
              <span className="text-text-secondary dark:text-text-secondary-dark">{timeAgo(alert.created_at)}</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">Status</p>
              <span className="text-text-secondary dark:text-text-secondary-dark capitalize">{alert.status}</span>
            </div>
          </div>

          {isBrokenLink && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">Broken URL</p>
              <a href={m.url as string} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] text-danger hover:underline break-all">
                {m.url as string} <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
              {m.status_code != null && (
                <Badge variant={(m.status_code as number) >= 500 ? 'warning' : 'critical'}>
                  HTTP {m.status_code as number}
                </Badge>
              )}
              {Boolean(m.found_on) && (
                <div>
                  <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">Found on these pages</p>
                  <div className="flex flex-col gap-1">
                    {(Array.isArray(m.found_on) ? m.found_on as string[] : [m.found_on as string]).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-primary dark:text-primary-dark hover:underline flex items-center gap-1 break-all">
                        {u} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isPerf && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'PSI Score', value: m.speed_score != null ? String(m.speed_score) : '—' },
                { label: 'LCP', value: m.lcp_ms ? `${((m.lcp_ms as number) / 1000).toFixed(1)}s` : '—' },
                { label: 'CLS', value: m.cls != null ? (m.cls as number).toFixed(3) : '—' },
                { label: 'TTFB', value: m.ttfb_ms ? formatMs(m.ttfb_ms as number) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-background dark:bg-background-dark border border-border dark:border-border-dark rounded-md p-3">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark mb-0.5">{label}</p>
                  <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">{value}</p>
                </div>
              ))}
              {Boolean(m.page_url) && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">Page</p>
                  <a href={m.page_url as string} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-primary dark:text-primary-dark hover:underline flex items-center gap-1 break-all">
                    {m.page_url as string} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}

          {isPlugin && (
            <div className="space-y-2">
              {[
                { label: 'Plugin', value: (m.plugin_name as string) ?? (m.plugin_slug as string) ?? '—' },
                { label: 'Installed version', value: (m.installed_version as string) ?? '—' },
                { label: 'Latest version', value: (m.latest_version as string) ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-[12px] py-1 border-b border-border dark:border-border-dark last:border-0">
                  <span className="text-text-secondary dark:text-text-secondary-dark">{label}</span>
                  <span className="font-medium text-text-primary dark:text-text-primary-dark">{value}</span>
                </div>
              ))}
              {(m.vulnerability as { description?: string })?.description && (
                <div className="mt-2 bg-danger/8 border border-danger/20 rounded-md p-3">
                  <p className="text-[10px] font-semibold text-danger uppercase tracking-wide mb-1">Vulnerability</p>
                  <p className="text-[12px] text-text-primary dark:text-text-primary-dark">
                    {(m.vulnerability as { description: string }).description}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border dark:border-border-dark">
          {alert.status !== 'acknowledged' && (
            <Button variant="primary" size="sm" loading={acknowledge.isPending}
              onClick={() => { acknowledge.mutate(alert.id); onClose() }}>
              Acknowledge
            </Button>
          )}
          <Button variant="ghost" size="sm" loading={dismiss.isPending}
            onClick={() => { dismiss.mutate(alert.id); onClose() }}>
            Dismiss
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}


/**
 * A re-run that partly failed must say so. The agents reconcile alerts in
 * place, so a crashed run simply leaves the previous findings on screen —
 * without this banner that is indistinguishable from a clean bill of health.
 */
function RunFailureNotice({ run }: { run: WatchdogRun }) {
  const count = run.failure_count ?? 0
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-warning/25 bg-warning/5 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
          <AlertTriangle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
            {count} check{count === 1 ? '' : 's'} failed during the last re-run
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary dark:text-text-secondary-dark">
            Results below are from the previous successful run and may be out of date
            {run.finished_at ? ` — last attempt ${timeAgo(run.finished_at)}` : ''}.
          </p>
          {!!run.failures?.length && (
            <ul className="mt-2 space-y-1">
              {run.failures.map((f) => (
                <li
                  key={f}
                  className="truncate font-mono text-[11px] text-text-secondary dark:text-text-secondary-dark"
                  title={f}
                >
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
