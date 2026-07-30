import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, RefreshCw, AlertTriangle, CheckCircle, Info, XCircle, Sparkles, Clock, FileText, Image, Link2, Calendar, Heading, AlignLeft, History, Code2, TrendingUp, MousePointerClick, Timer, Route } from 'lucide-react'
import { motion } from 'framer-motion'
import PageShell from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import TrendIndicator from '@/components/ui/TrendIndicator'
import AreaChart from '@/components/charts/AreaChart'
import { cn, formatNumber, timeAgo, formatPercent } from '@/lib/utils'
import {
  useContentPostDetail, useContentPostAnalytics, useRegenerateAI, useRescanPost,
  isPostGoneError, rescanErrorDetail,
  type ScoreCategory, type ConversionFlow,
} from '@/hooks/useOptimizer'
import { useSiteContext } from '@/contexts/SiteContext'
import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api'
import Tooltip from '@/components/ui/Tooltip'

// ── Analytics overview ────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

interface FunnelStage {
  label: string
  count: number
  pctOfEntered: number
  isConfirmed: boolean // real submission data, not just a page view
}

function ConversionFunnel({ flow }: { flow: ConversionFlow }) {
  const stages: FunnelStage[] = [
    { label: 'Visited this post', count: flow.entered, pctOfEntered: 100, isConfirmed: false },
    { label: `Reached ${flow.label}`, count: flow.reached, pctOfEntered: flow.reach_rate * 100, isConfirmed: false },
    ...(flow.submitted != null
      ? [{ label: 'Submitted the form', count: flow.submitted, pctOfEntered: (flow.submission_rate ?? 0) * 100, isConfirmed: true }]
      : []),
  ]
  const maxCount = flow.entered || 1

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">{flow.label}</span>
        <a
          href={flow.target_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark truncate max-w-[240px]"
        >
          {flow.target_title}
        </a>
      </div>
      <div className="flex flex-col gap-1.5">
        {stages.map((stage) => {
          const widthPct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 3 : 0) : 0
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-36 flex-shrink-0 text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">
                {stage.label}
              </span>
              <div className="flex-1 h-4 rounded-full bg-surface dark:bg-surface-dark overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    stage.isConfirmed ? 'bg-success' : 'bg-primary dark:bg-primary-dark'
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className={cn(
                'w-28 flex-shrink-0 text-[11px] font-medium text-right',
                stage.isConfirmed ? 'text-success' : 'text-text-primary dark:text-text-primary-dark'
              )}>
                {formatNumber(stage.count)}
                <span className="text-text-secondary dark:text-text-secondary-dark font-normal"> ({formatPercent(stage.pctOfEntered, 1)})</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnalyticsOverviewCard({ postRef, siteId }: { postRef: string; siteId: string | null }) {
  const { data, isLoading, isError } = useContentPostAnalytics(postRef, siteId)

  return (
    <Card className="p-5 mb-5">
      <CardHeader className="mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle>Analytics Overview</CardTitle>
        </div>
        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">Google Analytics · last 30 days</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : isError || !data ? (
          <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark py-4">
            Couldn't load analytics right now.
          </p>
        ) : !data.connected ? (
          <EmptyState
            title="Connect Google Analytics"
            description="Connect your site's GA4 property in Settings to see traffic trends, bounce rate, and conversion flow for this post."
          />
        ) : data.error ? (
          <p className="text-[13px] text-danger py-4">{data.error}</p>
        ) : (
          <div className="space-y-5">
            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border dark:border-border-dark p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1.5">
                  <MousePointerClick className="h-3.5 w-3.5" /> Traffic (30d)
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-bold text-text-primary dark:text-text-primary-dark">
                    {formatNumber(data.traffic_30d)}
                  </span>
                  {data.traffic_change_pct != null && (
                    <TrendIndicator value={data.traffic_change_pct} />
                  )}
                </div>
                <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark mt-1">
                  vs {formatNumber(data.traffic_prev_30d)} previous 30 days
                </p>
              </div>

              <div className="rounded-lg border border-border dark:border-border-dark p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1.5">
                  <Route className="h-3.5 w-3.5" /> Bounce Rate
                </div>
                <span className={cn(
                  'text-[20px] font-bold',
                  data.bounce_rate == null ? 'text-text-secondary dark:text-text-secondary-dark'
                    : data.bounce_rate > 70 ? 'text-danger' : data.bounce_rate > 50 ? 'text-warning' : 'text-success'
                )}>
                  {data.bounce_rate != null ? formatPercent(data.bounce_rate, 1) : '—'}
                </span>
              </div>

              <div className="rounded-lg border border-border dark:border-border-dark p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1.5">
                  <Timer className="h-3.5 w-3.5" /> Avg. Engagement
                </div>
                <span className="text-[20px] font-bold text-text-primary dark:text-text-primary-dark">
                  {data.avg_engagement_time != null ? formatDuration(data.avg_engagement_time) : '—'}
                </span>
              </div>
            </div>

            {/* Daily traffic chart */}
            {data.daily_traffic.length > 0 && (
              <AreaChart
                data={data.daily_traffic as unknown as Record<string, unknown>[]}
                series={[{ key: 'views', label: 'Visitors' }]}
                height={160}
                formatter={(v) => formatNumber(v)}
              />
            )}

            {/* Flow to Contact/Pricing */}
            <div className="pt-4 border-t border-border dark:border-border-dark">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
                  Flow to Contact / Pricing
                </p>
                {data.total_leads != null && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {formatNumber(data.total_leads)} lead{data.total_leads === 1 ? '' : 's'} generated
                  </span>
                )}
              </div>
              {data.flows.length === 0 ? (
                <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
                  No Contact or Pricing page detected for this site yet.
                </p>
              ) : (
                <div className="space-y-5">
                  {data.flows.map((flow) => <ConversionFunnel key={flow.label} flow={flow} />)}
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
                    {data.total_leads != null
                      ? 'Submitted the form = reached your confirmation page after this flow — a real, attributable conversion.'
                      : 'Based on visitors who reached the page — no confirmation ("thank you") page detected yet to confirm actual submissions.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Score circle ──────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-danger'
  const ring =
    score >= 70 ? 'border-success/40' : score >= 40 ? 'border-warning/40' : 'border-danger/40'
  const bg =
    score >= 70 ? 'bg-success/10' : score >= 40 ? 'bg-warning/10' : 'bg-danger/10'

  return (
    <div className={cn('flex items-center justify-center w-16 h-16 rounded-full border-2', ring, bg)}>
      <span className={cn('text-xl font-bold', color)}>{score}</span>
    </div>
  )
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status?: string }) {
  if (status === 'good') return <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
  if (status === 'critical') return <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
  return <Info className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark flex-shrink-0" />
}

// ── Breakdown card ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  word_count:       { label: 'Word Count',       icon: <FileText className="h-4 w-4" /> },
  images:           { label: 'Images',            icon: <Image className="h-4 w-4" /> },
  links:            { label: 'Links',             icon: <Link2 className="h-4 w-4" /> },
  freshness:        { label: 'Freshness',         icon: <Calendar className="h-4 w-4" /> },
  title:            { label: 'Title Length',      icon: <FileText className="h-4 w-4" /> },
  headings:         { label: 'Headings',          icon: <Heading className="h-4 w-4" /> },
  meta_description: { label: 'Meta Description', icon: <AlignLeft className="h-4 w-4" /> },
  publish_history:  { label: 'Publish History',  icon: <History className="h-4 w-4" /> },
  schema_markup:    { label: 'Schema Markup',    icon: <Code2 className="h-4 w-4" /> },
}

function BreakdownCard({ categoryKey, data }: { categoryKey: string; data: ScoreCategory }) {
  const meta = CATEGORY_META[categoryKey] ?? { label: categoryKey, icon: <Info className="h-4 w-4" /> }
  const isScored = typeof data.score === 'number' && typeof data.max === 'number' && data.max > 0
  const pct = isScored ? Math.round((data.score! / data.max!) * 100) : null

  const barColor =
    data.status === 'good' ? 'bg-success' :
    data.status === 'critical' ? 'bg-danger' :
    data.status === 'warning' ? 'bg-warning' :
    'bg-secondary'

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
          {meta.icon}
          <span className="text-[12px] font-medium uppercase tracking-wide">{meta.label}</span>
        </div>
        <StatusIcon status={data.status} />
      </div>

      {isScored && (
        <>
          <div className="flex items-end gap-1.5">
            <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">{data.score}</span>
            <span className="text-[13px] text-text-secondary dark:text-text-secondary-dark mb-0.5">/ {data.max} pts</span>
          </div>
          <div className="h-1.5 bg-surface dark:bg-surface-dark rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </>
      )}

      {/* Headings — counts + hierarchy */}
      {!isScored && categoryKey === 'headings' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            {([
              { level: 'H1', count: data.h1_count ?? 0, warn: (data.h1_count ?? 0) > 1 },
              { level: 'H2', count: data.h2_count ?? 0, warn: false },
              { level: 'H3', count: data.h3_count ?? 0, warn: false },
              { level: 'H4', count: data.h4_count ?? 0, warn: false },
            ] as const).map(({ level, count, warn }) => (
              <div key={level} className={cn(
                'flex flex-col items-center px-2.5 py-1.5 rounded-md min-w-[36px]',
                warn ? 'bg-warning/10 border border-warning/30' : 'bg-surface dark:bg-surface-dark'
              )}>
                <span className={cn(
                  'text-[15px] font-bold',
                  warn ? 'text-warning' : 'text-text-primary dark:text-text-primary-dark'
                )}>{count}</span>
                <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark font-medium">{level}</span>
              </div>
            ))}
          </div>
          {(data.hierarchy_issues?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {data.hierarchy_issues!.map((issue, i) => (
                <p key={i} className="text-[11px] text-warning flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />{issue}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {data.detail && (
        <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark leading-relaxed">{data.detail}</p>
      )}

      {/* Extra stats for specific categories */}
      {categoryKey === 'word_count' && typeof data.reading_time_minutes === 'number' && (
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark">
          <Clock className="h-3 w-3" />
          {data.reading_time_minutes} min read
        </div>
      )}
      {categoryKey === 'links' && typeof data.internal_count === 'number' && (
        <div className="flex gap-3 text-[11px] text-text-secondary dark:text-text-secondary-dark">
          <span>{data.internal_count} internal</span>
          <span>·</span>
          <span>{data.external_count} external</span>
        </div>
      )}
      {categoryKey === 'images' && (
        <div className="flex gap-3 text-[11px] text-text-secondary dark:text-text-secondary-dark">
          {data.has_featured && <span>✓ Featured</span>}
          {(data.inline_count ?? 0) > 0 && <span>{data.inline_count} inline</span>}
          {data.has_og_image && <span>✓ OG image</span>}
        </div>
      )}
      {categoryKey === 'meta_description' && (
        <div className="space-y-2">
          {/* SERP snippet preview */}
          <div className="rounded-lg border border-border dark:border-border-dark bg-surface/50 dark:bg-surface-dark/50 px-3 py-2.5 space-y-0.5">
            <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide font-medium mb-1.5">
              Search preview
            </p>
            {/* Meta title */}
            <p className={cn(
              'text-[13px] font-medium leading-snug truncate',
              data.meta_title ? 'text-[#1a0dab] dark:text-[#8ab4f8]' : 'text-text-secondary dark:text-text-secondary-dark italic'
            )}>
              {data.meta_title ?? 'No SEO title set'}
            </p>
            {/* Meta description */}
            {data.meta_description ? (
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark leading-relaxed line-clamp-2">
                {data.meta_description}
              </p>
            ) : (
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark italic">
                No meta description set
              </p>
            )}
          </div>
          {/* Char counts */}
          <div className="flex gap-4 text-[10px] text-text-secondary dark:text-text-secondary-dark">
            {data.meta_title && (
              <span>
                Title: <span className={cn(
                  'font-medium',
                  data.meta_title.length <= 60 ? 'text-success' : 'text-warning'
                )}>{data.meta_title.length} chars</span>
              </span>
            )}
            {data.meta_description && (
              <span>
                Desc: <span className={cn(
                  'font-medium',
                  data.meta_description.length >= 120 && data.meta_description.length <= 160 ? 'text-success' : 'text-warning'
                )}>{data.meta_description.length} chars</span>
              </span>
            )}
            {data.source && data.source !== 'none' && (
              <span className="ml-auto">via {data.source === 'yoast' ? 'Yoast SEO' : 'excerpt'}</span>
            )}
          </div>
        </div>
      )}
      {categoryKey === 'publish_history' && data.pub_age_days != null && (
        <div className="text-[11px] text-text-secondary dark:text-text-secondary-dark space-y-0.5">
          {data.published_str && (() => {
            const d = new Date(data.published_str)
            return !isNaN(d.getTime()) ? <p>Published: {d.toLocaleDateString()}</p> : null
          })()}
          {data.modified_str && (() => {
            const d = new Date(data.modified_str)
            return !isNaN(d.getTime()) ? <p>Modified: {d.toLocaleDateString()}</p> : null
          })()}
          {data.never_updated && (
            <p className="text-warning font-medium">⚠ Never refreshed</p>
          )}
        </div>
      )}
      {categoryKey === 'schema_markup' && (
        <div className="space-y-2">
          {/* Scan scope badge + tooltip with per-source breakdown */}
          <div className="flex items-center gap-1.5">
            {data.full_page_scanned ? (
              <Tooltip
                side="bottom"
                className="whitespace-normal w-64 p-0"
                content={
                  <div className="p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-text-primary dark:text-text-primary-dark">Schema sources</p>
                    {(['body', 'yoast', 'full_page'] as const).map((src) => {
                      const types = data.sources?.[src]
                      if (!types?.length) return null
                      const label = src === 'full_page' ? 'Full page' : src === 'yoast' ? 'Yoast head' : 'Post body'
                      return (
                        <div key={src}>
                          <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark mb-1">{label}</p>
                          <div className="flex flex-wrap gap-1">
                            {types.map((t) => (
                              <code key={t} className="text-[9px] px-1 py-0.5 rounded bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark">{t}</code>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                }
              >
                <span className="inline-flex items-center gap-1 text-[10px] bg-primary/8 text-primary px-1.5 py-0.5 rounded cursor-default">
                  <CheckCircle className="h-2.5 w-2.5" /> Full page scanned
                  <Info className="h-2.5 w-2.5 opacity-60" />
                </span>
              </Tooltip>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark px-1.5 py-0.5 rounded">
                Content body only
              </span>
            )}
          </div>
          {/* All detected schema types */}
          {(data.all_types?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-1">
              {data.all_types!.map((t) => (
                <code key={t} className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  t === 'FAQPage' ? 'bg-success/10 text-success' :
                  t === 'Article' || t === 'BlogPosting' ? 'bg-primary/8 text-primary' :
                  'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark'
                )}>{t}</code>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">No structured data detected</p>
          )}
          {/* FAQ recommendation */}
          {data.faq_recommendation === 'missing' && (
            <div className="flex items-start gap-1.5 bg-warning/8 border border-warning/20 rounded-md px-2.5 py-2">
              <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning leading-snug">
                FAQ content detected — add <strong>FAQPage</strong> schema to unlock rich results in Google
              </p>
            </div>
          )}
          {data.faq_recommendation === 'present' && (
            <div className="flex items-center gap-1.5 text-[11px] text-success">
              <CheckCircle className="h-3 w-3" />
              FAQPage schema active — eligible for FAQ rich results
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── AI recommendations card ───────────────────────────────────────────────────

function AICard({ postId, recommendation, isClean, isPersonalized }: {
  postId: string; recommendation: string | null; isClean: boolean; isPersonalized?: boolean
}) {
  const regen = useRegenerateAI(postId)
  const lines = recommendation ? recommendation.split('\n').filter(Boolean) : []

  return (
    <Card className="p-5">
      <CardHeader className="mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>AI Recommendations</CardTitle>
          {isPersonalized && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              Personalised
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={regen.isPending}
          onClick={() => regen.mutate()}
          className="flex items-center gap-1.5 text-[12px]"
        >
          <RefreshCw className="h-3 w-3" />
          Re-generate
        </Button>
      </CardHeader>
      <CardContent>
        {regen.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-11/12" />
          </div>
        ) : lines.length > 0 ? (
          <ol className="space-y-3">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed">{line}</p>
              </li>
            ))}
          </ol>
        ) : isClean ? (
          <p className="text-[13px] text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            This post is in great shape — no recommendations needed.
          </p>
        ) : (
          <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark">
            No AI recommendations yet. Click Re-generate to analyze this post.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Issues list ───────────────────────────────────────────────────────────────

function IssueItem({ issue }: { issue: string }) {
  const isError =
    issue.toLowerCase().includes('no ') ||
    issue.toLowerCase().includes('too short') ||
    issue.toLowerCase().includes('stale') ||
    issue.toLowerCase().includes('missing')
  return (
    <li className="flex items-start gap-2.5 py-2.5 border-b border-border dark:border-border-dark last:border-0">
      {isError
        ? <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
        : <Info className="h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark flex-shrink-0 mt-0.5" />
      }
      <span className="text-[13px] text-text-primary dark:text-text-primary-dark">{issue}</span>
    </li>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SCORED_BREAKDOWN = ['word_count', 'images', 'links', 'freshness', 'title', 'headings']
const INFO_BREAKDOWN = ['meta_description', 'publish_history', 'schema_markup']

export default function ContentPostDetail() {
  // The route param is the WP slug (clean URLs) — UUIDs still resolve too
  const { postId = '' } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedSiteId } = useSiteContext()

  const { data: post, isLoading } = useContentPostDetail(postId, selectedSiteId)
  // Mutations always target the real UUID once the post has resolved
  const rescan = useRescanPost(post?.id ?? postId)
  const { data: siteCtx } = useQuery({
    queryKey: ['site-context', post?.site_id],
    queryFn: () => get<{ context: Record<string, unknown>; analyzed_at: string | null }>(`/sites/${post!.site_id}/context`),
    enabled: Boolean(post?.site_id),
    staleTime: 5 * 60_000,
  })
  const isPersonalized = Boolean(siteCtx?.context?.summary)

  // Prefer the exact listing URL (tab, sort, search, page) the user came
  // from — falls back to a plain content-tab link for direct/bookmarked visits.
  const backUrl = (location.state as { from?: string } | null)?.from ?? '/optimizer?tab=content'

  if (isLoading) {
    return (
      <PageShell title="Content Analysis" subtitle="Loading post details…">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        </div>
      </PageShell>
    )
  }

  if (!post) {
    return (
      <PageShell title="Content Analysis" subtitle="">
        <p className="text-text-secondary dark:text-text-secondary-dark">Post not found.</p>
      </PageShell>
    )
  }

  const postGone = rescan.isError && isPostGoneError(rescan.error)

  return (
    <PageShell title="Content Analysis" subtitle={post.site_name}>
      {/* Back + header */}
      <div className="flex items-start gap-4 -mt-2 mb-6">
        <button
          onClick={() => navigate(backUrl)}
          className="flex items-center gap-1.5 text-[12px] text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors mt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Content Health
        </button>
      </div>

      {postGone && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 mb-5 text-[13px] text-text-primary dark:text-text-primary-dark">
          <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
          {rescanErrorDetail(rescan.error, 'This page no longer exists on WordPress and has been removed from tracking.')}
        </div>
      )}

      {/* Post header card */}
      <Card className="p-5 mb-5">
        <div className="flex items-start gap-4">
          <ScoreCircle score={post.health_score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-[11px]">{post.site_name}</Badge>
              {post.health_score >= 70 ? (
                <Badge variant="success">Healthy</Badge>
              ) : post.health_score >= 40 ? (
                <Badge variant="warning">Needs work</Badge>
              ) : (
                <Badge variant="critical">Poor</Badge>
              )}
            </div>
            <h1 className="text-[16px] font-semibold text-text-primary dark:text-text-primary-dark leading-snug mb-2">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-[11px] text-text-secondary dark:text-text-secondary-dark flex-wrap">
              {post.word_count > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {formatNumber(post.word_count)} words
                </span>
              )}
              {post.reading_time_minutes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.reading_time_minutes} min read
                </span>
              )}
              {post.traffic_30d > 0 && (
                <span>{formatNumber(post.traffic_30d)} views / 30d</span>
              )}
              {post.last_analyzed_at && (
                <span>Analyzed {timeAgo(post.last_analyzed_at)}</span>
              )}
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View post
              </a>
            </div>
          </div>
          <Button
            variant={rescan.isError && !postGone ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => rescan.mutate()}
            disabled={rescan.isPending || postGone}
            title={
              postGone ? 'This page no longer exists on WordPress'
              : rescan.isError ? 'Rescan failed — click to retry'
              : undefined
            }
            className="flex-shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-3 w-3', rescan.isPending && 'animate-spin')} />
            {rescan.isPending ? 'Scanning…' : postGone ? 'Removed' : rescan.isError ? 'Retry rescan' : 'Rescan'}
          </Button>
        </div>
      </Card>

      {/* Analytics overview */}
      <AnalyticsOverviewCard postRef={postId} siteId={post.site_id} />

      {/* Scored breakdown grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {SCORED_BREAKDOWN.map((key) => {
          const data = post.score_breakdown?.[key]
          if (!data) return null
          return <BreakdownCard key={key} categoryKey={key} data={data} />
        })}
      </div>

      {/* Informational sections — meta description, publish history, schema */}
      {INFO_BREAKDOWN.some((k) => post.score_breakdown?.[k]) && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {INFO_BREAKDOWN.map((key) => {
            const data = post.score_breakdown?.[key]
            if (!data) return null
            return <BreakdownCard key={key} categoryKey={key} data={data} />
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Issues */}
        <Card className="p-5">
          <CardHeader className="mb-0">
            <CardTitle>Issues Found</CardTitle>
            {post.issues.length > 0 && (
              <Badge variant="warning">{post.issues.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {post.issues.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="text-[13px]">No issues found — great job!</span>
              </div>
            ) : (
              <ul className="mt-3">
                {post.issues.map((issue, i) => (
                  <IssueItem key={i} issue={issue} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* AI recommendations */}
        <AICard postId={post.id} recommendation={post.ai_recommendation}
          isClean={post.issues.length === 0} isPersonalized={isPersonalized} />
      </div>
    </PageShell>
  )
}
