import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '@/lib/api'

export type MatchType = 'contains' | 'exact' | 'regex'

export interface FlowStep {
  id: string
  step_index: number
  label: string
  match_type: MatchType
  pattern: string
  is_directly_followed: boolean
  within_seconds: number | null
}

/** Same shape minus `id`/`step_index` — those are server-assigned. */
export interface FlowStepInput {
  label: string
  match_type: MatchType
  pattern: string
  is_directly_followed: boolean
  within_seconds: number | null
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
  breakdown_dimension: string | null
  breakdown: FlowBreakdownEntry[]
}

export interface FlowDashboardItem {
  category: FlowCategory
  latest: FlowSnapshot | null
  /** Daily snapshots only, chronological — see the backend's dashboard
   * endpoint docstring for why a custom-range run never appears here. */
  trend: FlowSnapshot[]
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

export function useFlowsDashboard(siteId: string | null, trendDays = 30) {
  return useQuery({
    queryKey: [...dashboardKey(siteId), trendDays],
    queryFn: () =>
      get<FlowDashboardItem[]>('/flows/dashboard', { site_id: siteId, trend_days: trendDays }),
    enabled: Boolean(siteId),
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
