import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api'

export interface DashboardMetrics {
  total_issues: number
  total_issues_change: number | null
  avg_health_score: number
  health_trend: number[]
  content_published_week: number
  content_published_change: number | null
  uptime_percent: number | null
}

export interface PriorityItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  agent: 'watchdog' | 'optimizer' | 'autopilot'
  title: string
  site_name: string
  site_id: string
  created_at: string
  action_type: 'fix' | 'review' | 'dismiss'
}

/** GA mode: { date, SiteName: views, ... } */
export interface GaTrafficPoint {
  date: string
  [siteName: string]: number | string
}

/** Fallback mode: per-site totals */
export interface SiteTrafficItem {
  site_id: string
  site_name: string
  traffic_30d: number
  post_count: number
  health_score: number
}

export type TrafficData = GaTrafficPoint[] | SiteTrafficItem[]

export function isGaTraffic(data: TrafficData): data is GaTrafficPoint[] {
  return data.length > 0 && 'date' in data[0]
}

export interface ActivityItem {
  id: string
  agent: 'watchdog' | 'optimizer' | 'autopilot'
  description: string
  site_name: string
  created_at: string
  link?: string
}

export interface GoogleStatus {
  connected: boolean
  scopes: string[]
  expires_at: string | null
}

export interface AgentSummary {
  agent: 'watchdog' | 'optimizer' | 'autopilot'
  open_count: number
  critical_count: number
  last_activity_at: string | null
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: () => get<DashboardMetrics>('/dashboard/metrics'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export function usePriorityQueue() {
  return useQuery({
    queryKey: ['priority-queue'],
    queryFn: () => get<PriorityItem[]>('/dashboard/priority-queue'),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useTrafficOverview() {
  return useQuery({
    queryKey: ['traffic-overview'],
    queryFn: () => get<TrafficData>('/dashboard/traffic-overview'),
    staleTime: 60_000,
  })
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => get<ActivityItem[]>('/dashboard/activity'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useGoogleStatus() {
  return useQuery({
    queryKey: ['google-status'],
    queryFn: () => get<GoogleStatus>('/auth/google/status'),
    staleTime: 60_000,
  })
}

export function useAgentSummary(siteId?: string | null) {
  return useQuery({
    queryKey: ['agent-summary', siteId ?? 'all'],
    queryFn: () =>
      get<AgentSummary[]>('/dashboard/agents', siteId ? { site_id: siteId } : undefined),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
