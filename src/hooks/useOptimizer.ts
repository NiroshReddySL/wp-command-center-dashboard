import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { get, post } from '@/lib/api'

export type ContentSortBy = 'health_score' | 'traffic_30d' | 'word_count' | 'last_analyzed_at' | 'title'
export type SortDir = 'asc' | 'desc'
export type ContentTypeFilter = 'post' | 'page'
export type HealthStatusFilter = 'healthy' | 'needs_work' | 'poor'
export type AnalyzedFilter = 'analyzed' | 'never'
export type IssueCategory =
  | 'thin_content' | 'missing_images' | 'missing_links' | 'stale_content'
  | 'title_length' | 'heading_structure' | 'missing_meta_description' | 'missing_faq_schema'

export const CONTENT_SORT_OPTIONS: { value: ContentSortBy; label: string }[] = [
  { value: 'health_score', label: 'Health Score' },
  { value: 'traffic_30d', label: 'Traffic (30d)' },
  { value: 'word_count', label: 'Word Count' },
  { value: 'last_analyzed_at', label: 'Last Analyzed' },
  { value: 'title', label: 'Title' },
]

export const CONTENT_TYPE_OPTIONS: { value: ContentTypeFilter; label: string }[] = [
  { value: 'post', label: 'Posts' },
  { value: 'page', label: 'Pages' },
]

export const HEALTH_STATUS_OPTIONS: { value: HealthStatusFilter; label: string }[] = [
  { value: 'healthy', label: 'Healthy (70+)' },
  { value: 'needs_work', label: 'Needs Work (40–69)' },
  { value: 'poor', label: 'Poor (<40)' },
]

export const ANALYZED_OPTIONS: { value: AnalyzedFilter; label: string }[] = [
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'never', label: 'Never analyzed' },
]

// Mirrors the backend's _ISSUE_CATEGORIES — each reads a stable,
// already-computed score_breakdown field rather than the free-text issues
// list (those interpolate live numbers, so no two posts' text matches).
export const ISSUE_CATEGORY_OPTIONS: { value: IssueCategory; label: string }[] = [
  { value: 'thin_content', label: 'Thin Content' },
  { value: 'missing_images', label: 'Missing Images' },
  { value: 'missing_links', label: 'Missing Links' },
  { value: 'stale_content', label: 'Stale Content' },
  { value: 'title_length', label: 'Title Length' },
  { value: 'heading_structure', label: 'Heading Structure' },
  { value: 'missing_meta_description', label: 'Missing Meta Description' },
  { value: 'missing_faq_schema', label: 'Missing FAQ Schema' },
]

export interface ContentPost {
  id: string
  /** WP post slug — used for clean detail-page URLs; falls back to id */
  slug: string
  title: string
  url: string
  site_name: string
  content_type: 'post' | 'page'
  health_score: number
  traffic_30d: number
  traffic_trend: number[]
  last_analyzed_at: string | null
  issues: string[]
  word_count: number
  reading_time_minutes: number
  score_breakdown: Record<string, ScoreCategory>
  ai_recommendation: string | null
  ai_guidance: PageGuidance | null
}

export interface ContentPostDetail extends ContentPost {
  site_id: string
}

export interface ScoreCategory {
  score?: number
  max?: number
  value?: number
  status?: 'good' | 'warning' | 'critical' | 'info'
  detail?: string
  // images
  inline_count?: number
  has_featured?: boolean
  has_og_image?: boolean
  total?: number
  // links
  internal_count?: number
  external_count?: number
  // freshness
  age_days?: number | null
  reading_time_minutes?: number
  // headings
  h1_count?: number
  /** "post_content" | "live_page" — live_page means the H1 was confirmed by crawling the rendered page */
  h1_source?: string
  h2_count?: number
  h3_count?: number
  h4_count?: number
  hierarchy_issues?: string[]
  // title
  length?: number
  // meta description
  meta_title?: string | null
  meta_description?: string | null
  preview?: string
  source?: string
  // publish history
  published_str?: string | null
  modified_str?: string | null
  pub_age_days?: number | null
  never_updated?: boolean
  // schema markup
  has_structured_data?: boolean
  type?: string
  all_types?: string[]
  sources?: { body: string[]; yoast: string[]; full_page: string[] }
  full_page_scanned?: boolean
  has_faq_schema?: boolean
  faq_content_detected?: boolean
  faq_recommendation?: 'present' | 'missing' | 'not_applicable'
}

export interface ContentHealthPage {
  items: ContentPost[]
  total: number
}

interface UseContentHealthOptions {
  siteId?: string
  search?: string
  sortDir?: SortDir
  contentType?: ContentTypeFilter
  /** Multi-select — OR-combined server-side (e.g. Healthy OR Poor). */
  healthStatus?: HealthStatusFilter[]
  hasIssues?: boolean
  /** Multi-select — OR-combined server-side (e.g. Thin Content OR Missing Images). */
  issueCategories?: IssueCategory[]
  analyzed?: AnalyzedFilter
  page?: number
  pageSize?: number
  staleTime?: number
  refetchInterval?: number | false
}

/** Server-side paginated + searched + filtered — never re-slices a capped
 * client-side array. Filters combine with AND across dimensions, OR within
 * a multi-select dimension (healthStatus, issueCategories). */
export function useContentHealth(sortBy: ContentSortBy = 'health_score', options: UseContentHealthOptions = {}) {
  const {
    siteId, search, sortDir, contentType, healthStatus = [], hasIssues, issueCategories = [], analyzed,
    page = 1, pageSize = 10, staleTime = 60_000, refetchInterval = false,
  } = options
  return useQuery({
    queryKey: [
      'content-health', sortBy, sortDir, siteId, search, contentType,
      [...healthStatus].sort(), hasIssues, [...issueCategories].sort(), analyzed, page, pageSize,
    ],
    queryFn: () =>
      get<ContentHealthPage>('/optimizer/content-health', {
        sort_by: sortBy,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(sortDir ? { sort_dir: sortDir } : {}),
        ...(siteId ? { site_id: siteId } : {}),
        ...(search ? { search } : {}),
        ...(contentType ? { content_type: contentType } : {}),
        ...(healthStatus.length ? { health_status: healthStatus } : {}),
        ...(hasIssues !== undefined ? { has_issues: hasIssues } : {}),
        ...(issueCategories.length ? { issue_categories: issueCategories } : {}),
        ...(analyzed ? { analyzed } : {}),
      }),
    staleTime,
    refetchInterval,
    placeholderData: keepPreviousData, // page/search changes don't flash a loading skeleton
  })
}

export function useContentPostDetail(ref: string, siteId?: string | null) {
  return useQuery({
    queryKey: ['content-post', ref, siteId ?? null],
    queryFn: () =>
      get<ContentPostDetail>(
        `/optimizer/content-health/${ref}`,
        // ref may be a slug — site scoping disambiguates cross-site collisions
        siteId ? { site_id: siteId } : undefined
      ),
    enabled: Boolean(ref),
  })
}

export interface DailyTrafficPoint {
  date: string
  views: number
}

export interface ConversionFlow {
  label: string
  target_title: string
  target_url: string
  entered: number
  reached: number
  reach_rate: number // 0-1, reached/entered
  submitted: number | null // null when no confirmation page was detected for this site
  submission_rate: number | null // 0-1, submitted/entered
}

export interface DeviceShare {
  device: 'desktop' | 'mobile' | 'tablet' | 'other'
  users: number
  pct: number // 0-100
}

export interface ContentPostAnalytics {
  connected: boolean
  daily_traffic: DailyTrafficPoint[]
  /** VISITS — sum of per-day active users, so one person returning on three
   * days counts three times. Drives the daily chart. */
  traffic_30d: number
  traffic_prev_30d: number
  traffic_change_pct: number | null
  /** Unique PEOPLE over the window. Every funnel step counts people, so this
   * — not traffic_30d — is the number that matches a route's first stage. */
  visitors_30d: number
  bounce_rate: number | null // 0-100
  avg_engagement_time: number | null // seconds
  /** Reader split by device category. Note these are per-device unique
   * users, so someone who read on both phone and laptop counts in both —
   * the percentages describe the split, and don't sum to visitors_30d. */
  devices: DeviceShare[]
  flows: ConversionFlow[]
  /** Unique converters, measured directly. Never the sum of each route's
   * `submitted`: routes share one confirmation page, so a visitor who took
   * more than one route would be counted once per route. */
  total_leads: number | null
  error?: string | null
}

export interface GuidanceRewrite {
  proposed: string
  reason: string
  length: number
  /** Whether `proposed` lands in the range Google displays without
   * truncating. Models drift, so the suggestion is kept either way and the
   * UI flags it rather than presenting an out-of-spec string as paste-ready. */
  in_range: boolean
  optimal: string
}

export interface ContentGap {
  topic: string
  evidence: string
  add: string
}

export interface GuidanceFix {
  problem: string
  fix: string
}

export interface PageGuidance {
  diagnosis: string
  title: GuidanceRewrite | null
  meta_description: GuidanceRewrite | null
  content_gaps: ContentGap[]
  /** The concrete change that resolves each known problem. Optional so
   * guidance persisted before this field existed still renders. */
  fixes?: GuidanceFix[]
}

export type InsightSeverity = 'critical' | 'warning' | 'info'
export type InsightSource = 'content' | 'traffic' | 'search' | 'speed'

export interface PageInsight {
  id: string
  source: InsightSource
  severity: InsightSeverity
  title: string
  detail: string
  action: string
  evidence: string
  impact: number
}

export interface PageInsightsResponse {
  summary: {
    visitors: number | null
    leads: number | null
    search_clicks: number | null
    search_position: number | null
    speed_score: number | null
    speed_strategy: string | null
  }
  insights: PageInsight[]
  sources: InsightSource[]
}

/** Rule-based analysis — no AI, so it's instant, free and identical for
 * identical data. One request covers the whole overview (summary numbers +
 * ranked findings) rather than one per data source. */
export function usePageInsights(ref: string, siteId?: string | null) {
  return useQuery({
    queryKey: ['content-insights', ref, siteId],
    queryFn: () => get<PageInsightsResponse>(`/optimizer/content-health/${ref}/insights`, {
      ...(siteId ? { site_id: siteId } : {}),
    }),
    enabled: Boolean(ref),
    staleTime: 5 * 60_000,
  })
}

export interface SearchQueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number // 0-100
  position: number
}

export interface SearchDailyPoint {
  date: string
  clicks: number
  impressions: number
}

export interface CtrOpportunity {
  position: number
  ctr: number
  typical_ctr: number
  potential_clicks: number
}

export interface SearchConsoleData {
  connected: boolean
  range_start: string | null
  range_end: string | null
  clicks: number
  impressions: number
  ctr: number // 0-100
  position: number
  clicks_change_pct: number | null
  impressions_change_pct: number | null
  /** Raw difference, not a percentage — and the one metric where NEGATIVE
   * is an improvement (position 8 → 7 is moving up the results). */
  position_change: number | null
  daily: SearchDailyPoint[]
  queries: SearchQueryRow[]
  striking_distance: SearchQueryRow[]
  ctr_opportunity: CtrOpportunity | null
  error?: string | null
}

export function useSearchConsole(ref: string, siteId?: string | null) {
  return useQuery({
    queryKey: ['content-search-console', ref, siteId],
    queryFn: () => get<SearchConsoleData>(`/optimizer/content-health/${ref}/search-console`, {
      ...(siteId ? { site_id: siteId } : {}),
    }),
    enabled: Boolean(ref),
    staleTime: 10 * 60_000, // GSC updates daily at best
  })
}

export type VitalRating = 'good' | 'needs_work' | 'poor'

export interface PageSpeedMetric {
  key: string
  label: string
  value: number
  unit: string // "ms" | "" (CLS is unitless)
  rating: VitalRating | null
}

export interface PageSpeed {
  /** False when this page has never been tested — the card offers to run
   * one rather than showing an error. */
  tested: boolean
  score: number | null
  rating: VitalRating | null
  strategy: 'mobile' | 'desktop'
  metrics: PageSpeedMetric[]
  tested_at: string | null
  page_url: string | null
  error?: string | null
}

/** Cached result only — never triggers a live test, so it can't delay the
 * page. A real PSI run takes 10-30s; that's what useRunPageSpeed is for. */
export function usePageSpeed(ref: string, siteId?: string | null) {
  return useQuery({
    queryKey: ['content-pagespeed', ref, siteId],
    queryFn: () => get<PageSpeed>(`/optimizer/content-health/${ref}/pagespeed`, {
      ...(siteId ? { site_id: siteId } : {}),
    }),
    enabled: Boolean(ref),
    staleTime: 5 * 60_000,
  })
}

export function useRunPageSpeed(ref: string, siteId?: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post<PageSpeed>(`/optimizer/content-health/${ref}/pagespeed`, undefined, {
      ...(siteId ? { site_id: siteId } : {}),
    }),
    // Seed the cache with the fresh result so the card updates without a
    // second round trip.
    onSuccess: (data) => qc.setQueryData(['content-pagespeed', ref, siteId], data),
  })
}

export function useContentPostAnalytics(ref: string, siteId?: string | null) {
  return useQuery({
    queryKey: ['content-post-analytics', ref, siteId ?? null],
    queryFn: () =>
      get<ContentPostAnalytics>(
        `/optimizer/content-health/${ref}/analytics`,
        siteId ? { site_id: siteId } : undefined
      ),
    enabled: Boolean(ref),
    staleTime: 5 * 60_000, // live GA4 call — no need to refetch aggressively
  })
}

export function useRescanPost(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post(`/optimizer/content-health/${postId}/rescan`),
    // onSettled, not onSuccess: a 404 here can mean the post was just
    // confirmed deleted from WordPress and removed server-side — the list
    // and detail queries need to refresh to reflect that even though the
    // mutation itself "failed".
    onSettled: () => {
      // Prefix match — the detail page may be keyed by slug rather than id
      qc.invalidateQueries({ queryKey: ['content-post'] })
      qc.invalidateQueries({ queryKey: ['content-health'] })
    },
  })
}

/** True when a rescan failure means the post is confirmed gone from
 * WordPress (backend already deleted the stale row) — retrying is
 * pointless, unlike a transient failure (WP unreachable, rate limited). */
export function isPostGoneError(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404
}

/** True when the request was rate limited rather than genuinely failing —
 * clicking again immediately just burns another slot and makes the wait
 * longer, so the UI must say "wait", not "retry". */
export function isRateLimitedError(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 429
}

/** Seconds the server asked us to wait, from the Retry-After header it sends
 * with every 429. Null when absent/unparseable. */
export function retryAfterSeconds(err: unknown): number | null {
  const raw = (err as { response?: { headers?: Record<string, string> } })
    ?.response?.headers?.['retry-after']
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function rescanErrorDetail(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
}

export function useRegenerateAI(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      post<{ ai_recommendation: string | null; ai_guidance: PageGuidance | null; generation_failed: boolean }>(
        `/optimizer/content-health/${postId}/regenerate-ai`,
      ),
    onSuccess: () => {
      // Prefix match — the detail page may be keyed by slug rather than id
      qc.invalidateQueries({ queryKey: ['content-post'] })
    },
  })
}

export interface BulkRescanProgress {
  total: number
  done: number
  failed: number
  removed: number
  running: boolean
  started_at: string | null
  finished_at: string | null
  failures: string[]
}

/** Rescan a selection in ONE request. Firing the per-post endpoint per row
 *  means N WordPress fetches, N page fetches and N AI calls launched at
 *  whatever rate the browser manages — which is what the per-post rate limit
 *  exists to stop. */
export function useBulkRescan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postIds: string[]) =>
      post<{ queued: number; skipped: number }>(
        '/optimizer/content-health/rescan-bulk', { post_ids: postIds }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulk-rescan-status'] }),
  })
}

/** Polls only while a batch is in flight, so an idle page is not asking. */
export function useBulkRescanStatus(active: boolean) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['bulk-rescan-status'],
    queryFn: async () => {
      const data = await get<BulkRescanProgress>('/optimizer/content-health/rescan-bulk/status')
      // Rows change as the batch lands, so refresh the table as it goes
      // rather than only at the end.
      qc.invalidateQueries({ queryKey: ['content-health'] })
      return data
    },
    refetchInterval: active ? 2_000 : false,
    enabled: active,
  })
}

