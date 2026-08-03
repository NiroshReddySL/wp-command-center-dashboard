import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, put } from '@/lib/api'
import type { Severity, AgentType } from '@/lib/constants'

export interface Alert {
  id: string
  site_id: string
  site_name: string
  agent: AgentType
  severity: Severity
  type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  created_at: string
  resolved_at: string | null
}

interface AlertFilters {
  site_id?: string
  severity?: Severity
  agent?: AgentType
  status?: string
  type?: string
  /** Tab grouping — one bucket can span several alert-type prefixes
   *  ("component" covers plugins, themes and their audit notices), which the
   *  substring `type` filter cannot express. */
  bucket?: string
  limit?: number
  offset?: number
}

export function useAlerts(filters?: AlertFilters, fastPoll = false) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => get<Alert[]>('/watchdog/alerts', filters as Record<string, unknown>),
    staleTime: fastPoll ? 0 : 15_000,
    refetchInterval: fastPoll ? 5_000 : 30_000,
  })
}

export interface AlertSummary {
  total: number
  by_type: Record<string, number>       // buckets: broken_link | performance | plugin | other
  by_severity: Record<string, number>
  matrix: Record<string, Record<string, number>>
}

/** Exact open/acknowledged counts — badges and pagination totals must not
 *  come from a row-capped list response. */
export function useWatchdogSummary(siteId?: string, fastPoll = false) {
  return useQuery({
    queryKey: ['watchdog-summary', siteId ?? null],
    queryFn: () => get<AlertSummary>('/watchdog/summary', siteId ? { site_id: siteId } : undefined),
    staleTime: fastPoll ? 0 : 15_000,
    refetchInterval: fastPoll ? 5_000 : 30_000,
  })
}

export interface WatchdogRun {
  finished_at?: string
  agents_succeeded?: number
  failures?: string[]
  failure_count?: number
}

/** Outcome of the last re-run. Without this an empty alert list is
 *  indistinguishable from "the re-run crashed", and the page says the sites
 *  are healthy either way. */
export function useWatchdogLastRun(fastPoll = false) {
  return useQuery({
    queryKey: ['watchdog-last-run'],
    queryFn: () => get<WatchdogRun>('/watchdog/last-run'),
    staleTime: fastPoll ? 0 : 15_000,
    refetchInterval: fastPoll ? 5_000 : 60_000,
  })
}

function invalidateAlertViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['alerts'] })
  qc.invalidateQueries({ queryKey: ['watchdog-summary'] })
  qc.invalidateQueries({ queryKey: ['priority-queue'] })
  qc.invalidateQueries({ queryKey: ['metrics'] })
  qc.invalidateQueries({ queryKey: ['agent-summary'] })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => put<Alert>(`/watchdog/alerts/${id}/acknowledge`),
    onSuccess: () => invalidateAlertViews(qc),
  })
}

export function useDismissAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => put<Alert>(`/watchdog/alerts/${id}/dismiss`),
    onSuccess: () => invalidateAlertViews(qc),
  })
}
