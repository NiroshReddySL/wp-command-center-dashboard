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
  conversion_rate: number // 0-1
}

export interface ContentPostAnalytics {
  connected: boolean
  daily_traffic: DailyTrafficPoint[]
  traffic_30d: number
  traffic_prev_30d: number
  traffic_change_pct: number | null
  bounce_rate: number | null // 0-100
  avg_engagement_time: number | null // seconds
  flows: ConversionFlow[]
  error?: string | null
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

export function rescanErrorDetail(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
}

export function useRegenerateAI(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      post<{ ai_recommendation: string | null }>(`/optimizer/content-health/${postId}/regenerate-ai`),
    onSuccess: () => {
      // Prefix match — the detail page may be keyed by slug rather than id
      qc.invalidateQueries({ queryKey: ['content-post'] })
    },
  })
}
