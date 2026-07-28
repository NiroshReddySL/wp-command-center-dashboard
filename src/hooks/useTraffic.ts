import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@/lib/api'

export type TrafficMetric = 'pageviews' | 'sessions' | 'users' | 'bounce_rate' | 'avg_session_duration'

export const TRAFFIC_METRIC_OPTIONS: { value: TrafficMetric; label: string }[] = [
  { value: 'pageviews', label: 'Pageviews' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'users', label: 'Users' },
]

export interface TrafficSummary {
  site_id: string
  site_name: string
  snapshot_date: string
  is_stale: boolean
  has_comparison: boolean
  pageviews_today: number
  pageviews_yesterday: number
  change_pct: number
  sessions_today: number
  users_today: number
  bounce_rate: number
  avg_session_duration: number
  top_pages: { path?: string; url?: string; title?: string; views: number }[]
  source: 'ga4' | 'estimated'
}

export interface TrafficSnapshot {
  id: string
  site_id: string
  site_name: string
  date: string
  pageviews: number
  sessions: number
  users: number
  bounce_rate: number
  avg_session_duration: number
  top_pages: { path?: string; url?: string; title?: string; views: number }[]
  source: string
  snapshot_at: string
}

export interface TrafficAlert {
  id: string
  site_id: string
  site_name: string
  severity: string
  type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  status: string
  created_at: string
}

export interface TrendPoint {
  date: string
  [siteName: string]: number | string
}

export function useTrafficSummary(siteId?: string, fastPoll = false) {
  return useQuery({
    queryKey: ['traffic-summary', siteId],
    queryFn: () => get<TrafficSummary[]>('/traffic/summary', siteId ? { site_id: siteId } : undefined),
    staleTime: fastPoll ? 0 : 60_000,
    refetchInterval: fastPoll ? 5_000 : 5 * 60_000,
  })
}

export function useTrafficTrend(siteId?: string, days = 30, metric: TrafficMetric = 'pageviews') {
  return useQuery({
    queryKey: ['traffic-trend', siteId, days, metric],
    queryFn: () => get<TrendPoint[]>('/traffic/trend', { days, metric, ...(siteId ? { site_id: siteId } : {}) }),
    staleTime: 60_000,
  })
}

export function useTrafficSnapshots(siteId?: string, days = 30) {
  return useQuery({
    queryKey: ['traffic-snapshots', siteId, days],
    queryFn: () => get<TrafficSnapshot[]>('/traffic/snapshots', { days, ...(siteId ? { site_id: siteId } : {}) }),
    staleTime: 60_000,
  })
}

export function useTrafficAlerts(siteId?: string) {
  return useQuery({
    queryKey: ['traffic-alerts', siteId],
    queryFn: () => get<TrafficAlert[]>('/traffic/alerts', siteId ? { site_id: siteId } : undefined),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export interface TopPage {
  path?: string
  url?: string
  title?: string
  views: number
  site_id: string
  site_name: string
}

export function useTopPages(siteId?: string, days = 30, limit = 10) {
  return useQuery({
    queryKey: ['top-pages', siteId, days, limit],
    queryFn: () => get<TopPage[]>(
      '/traffic/top-pages', { days, limit, ...(siteId ? { site_id: siteId } : {}) }
    ),
    staleTime: 60_000,
  })
}

export interface GeoBreakdown {
  countries: { country: string; country_code: string; views: number; sessions: number; pct: number }[]
  regions: { region: string; views: number; pct: number }[]
  cities: { city: string; country: string; views: number }[]
}

export function useGeoBreakdown(siteId?: string, days = 30) {
  return useQuery({
    queryKey: ['traffic-geo', siteId, days],
    queryFn: () => get<GeoBreakdown>('/traffic/geo', { days, ...(siteId ? { site_id: siteId } : {}) }),
    staleTime: 60_000,
  })
}

export interface DailyForecast {
  date: string
  base: number
  optimistic: number
  pessimistic: number
}

export interface ForecastAnomaly {
  date: string
  type: string
  description: string
  severity: string
}

export interface TrafficPrediction {
  site_id: string
  site_name: string
  horizon_days: number
  generated_at: string
  daily_forecasts: DailyForecast[]
  anomalies: ForecastAnomaly[]
  narrative: string
  model_version: string
  insufficient_data: boolean
}

export function useTrafficPredictions(siteId?: string, horizonDays: 7 | 14 | 30 = 7) {
  return useQuery({
    queryKey: ['traffic-predictions', siteId, horizonDays],
    queryFn: () => get<TrafficPrediction[]>('/traffic/predictions', {
      horizon_days: horizonDays,
      ...(siteId ? { site_id: siteId } : {}),
    }),
    staleTime: 24 * 60 * 60_000, // 24 hours — matches backend cache TTL
  })
}

export function useRegeneratePredictions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { site_id?: string; horizon_days?: number }) =>
      post('/traffic/predictions/regenerate', params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['traffic-predictions'] })
    },
  })
}

export function useFlushTraffic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (siteId?: string) => post('/traffic/flush', { site_id: siteId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['traffic-summary'] })
      qc.invalidateQueries({ queryKey: ['traffic-trend'] })
      qc.invalidateQueries({ queryKey: ['traffic-snapshots'] })
      qc.invalidateQueries({ queryKey: ['traffic-alerts'] })
      qc.invalidateQueries({ queryKey: ['top-pages'] })
    },
  })
}
