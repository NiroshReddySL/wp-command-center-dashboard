import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@/lib/api'
import {
  ExternalLink, RefreshCw, X, Trash2, Search, Loader2, ChevronUp, ChevronDown, ChevronsUpDown,
  SlidersHorizontal, Check,
} from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import QueryError from '@/components/ui/QueryError'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import Skeleton from '@/components/ui/Skeleton'
import { SkeletonCard } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Pagination from '@/components/ui/Pagination'
import SeoOpportunityCard, { type SeoOpportunity } from '@/components/domain/SeoOpportunityCard'
import ContentScoreBar from '@/components/domain/ContentScoreBar'
import SparkLine from '@/components/charts/SparkLine'
import { useSiteContext } from '@/contexts/SiteContext'
import {
  useContentHealth, useRescanPost, isPostGoneError, rescanErrorDetail,
  CONTENT_TYPE_OPTIONS, HEALTH_STATUS_OPTIONS, ANALYZED_OPTIONS, ISSUE_CATEGORY_OPTIONS,
  type ContentSortBy, type SortDir, type ContentTypeFilter, type HealthStatusFilter, type AnalyzedFilter,
  type IssueCategory,
} from '@/hooks/useOptimizer'
import { formatNumber, timeAgo, cn } from '@/lib/utils'

const SEO_PAGE_SIZE = 8
const CONTENT_PAGE_SIZE = 10
const LINKS_PAGE_SIZE = 8
const SEARCH_DEBOUNCE_MS = 400
const CONTENT_SORT_FIELDS: ContentSortBy[] = ['health_score', 'traffic_30d', 'word_count', 'last_analyzed_at', 'title']
// Mirrors the backend's _DEFAULT_SORT_DIR exactly, so a freshly-clicked
// column header always shows a concrete, correct direction — never an
// ambiguous "unset, backend will decide" state the toggle button can't
// reason about on the next click.
const DEFAULT_SORT_DIR: Record<ContentSortBy, SortDir> = {
  health_score: 'asc', traffic_30d: 'desc', word_count: 'asc', last_analyzed_at: 'asc', title: 'asc',
}

/** Reads a URL param back into typed state only if it's one of the known
 * valid values — anything else (stale/tampered URL) falls back to "no filter". */
function paramOr<T extends string>(searchParams: URLSearchParams, key: string, valid: readonly T[]): T | '' {
  const v = searchParams.get(key)
  return v && (valid as readonly string[]).includes(v) ? (v as T) : ''
}

/** Same as paramOr but for a repeated-key param (?key=a&key=b) backing a
 * multi-select filter — invalid/stale values are dropped rather than
 * rejecting the whole list. */
function paramsListOr<T extends string>(searchParams: URLSearchParams, key: string, valid: readonly T[]): T[] {
  return searchParams.getAll(key).filter((v): v is T => (valid as readonly string[]).includes(v))
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

// ——— Sortable column header ————————————————————————————————
function SortableHeader({
  label, field, activeSort, activeDir, onSort, className,
}: {
  label: string
  field: ContentSortBy
  activeSort: ContentSortBy
  activeDir: SortDir | ''
  onSort: (field: ContentSortBy) => void
  className?: string
}) {
  const isActive = activeSort === field
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className={cn(
          'flex items-center gap-1 hover:text-text-primary dark:hover:text-text-primary-dark transition-colors',
          isActive ? 'text-primary dark:text-primary-dark font-semibold' : 'text-text-secondary dark:text-text-secondary-dark'
        )}
      >
        {label}
        {isActive ? (
          activeDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

// ——— Filter chip ——————————————————————————————————————————
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 dark:bg-primary-dark/15 text-primary dark:text-primary-dark text-[11px] font-medium">
      {label}
      <button onClick={onRemove} className="p-0.5 rounded-full hover:bg-primary/20 dark:hover:bg-primary-dark/25 transition-colors">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

// ——— Advanced filter popover ——————————————————————————————
interface ContentFilters {
  contentType: ContentTypeFilter | ''
  healthStatus: HealthStatusFilter[]
  issueCategories: IssueCategory[]
  analyzed: AnalyzedFilter | ''
}

function ContentFilterPanel({
  filters, onContentTypeChange, onHealthStatusToggle, onIssueCategoryToggle, onAnalyzedChange, onClear, activeCount,
}: {
  filters: ContentFilters
  onContentTypeChange: (v: ContentTypeFilter | '') => void
  onHealthStatusToggle: (v: HealthStatusFilter) => void
  onIssueCategoryToggle: (v: IssueCategory) => void
  onAnalyzedChange: (v: AnalyzedFilter | '') => void
  onClear: () => void
  activeCount: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-8 flex items-center gap-1.5 px-3 rounded-md text-[12px] font-medium border transition-colors duration-150',
          activeCount > 0
            ? 'bg-primary/10 dark:bg-primary-dark/15 border-primary/40 dark:border-primary-dark/40 text-primary dark:text-primary-dark'
            : 'bg-card dark:bg-card-dark border-border dark:border-border-dark text-text-primary dark:text-text-primary-dark hover:bg-surface dark:hover:bg-surface-dark',
          open && 'ring-2 ring-primary/20 dark:ring-primary-dark/20'
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary dark:bg-primary-dark text-white text-[10px] font-semibold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[380px] rounded-lg border border-border dark:border-border-dark bg-white dark:bg-card-dark shadow-dropdown overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border dark:border-border-dark bg-surface/40 dark:bg-surface-dark/40">
            <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">Filters</span>
            {activeCount > 0 && (
              <button onClick={onClear} className="text-[11px] text-primary dark:text-primary-dark hover:underline">
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-1.5">
                Content Type
              </p>
              <div className="flex gap-1.5">
                {(['', ...CONTENT_TYPE_OPTIONS.map((o) => o.value)] as (ContentTypeFilter | '')[]).map((val) => (
                  <button
                    key={val || 'all'}
                    onClick={() => onContentTypeChange(val)}
                    className={cn(
                      'h-7 px-3 rounded-md text-[11.5px] font-medium border transition-colors',
                      filters.contentType === val
                        ? 'bg-primary dark:bg-primary-dark text-white border-transparent'
                        : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark'
                    )}
                  >
                    {val === '' ? 'All' : CONTENT_TYPE_OPTIONS.find((o) => o.value === val)?.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-1.5">
                Health Status <span className="normal-case font-normal">(select any)</span>
              </p>
              <div className="flex flex-col gap-1">
                {HEALTH_STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 py-0.5 text-[12px] text-text-primary dark:text-text-primary-dark cursor-pointer select-none">
                    <span className={cn(
                      'flex items-center justify-center h-4 w-4 rounded border flex-shrink-0 transition-colors',
                      filters.healthStatus.includes(opt.value)
                        ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark'
                        : 'border-border dark:border-border-dark'
                    )}>
                      {filters.healthStatus.includes(opt.value) && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <input type="checkbox" className="sr-only" checked={filters.healthStatus.includes(opt.value)}
                      onChange={() => onHealthStatusToggle(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-1.5">
                Specific Issues <span className="normal-case font-normal">(select any)</span>
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {ISSUE_CATEGORY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 py-0.5 text-[11.5px] text-text-primary dark:text-text-primary-dark cursor-pointer select-none">
                    <span className={cn(
                      'flex items-center justify-center h-4 w-4 rounded border flex-shrink-0 transition-colors',
                      filters.issueCategories.includes(opt.value)
                        ? 'bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark'
                        : 'border-border dark:border-border-dark'
                    )}>
                      {filters.issueCategories.includes(opt.value) && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <input type="checkbox" className="sr-only" checked={filters.issueCategories.includes(opt.value)}
                      onChange={() => onIssueCategoryToggle(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-1.5">
                Analysis Status
              </p>
              <div className="flex gap-1.5">
                {(['', ...ANALYZED_OPTIONS.map((o) => o.value)] as (AnalyzedFilter | '')[]).map((val) => (
                  <button
                    key={val || 'all'}
                    onClick={() => onAnalyzedChange(val)}
                    className={cn(
                      'h-7 px-3 rounded-md text-[11.5px] font-medium border transition-colors',
                      filters.analyzed === val
                        ? 'bg-primary dark:bg-primary-dark text-white border-transparent'
                        : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark'
                    )}
                  >
                    {val === '' ? 'All' : ANALYZED_OPTIONS.find((o) => o.value === val)?.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SeoOpportunityFull extends SeoOpportunity {
  site_id: string
  alert_type: string
  metadata: Record<string, unknown>
}

interface InternalLinkSuggestion {
  id: string
  source_title: string
  source_url: string
  target_title: string
  target_url: string
  anchor_text: string
  shared_keywords: string[]
}

// ——— SEO Detail Modal ————————————————————————————————————
function SeoModal({ opp, onClose }: { opp: SeoOpportunityFull; onClose: () => void }) {
  const meta = opp.metadata
  const typeLabels: Record<string, string> = {
    seo_title_short: 'Title Too Short',
    seo_title_long: 'Title Too Long',
    seo_thin_content: 'Thin Content',
    seo_no_images: 'Missing Images',
    seo_ranking_opportunity: 'Ranking Opportunity',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border dark:border-border-dark">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={opp.severity as 'critical' | 'warning' | 'info'}>{opp.severity}</Badge>
              <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                {typeLabels[opp.alert_type] ?? opp.alert_type}
              </span>
            </div>
            <p className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark line-clamp-2">{opp.page_title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-secondary hover:bg-surface dark:hover:bg-surface-dark transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {opp.page_url && (
            <div>
              <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">Page</p>
              <a href={opp.page_url} target="_blank" rel="noopener noreferrer"
                className="text-[12px] text-primary dark:text-primary-dark hover:underline flex items-center gap-1 break-all">
                {opp.page_url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">Site</p>
              <span className="text-[12px] text-text-primary dark:text-text-primary-dark">{opp.site_name}</span>
            </div>
            {opp.word_count != null && (
              <div className="ml-6">
                <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">Word Count</p>
                <span className={`text-[13px] font-semibold ${opp.word_count < 300 ? 'text-danger' : opp.word_count < 800 ? 'text-warning' : 'text-success'}`}>
                  {opp.word_count.toLocaleString()} words
                </span>
              </div>
            )}
          </div>
          {opp.alert_type === 'seo_ranking_opportunity' && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Position', value: meta.position != null ? `#${meta.position}` : '—' },
                { label: 'Impressions', value: meta.impressions != null ? formatNumber(meta.impressions as number) : '—' },
                { label: 'Clicks', value: meta.clicks != null ? formatNumber(meta.clicks as number) : '—' },
                { label: 'CTR', value: meta.ctr != null ? `${meta.ctr}%` : '—' },
                { label: 'Est. Traffic Gain', value: meta.estimated_traffic_gain != null ? `+${formatNumber(meta.estimated_traffic_gain as number)}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-background dark:bg-background-dark border border-border dark:border-border-dark rounded-md p-3">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark mb-0.5">{label}</p>
                  <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">{value}</p>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">Recommendation</p>
            <div className="bg-background dark:bg-background-dark border border-border dark:border-border-dark rounded-md p-3">
              <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed">{opp.ai_recommendation}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border dark:border-border-dark">
          {opp.page_url && (
            <a href={opp.page_url} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="sm" className="flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Open page
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ——— Tab header with count + flush ———————————————————————
function TabActions({
  count,
  module,
  isFlushing,
  disabled,
  onFlush,
}: {
  count?: number
  module: string
  isFlushing: boolean
  disabled: boolean
  onFlush: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      {count != null ? (
        <span className="text-[13px] text-text-secondary dark:text-text-secondary-dark">
          {count} {count === 1 ? 'item' : 'items'} found
        </span>
      ) : <span />}
      <Button
        variant="ghost"
        size="sm"
        loading={isFlushing}
        disabled={disabled}
        title={disabled ? 'Select a site to flush' : `Flush ${module} data and re-run`}
        onClick={() => {
          if (confirm(`Clear all ${module} data${disabled ? '' : ' for this site'} and re-run analysis?`)) onFlush()
        }}
        className="flex items-center gap-1.5 text-text-secondary dark:text-text-secondary-dark"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Flush & Re-run
      </Button>
    </div>
  )
}

function RescanRowButton({ postId }: { postId: string }) {
  const rescan = useRescanPost(postId)
  // A 404 here means the post was just confirmed deleted from WordPress and
  // removed server-side — the row disappears once the list refetches
  // (see useRescanPost's onSettled), so there's nothing useful to retry.
  const postGone = rescan.isError && isPostGoneError(rescan.error)
  return (
    <button
      onClick={() => rescan.mutate()}
      disabled={rescan.isPending || postGone}
      title={
        postGone ? rescanErrorDetail(rescan.error, 'This page no longer exists on WordPress')
        : rescan.isError ? 'Rescan failed — click to retry'
        : 'Rescan this post'
      }
      className={cn(
        'p-1 rounded transition-colors disabled:opacity-50',
        rescan.isError
          ? 'text-danger hover:bg-danger/10 dark:hover:bg-danger/20'
          : 'text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark'
      )}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', rescan.isPending && 'animate-spin')} />
    </button>
  )
}

// ——— Main page —————————————————————————————————————————
export default function Optimizer() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // List-view state (tab, sort, search, page-per-tab) round-trips through the
  // URL so it survives navigating to a content post and back — without this,
  // "View" → back always dropped you on page 1 (state was component-local).
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'seo')
  const [sortBy, setSortBy] = useState<ContentSortBy>(
    () => paramOr(searchParams, 'sort', CONTENT_SORT_FIELDS) || 'health_score'
  )
  const [sortDir, setSortDir] = useState<SortDir>(
    () => paramOr(searchParams, 'dir', ['asc', 'desc'] as const) || DEFAULT_SORT_DIR[
      paramOr(searchParams, 'sort', CONTENT_SORT_FIELDS) || 'health_score'
    ]
  )
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter | ''>(
    () => paramOr(searchParams, 'type', CONTENT_TYPE_OPTIONS.map((o) => o.value))
  )
  const [healthStatusFilter, setHealthStatusFilter] = useState<HealthStatusFilter[]>(
    () => paramsListOr(searchParams, 'health', HEALTH_STATUS_OPTIONS.map((o) => o.value))
  )
  const [hasIssuesFilter, setHasIssuesFilter] = useState<'' | 'yes' | 'no'>(
    () => paramOr(searchParams, 'issues', ['yes', 'no'] as const)
  )
  const [issueCategoriesFilter, setIssueCategoriesFilter] = useState<IssueCategory[]>(
    () => paramsListOr(searchParams, 'issueCat', ISSUE_CATEGORY_OPTIONS.map((o) => o.value))
  )
  const [analyzedFilter, setAnalyzedFilter] = useState<AnalyzedFilter | ''>(
    () => paramOr(searchParams, 'analyzed', ANALYZED_OPTIONS.map((o) => o.value))
  )
  const [selectedOpp, setSelectedOpp] = useState<SeoOpportunityFull | null>(null)
  const [flushingModule, setFlushingModule] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [seoPage, setSeoPage] = useState(() => Math.max(1, Number(searchParams.get('seoPage')) || 1))
  const [contentPage, setContentPage] = useState(() => Math.max(1, Number(searchParams.get('contentPage')) || 1))
  const [linksPage, setLinksPage] = useState(() => Math.max(1, Number(searchParams.get('linksPage')) || 1))
  const [contentSearch, setContentSearch] = useState(searchParams.get('q') ?? '')
  // Debounced so typing doesn't fire an API request per keystroke — search now
  // runs server-side against the full table, not a client-side re-filter.
  const [debouncedSearch, setDebouncedSearch] = useState(contentSearch)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mirror state → URL (replace, so paging/searching never spams browser history).
  useEffect(() => {
    const next = new URLSearchParams()
    if (activeTab !== 'seo') next.set('tab', activeTab)
    if (sortBy !== 'health_score') next.set('sort', sortBy)
    if (sortDir !== DEFAULT_SORT_DIR[sortBy]) next.set('dir', sortDir)
    if (contentTypeFilter) next.set('type', contentTypeFilter)
    healthStatusFilter.forEach((v) => next.append('health', v))
    if (hasIssuesFilter) next.set('issues', hasIssuesFilter)
    issueCategoriesFilter.forEach((v) => next.append('issueCat', v))
    if (analyzedFilter) next.set('analyzed', analyzedFilter)
    if (contentSearch) next.set('q', contentSearch)
    if (seoPage !== 1) next.set('seoPage', String(seoPage))
    if (contentPage !== 1) next.set('contentPage', String(contentPage))
    if (linksPage !== 1) next.set('linksPage', String(linksPage))
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab, sortBy, sortDir, contentTypeFilter, healthStatusFilter, hasIssuesFilter, issueCategoriesFilter,
    analyzedFilter, contentSearch, seoPage, contentPage, linksPage,
  ])

  const qc = useQueryClient()
  const { selectedSiteId } = useSiteContext()
  const autoSwitched = useRef(false)

  // Poll for ~90s after a flush so background re-run results appear as they land
  const startRefreshing = () => {
    setRefreshing(true)
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => setRefreshing(false), 90_000)
  }
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(contentSearch), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [contentSearch])

  const { data: seoOpps, isLoading: seoLoading, isError: seoError, refetch: refetchSeo } = useQuery({
    queryKey: ['seo-opportunities', selectedSiteId],
    queryFn: () => get<SeoOpportunityFull[]>('/optimizer/seo-opportunities', selectedSiteId ? { site_id: selectedSiteId } : undefined),
    staleTime: refreshing ? 0 : 60_000,
    refetchInterval: refreshing ? 5_000 : false,
  })

  const { data: contentHealth, isLoading: contentLoading, isError: contentError, refetch: refetchContent } = useContentHealth(sortBy, {
    siteId: selectedSiteId ?? undefined,
    search: debouncedSearch,
    sortDir,
    contentType: contentTypeFilter || undefined,
    healthStatus: healthStatusFilter,
    hasIssues: hasIssuesFilter === 'yes' ? true : hasIssuesFilter === 'no' ? false : undefined,
    issueCategories: issueCategoriesFilter,
    analyzed: analyzedFilter || undefined,
    page: contentPage,
    pageSize: CONTENT_PAGE_SIZE,
    staleTime: refreshing ? 0 : 60_000,
    refetchInterval: refreshing ? 5_000 : false,
  })

  const { data: internalLinks, isLoading: linksLoading, isError: linksError, refetch: refetchLinks } = useQuery({
    queryKey: ['internal-links', selectedSiteId],
    queryFn: () => get<InternalLinkSuggestion[]>('/optimizer/internal-links', selectedSiteId ? { site_id: selectedSiteId } : undefined),
    staleTime: refreshing ? 0 : 60_000,
    refetchInterval: refreshing ? 5_000 : false,
  })

  const anyError = seoError || contentError || linksError
  const retryAll = () => { refetchSeo(); refetchContent(); refetchLinks() }

  // Auto-switch away from SEO tab on first load if it's empty — user can still navigate back manually
  useEffect(() => {
    if (autoSwitched.current) return
    if (!seoLoading && seoOpps !== undefined && seoOpps.length === 0) {
      if (contentHealth && contentHealth.total > 0) {
        setActiveTab('content')
        autoSwitched.current = true
      } else if (internalLinks && internalLinks.length > 0) {
        setActiveTab('links')
        autoSwitched.current = true
      }
    }
  }, [seoOpps, seoLoading, contentHealth, internalLinks])

  const flush = useMutation({
    mutationFn: ({ module }: { module: string }) =>
      post('/optimizer/flush', { site_id: selectedSiteId || undefined, module }),
    onMutate: ({ module }) => setFlushingModule(module),
    onSettled: (_data, _err, { module }) => {
      setFlushingModule(null)
      // Clear the deleted data immediately, then poll for the background re-run
      if (module === 'seo' || module === 'all') qc.invalidateQueries({ queryKey: ['seo-opportunities'] })
      if (module === 'content' || module === 'all') qc.invalidateQueries({ queryKey: ['content-health'] })
      if (module === 'links' || module === 'all') qc.invalidateQueries({ queryKey: ['internal-links'] })
      startRefreshing()
    },
  })

  const handleContentSearch = (value: string) => {
    setContentSearch(value)
    setContentPage(1)
  }

  // Every sort/filter change restarts pagination at page 1 — otherwise a
  // narrower result set could leave the user stranded on a now-empty page.
  // Clicking the already-active column header toggles direction; clicking
  // a different one switches to it at that field's natural default.
  const handleSortHeaderClick = (field: ContentSortBy) => {
    if (field === sortBy) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(DEFAULT_SORT_DIR[field])
    }
    setContentPage(1)
  }
  const handleContentTypeChange = (value: ContentTypeFilter | '') => { setContentTypeFilter(value); setContentPage(1) }
  const handleHealthStatusToggle = (value: HealthStatusFilter) => {
    setHealthStatusFilter((prev) => toggleInArray(prev, value))
    setContentPage(1)
  }
  const handleHasIssuesChange = (value: '' | 'yes' | 'no') => { setHasIssuesFilter(value); setContentPage(1) }
  const handleIssueCategoryToggle = (value: IssueCategory) => {
    setIssueCategoriesFilter((prev) => toggleInArray(prev, value))
    setContentPage(1)
  }
  const handleAnalyzedChange = (value: AnalyzedFilter | '') => { setAnalyzedFilter(value); setContentPage(1) }

  const contentFilterCount =
    (contentTypeFilter ? 1 : 0) + healthStatusFilter.length + (hasIssuesFilter ? 1 : 0) +
    issueCategoriesFilter.length + (analyzedFilter ? 1 : 0)
  const clearContentFilters = () => {
    setContentTypeFilter(''); setHealthStatusFilter([]); setHasIssuesFilter('')
    setIssueCategoriesFilter([]); setAnalyzedFilter('')
    setContentPage(1)
  }

  // Content health is already the correct page + search filter — the API
  // paginates and searches server-side against the full table (an enterprise
  // site holds thousands of rows; a client-side re-slice would only ever see
  // whatever single page happened to be fetched).
  const contentRows = contentHealth?.items ?? []
  const contentTotal = contentHealth?.total ?? 0

  const activeContentFilterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(contentTypeFilter
      ? [{ key: 'type', label: CONTENT_TYPE_OPTIONS.find((o) => o.value === contentTypeFilter)!.label, onRemove: () => handleContentTypeChange('') }]
      : []),
    ...healthStatusFilter.map((v) => ({
      key: `health-${v}`, label: HEALTH_STATUS_OPTIONS.find((o) => o.value === v)!.label,
      onRemove: () => handleHealthStatusToggle(v),
    })),
    ...(hasIssuesFilter
      ? [{ key: 'issues', label: hasIssuesFilter === 'yes' ? 'Has issues' : 'Clean', onRemove: () => handleHasIssuesChange('') }]
      : []),
    ...issueCategoriesFilter.map((v) => ({
      key: `issueCat-${v}`, label: ISSUE_CATEGORY_OPTIONS.find((o) => o.value === v)!.label,
      onRemove: () => handleIssueCategoryToggle(v),
    })),
    ...(analyzedFilter
      ? [{ key: 'analyzed', label: ANALYZED_OPTIONS.find((o) => o.value === analyzedFilter)!.label, onRemove: () => handleAnalyzedChange('') }]
      : []),
  ]

  // Paginated slices (SEO opportunities + internal links are still small
  // alert-derived lists, so client-side slicing remains fine for those)
  const seoSlice = seoOpps?.slice((seoPage - 1) * SEO_PAGE_SIZE, seoPage * SEO_PAGE_SIZE) ?? []
  const linksSlice = internalLinks?.slice((linksPage - 1) * LINKS_PAGE_SIZE, linksPage * LINKS_PAGE_SIZE) ?? []

  return (
    <PageShell
      title="Optimizer"
      subtitle="Find SEO opportunities and improve content health across your sites."
    >
      {/* Controls row */}
      {selectedSiteId && (
        <div className="flex items-center gap-3 -mt-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            loading={flush.isPending && flushingModule === 'all'}
            onClick={() => {
              if (confirm('Flush and re-run ALL optimizer agents for this site?')) flush.mutate({ module: 'all' })
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Flush all & Re-run
          </Button>
        </div>
      )}

      {refreshing && (
        <div className="-mt-2 mb-4 flex items-center gap-2 rounded-lg border border-secondary/30 bg-surface dark:bg-surface-dark px-4 py-2.5 text-[12px] text-primary dark:text-primary-dark">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Re-running optimizer agents — results will appear here as they finish.
        </div>
      )}

      {/* An unreachable API must never read as "no opportunities found" */}
      {anyError && <QueryError what="optimizer data" onRetry={retryAll} className="-mt-2 mb-4" />}

      <Tabs defaultValue="seo" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="seo">
            SEO Opportunities
            {(seoOpps?.length ?? 0) > 0 && (
              <Badge variant="warning" className="ml-1.5">{seoOpps!.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="content">
            Content Health
            {contentTotal > 0 && (
              <Badge variant="info" className="ml-1.5">{contentTotal}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="links">
            Internal Linking
            {(internalLinks?.length ?? 0) > 0 && (
              <Badge variant="default" className="ml-1.5">{internalLinks!.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── SEO Opportunities ─────────────────────────────────── */}
        <TabsContent value="seo">
          <TabActions
            count={seoOpps?.length}
            module="SEO"
            isFlushing={flush.isPending && flushingModule === 'seo'}
            disabled={false}
            onFlush={() => flush.mutate({ module: 'seo' })}
          />
          {seoLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : !seoOpps?.length ? (
            <EmptyState title="No SEO opportunities found" description="Sync a site and run the optimizer agent to find issues." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                {seoSlice.map((opp) => (
                  <SeoOpportunityCard key={opp.id} opportunity={opp} onViewAnalysis={() => setSelectedOpp(opp)} />
                ))}
              </div>
              <Pagination page={seoPage} total={seoOpps.length} pageSize={SEO_PAGE_SIZE} onPageChange={setSeoPage} />
            </>
          )}
        </TabsContent>

        {/* ── Content Health ────────────────────────────────────── */}
        <TabsContent value="content">
          <TabActions
            count={contentTotal}
            module="content"
            isFlushing={flush.isPending && flushingModule === 'content'}
            disabled={false}
            onFlush={() => flush.mutate({ module: 'content' })}
          />
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <ContentFilterPanel
              filters={{
                contentType: contentTypeFilter, healthStatus: healthStatusFilter,
                issueCategories: issueCategoriesFilter, analyzed: analyzedFilter,
              }}
              onContentTypeChange={handleContentTypeChange}
              onHealthStatusToggle={handleHealthStatusToggle}
              onIssueCategoryToggle={handleIssueCategoryToggle}
              onAnalyzedChange={handleAnalyzedChange}
              onClear={clearContentFilters}
              activeCount={contentFilterCount}
            />

            <Select value={hasIssuesFilter} onChange={(e) => handleHasIssuesChange(e.target.value as '' | 'yes' | 'no')} className="w-32 h-8 text-[12px]">
              <option value="">Issues: all</option>
              <option value="yes">Has issues</option>
              <option value="no">Clean</option>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark pointer-events-none" />
              <input
                type="text"
                placeholder="Search by title or URL…"
                value={contentSearch}
                onChange={(e) => handleContentSearch(e.target.value)}
                className="pl-8 pr-8 py-1.5 text-[12px] bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary dark:placeholder:text-text-secondary-dark w-60"
              />
              {contentSearch && (
                <button
                  onClick={() => handleContentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <span className="ml-auto text-[11px] text-text-secondary dark:text-text-secondary-dark flex-shrink-0">
              {contentTotal} result{contentTotal === 1 ? '' : 's'}
            </span>
          </div>

          {activeContentFilterChips.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {activeContentFilterChips.map((chip) => (
                <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
              ))}
              <button onClick={clearContentFilters} className="text-[11px] text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark underline">
                Clear all
              </button>
            </div>
          )}
          {/* contentLoading only shows a skeleton on the very first load — page/search
              changes keep the previous page visible via placeholderData (no flash) */}
          {contentLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : contentTotal === 0 && !contentSearch ? (
            <EmptyState title="No content analyzed yet" description="Connect a site to start analyzing content." />
          ) : contentTotal === 0 ? (
            <EmptyState title="No results" description={`No posts match "${contentSearch}"`} />
          ) : (
            <>
              <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader label="Title" field="title" activeSort={sortBy} activeDir={sortDir} onSort={handleSortHeaderClick} />
                      <TableHead>Site</TableHead>
                      <SortableHeader label="Health Score" field="health_score" activeSort={sortBy} activeDir={sortDir} onSort={handleSortHeaderClick} className="w-40" />
                      <SortableHeader label="Words" field="word_count" activeSort={sortBy} activeDir={sortDir} onSort={handleSortHeaderClick} className="w-24" />
                      <SortableHeader label="Traffic (30d)" field="traffic_30d" activeSort={sortBy} activeDir={sortDir} onSort={handleSortHeaderClick} className="w-28" />
                      <TableHead className="w-20">Trend</TableHead>
                      <TableHead>Issues</TableHead>
                      <SortableHeader label="Last analyzed" field="last_analyzed_at" activeSort={sortBy} activeDir={sortDir} onSort={handleSortHeaderClick} className="w-28" />
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contentRows.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <a href={post.url} target="_blank" rel="noopener noreferrer"
                            className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark hover:text-primary dark:hover:text-primary-dark line-clamp-1">
                            {post.title}
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">{post.site_name}</span>
                            <Badge variant={post.content_type === 'page' ? 'info' : 'default'} className="text-[10px] capitalize">
                              {post.content_type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell><ContentScoreBar score={post.health_score} /></TableCell>
                        <TableCell className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
                          {post.word_count > 0 ? formatNumber(post.word_count) : '—'}
                        </TableCell>
                        <TableCell className="text-[12px]">{formatNumber(post.traffic_30d)}</TableCell>
                        <TableCell>
                          {post.traffic_trend?.length > 1 ? (
                            <SparkLine
                              data={post.traffic_trend}
                              color={post.traffic_trend[post.traffic_trend.length - 1] >= post.traffic_trend[0] ? '#059669' : '#DC2626'}
                              width={60} height={24}
                            />
                          ) : <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">—</span>}
                        </TableCell>
                        <TableCell>
                          {(post.issues ?? []).length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="warning" className="text-[10px]">
                                {post.issues[0].length > 25 ? post.issues[0].slice(0, 25) + '…' : post.issues[0]}
                              </Badge>
                              {post.issues.length > 1 && (
                                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
                                  +{post.issues.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-success">Clean</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                          {timeAgo(post.last_analyzed_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/optimizer/content/${post.slug || post.id}`, {
                                state: { from: `${location.pathname}${location.search}` },
                              })}
                              className="text-[11px]"
                            >
                              View
                            </Button>
                            <RescanRowButton postId={post.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={contentPage} total={contentTotal} pageSize={CONTENT_PAGE_SIZE} onPageChange={setContentPage} />
            </>
          )}
        </TabsContent>

        {/* ── Internal Linking ──────────────────────────────────── */}
        <TabsContent value="links">
          <TabActions
            count={internalLinks?.length}
            module="internal links"
            isFlushing={flush.isPending && flushingModule === 'links'}
            disabled={false}
            onFlush={() => flush.mutate({ module: 'links' })}
          />
          {linksLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !internalLinks?.length ? (
            <EmptyState title="No suggestions" description="No internal linking opportunities found right now." />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {linksSlice.map((link) => (
                  <div key={link.id} className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-4">
                    <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-3">
                      Add a link inside this post
                    </p>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-warning mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark truncate">{link.source_title}</p>
                        <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">{link.source_url}</p>
                      </div>
                      <a href={`${link.source_url}?open-editor=true`} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary" size="sm" className="flex items-center gap-1 flex-shrink-0">
                          <ExternalLink className="h-3 w-3" /> Edit post
                        </Button>
                      </a>
                    </div>
                    <div className="flex items-center gap-2 bg-surface dark:bg-surface-dark rounded-md px-3 py-2 mb-3">
                      <span className="text-[12px] text-text-secondary dark:text-text-secondary-dark">Link the phrase</span>
                      <code className="text-[12px] font-semibold text-primary dark:text-primary-dark bg-primary/8 px-2 py-0.5 rounded">
                        {link.anchor_text}
                      </code>
                      <span className="text-[12px] text-text-secondary dark:text-text-secondary-dark">to</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-success mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark truncate">{link.target_title}</p>
                        <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">{link.target_url}</p>
                      </div>
                      <a href={link.target_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="flex items-center gap-1 flex-shrink-0">
                          <ExternalLink className="h-3 w-3" /> Preview
                        </Button>
                      </a>
                    </div>
                    {link.shared_keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border dark:border-border-dark">
                        <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">Related topics:</span>
                        {link.shared_keywords.map((kw) => (
                          <span key={kw} className="text-[10px] bg-surface dark:bg-surface-dark px-1.5 py-0.5 rounded text-text-secondary dark:text-text-secondary-dark">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Pagination page={linksPage} total={internalLinks.length} pageSize={LINKS_PAGE_SIZE} onPageChange={setLinksPage} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {selectedOpp && <SeoModal opp={selectedOpp} onClose={() => setSelectedOpp(null)} />}
    </PageShell>
  )
}
