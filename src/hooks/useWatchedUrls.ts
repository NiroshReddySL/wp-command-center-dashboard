import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, postForm, del } from '@/lib/api'

export interface WatchedUrl {
  id: string
  /** Full, canonical link — always show this, never the internal path */
  url: string
  path: string
  title: string | null
  source: 'manual' | 'csv'
  created_at: string
  active_users: number
  /** Seconds; null for "realtime" — GA4's Realtime API has no
   * userEngagementDuration/bounceRate metrics, only the standard range API does. */
  avg_engagement_time: number | null
  /** 0-1 ratio; null for "realtime", same reason as avg_engagement_time. */
  bounce_rate: number | null
}

export interface WatchedUrlList {
  items: WatchedUrl[]
  ga_connected: boolean
  /** Real calendar dates behind whatever `range` was requested — null for
   * "realtime" (no fixed range). Use these to label things and name
   * exports, never the preset key itself ("7d", "custom", ...). */
  range_start: string | null
  range_end: string | null
}

export interface AddUrlsResult {
  added: WatchedUrl[]
  skipped_duplicate: string[]
  invalid: { input: string; reason: string }[]
}

/** Mirrors GA4's own date-range picker — "realtime" is the one exception
 * (Active Users right now); everything else is a normal report range. */
export type DateRangeKey = 'realtime' | 'today' | 'yesterday' | '7d' | '28d' | '90d' | 'qtd' | 'ytd' | 'custom'

/** Same as DateRangeKey minus "realtime" — a day-wise breakdown has no
 * meaning for "right now", so every range picker for it excludes that option. */
export type DailyRangeKey = Exclude<DateRangeKey, 'realtime'>

export interface DateRangeSelection {
  range: DateRangeKey
  startDate?: string
  endDate?: string
}

export function useWatchedUrls(siteId: string | null, selection: DateRangeSelection) {
  const { range, startDate, endDate } = selection
  return useQuery({
    queryKey: ['watched-urls', siteId, range, startDate, endDate],
    queryFn: () =>
      get<WatchedUrlList>('/watched-urls', {
        site_id: siteId,
        range,
        ...(range === 'custom' ? { start_date: startDate, end_date: endDate } : {}),
      }),
    enabled: Boolean(siteId) && (range !== 'custom' || Boolean(startDate && endDate)),
    staleTime: range === 'realtime' ? 15_000 : 60_000,
    // GA4 Realtime data itself only refreshes ~every 60s; a historical date
    // range doesn't need to be polled at all — it won't change mid-session.
    refetchInterval: range === 'realtime' ? 30_000 : false,
  })
}

export function useAddWatchedUrls(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (urls: string[]) => post<AddUrlsResult>('/watched-urls', { site_id: siteId, urls }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watched-urls', siteId] }),
  })
}

export function useAddWatchedUrlsCsv(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return postForm<AddUrlsResult>('/watched-urls/csv', formData, { site_id: siteId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watched-urls', siteId] }),
  })
}

export function useDeleteWatchedUrl(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/watched-urls/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watched-urls', siteId] }),
  })
}

export interface DailyActiveUsersItem {
  id: string
  url: string
  title: string | null
  /** ISO date -> active users that day */
  daily: Record<string, number>
}

export interface DailyActiveUsersResponse {
  dates: string[]
  items: DailyActiveUsersItem[]
}

/** One-shot fetch (not a live query) — this only ever runs when the user
 * clicks "Export" for a day-wise breakdown, so it's a plain async call
 * rather than a cached/polled useQuery. */
export async function fetchDailyActiveUsers(
  siteId: string, range: DailyRangeKey, startDate?: string, endDate?: string,
): Promise<DailyActiveUsersResponse> {
  return get<DailyActiveUsersResponse>('/watched-urls/daily', {
    site_id: siteId,
    range,
    ...(range === 'custom' ? { start_date: startDate, end_date: endDate } : {}),
  })
}
