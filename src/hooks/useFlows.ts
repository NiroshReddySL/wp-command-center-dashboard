import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '@/lib/api'
import type { DailyRangeKey } from '@/components/domain/DateRangePicker'

export type MatchType = 'contains' | 'exact' | 'regex'

export interface FlowStep {
  id: string
  step_index: number
  label: string
  match_type: MatchType
  pattern: string
  is_directly_followed: boolean
  within_seconds: number | null
  is_goal: boolean
}

/** Same shape minus `id`/`step_index` — those are server-assigned. */
export interface FlowStepInput {
  label: string
  match_type: MatchType
  pattern: string
  is_directly_followed: boolean
  within_seconds: number | null
  is_goal: boolean
}

export interface FlowCategory {
  id: string
  site_id: string
  name: string
  description: string | null
  color: string | null
  is_active: boolean
  steps: FlowStep[]
}

export interface FlowStepResult {
  step_index: number
  label: string
  active_users: number
  completion_rate: number
  abandonments: number
  abandonment_rate: number
}

export interface FlowBreakdownEntry {
  value: string
  step_index: number
  active_users: number
}

export interface FlowSnapshot {
  id: string
  range_start: string
  range_end: string
  step_results: FlowStepResult[]
  total_entered: number
  total_completed: number
  conversion_rate: number
  goal_step_index: number | null
  leads: number | null
  lead_rate: number | null
  breakdown_dimension: string | null
  breakdown: FlowBreakdownEntry[]
}

/** A funnel result for one specific date range, queried live from GA4 — the
 * data behind the dashboard's global date picker. Unlike FlowSnapshot this
 * is never persisted, so it never has an id. */
export interface FlowRangeStats {
  range_start: string
  range_end: string
  step_results: FlowStepResult[]
  total_entered: number
  total_completed: number
  conversion_rate: number
  goal_step_index: number | null
  leads: number | null
  lead_rate: number | null
}

export interface FlowDashboardItem {
  category: FlowCategory
  /** Live GA4 result for the dashboard's globally selected date range (and,
   * when comparing, the immediately preceding period of equal length).
   * Null when GA4 isn't connected, the category has no steps yet, or the
   * live query failed — never merely because entrants were 0. */
  current: FlowRangeStats | null
  previous: FlowRangeStats | null
  /** Nightly daily snapshots only, chronological — unrelated to the picker,
   * always historical context regardless of whatever range is selected. */
  trend: FlowSnapshot[]
}

export interface FlowDashboardResponse {
  range_start: string
  range_end: string
  previous_range_start: string | null
  previous_range_end: string | null
  items: FlowDashboardItem[]
}

/** Curated allowlist, not free text — matches the backend's validation so
 * a bad dimension name never reaches GA4 as a cryptic 400. */
export const BREAKDOWN_DIMENSIONS: { value: string; label: string }[] = [
  { value: 'deviceCategory', label: 'Device category' },
  { value: 'sessionDefaultChannelGroup', label: 'Channel' },
  { value: 'country', label: 'Country' },
  { value: 'sessionSource', label: 'Source' },
  { value: 'browser', label: 'Browser' },
]

export const MATCH_TYPE_OPTIONS: { value: MatchType; label: string; hint: string }[] = [
  { value: 'contains', label: 'Contains', hint: 'Matches if the page URL contains this text — recommended' },
  { value: 'exact', label: 'Exact URL', hint: 'Matches only the exact full page URL' },
  { value: 'regex', label: 'Regex', hint: 'Matches a custom regular expression against the page URL' },
]

interface FlowCategoryCreatePayload {
  name: string
  description?: string | null
  color?: string | null
  steps: FlowStepInput[]
}

interface FlowCategoryUpdatePayload {
  name?: string
  description?: string | null
  color?: string | null
  is_active?: boolean
  steps?: FlowStepInput[]
}

function dashboardKey(siteId: string | null) {
  return ['flows-dashboard', siteId] as const
}

export interface SitePageOption {
  title: string
  url: string
}

/** Real pages on this site, matching a search term — lets a step be built
 * by picking an actual page instead of guessing its exact URL pattern by
 * hand. Reuses Content Health's existing search (matches title OR URL)
 * rather than a new endpoint. */
export function useSitePagesSearch(siteId: string | null, search: string) {
  return useQuery({
    queryKey: ['flow-site-pages', siteId, search],
    queryFn: () =>
      get<{ items: SitePageOption[] }>('/optimizer/content-health', {
        site_id: siteId, search, limit: 8, sort_by: 'traffic_30d', sort_dir: 'desc',
      }),
    enabled: Boolean(siteId) && search.trim().length >= 2,
    staleTime: 60_000,
    select: (data) => data.items,
  })
}

export interface FlowsDashboardSelection {
  range: DailyRangeKey
  startDate?: string
  endDate?: string
  compare?: boolean
  trendDays?: number
}

export function useFlowsDashboard(siteId: string | null, selection: FlowsDashboardSelection) {
  const { range, startDate, endDate, compare = false, trendDays = 30 } = selection
  return useQuery({
    queryKey: [...dashboardKey(siteId), range, startDate, endDate, compare, trendDays],
    queryFn: () =>
      get<FlowDashboardResponse>('/flows/dashboard', {
        site_id: siteId, range, trend_days: trendDays, compare,
        ...(range === 'custom' ? { start_date: startDate, end_date: endDate } : {}),
      }),
    enabled: Boolean(siteId) && (range !== 'custom' || Boolean(startDate && endDate)),
    staleTime: 60_000,
  })
}

export function useCreateFlowCategory(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FlowCategoryCreatePayload) =>
      post<FlowCategory>('/flows/categories', { site_id: siteId, ...payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(siteId) }),
  })
}

export function useUpdateFlowCategory(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: FlowCategoryUpdatePayload & { id: string }) =>
      patch<FlowCategory>(`/flows/categories/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(siteId) }),
  })
}

export function useDeleteFlowCategory(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/flows/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(siteId) }),
  })
}

export function useRunFlowCategory(siteId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, start_date, end_date, breakdown_dimension }: {
      id: string; start_date: string; end_date: string; breakdown_dimension?: string
    }) =>
      post<FlowSnapshot>(`/flows/categories/${id}/run`, { start_date, end_date, breakdown_dimension }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(siteId) }),
  })
}
