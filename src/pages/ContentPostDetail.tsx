import { Fragment, useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, RefreshCw, AlertTriangle, CheckCircle, Info, XCircle, Sparkles, Clock, FileText, Image, Link2, Calendar, Heading, AlignLeft, History, Code2, TrendingUp, MousePointerClick, Timer, Route, Users, Gauge, Search, ChevronDown, ArrowRight, Copy } from 'lucide-react'
import { motion } from 'framer-motion'
import PageShell from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import TrendIndicator from '@/components/ui/TrendIndicator'
import AreaChart from '@/components/charts/AreaChart'
import HealthRing from '@/components/charts/HealthRing'
import { cn, formatNumber, timeAgo, formatPercent } from '@/lib/utils'
import {
  useContentPostDetail, useContentPostAnalytics, useRegenerateAI, useRescanPost,
  isPostGoneError, rescanErrorDetail, usePageSpeed, useRunPageSpeed, useSearchConsole, usePageInsights,
  type ScoreCategory, type ConversionFlow, type PageSpeedMetric, type VitalRating, type DeviceShare, type SearchQueryRow, type PageInsight, type PageInsightsResponse, type PageGuidance, type GuidanceRewrite,
  type InsightSeverity, type InsightSource, type ContentPostDetail as ContentPostDetailData,
} from '@/hooks/useOptimizer'
import { useSiteContext } from '@/contexts/SiteContext'
import { useTheme } from '@/hooks/useTheme'
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
  isConversion: boolean // reached the confirmation page — a real submission
}

/** Funnel stages are ORDINAL (their order carries meaning), so they take a
 * one-hue ramp that darkens toward the top of the funnel rather than
 * arbitrary per-stage colors. Both ramps are validated: monotone lightness,
 * adjacent ΔL ≥ 0.06, light end ≥ 2:1 on its own surface. Light mode ends at
 * #809EFC (2.56:1) — legal for an ordinal ramp precisely because every bar
 * also carries a visible value label. The conversion stage leaves the ramp
 * for the reserved success token, since it *means* a good outcome, and ships
 * with an icon + label so it never relies on color alone. */
const FUNNEL_RAMP_LIGHT = ['#0129AC', '#4A73E8', '#809EFC']
const FUNNEL_RAMP_DARK = ['#B9C9FF', '#809EFC', '#4A73E8']

function stageColor(index: number, isConversion: boolean, isDark: boolean): string {
  if (isConversion) return '#059669'
  const ramp = isDark ? FUNNEL_RAMP_DARK : FUNNEL_RAMP_LIGHT
  return ramp[Math.min(index, ramp.length - 1)]
}

function ConversionRoute({ flow, isDark }: { flow: ConversionFlow; isDark: boolean }) {
  const stages: FunnelStage[] = [
    { label: 'Read this post', count: flow.entered, pctOfEntered: 100, isConversion: false },
    { label: `Reached ${flow.label}`, count: flow.reached, pctOfEntered: flow.reach_rate * 100, isConversion: false },
    ...(flow.submitted != null
      ? [{ label: 'Submitted form', count: flow.submitted, pctOfEntered: (flow.submission_rate ?? 0) * 100, isConversion: true }]
      : []),
  ]
  const maxCount = flow.entered || 1

  return (
    <div className="rounded-lg border border-border dark:border-border-dark p-3.5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">
          via {flow.label}
        </span>
        <a
          href={flow.target_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark truncate max-w-[150px]"
          title={flow.target_title}
        >
          {flow.target_title}
        </a>
      </div>
      <div className="flex flex-col gap-2">
        {stages.map((stage, i) => {
          const widthPct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 2 : 0) : 0
          return (
            <div key={stage.label}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="flex items-center gap-1 text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">
                  {stage.isConversion && <CheckCircle className="h-3 w-3 text-success flex-shrink-0" />}
                  {stage.label}
                </span>
                {/* Text wears ink, never the mark's colour — the bar carries identity. */}
                <span className="text-[11px] font-semibold text-text-primary dark:text-text-primary-dark tabular-nums flex-shrink-0">
                  {formatNumber(stage.count)}
                  <span className="text-text-secondary dark:text-text-secondary-dark font-normal ml-1">
                    {formatPercent(stage.pctOfEntered, 0)}
                  </span>
                </span>
              </div>
              {/* Track is a lighter step of the same ramp; bar is square at the
                  baseline with a 4px rounded data-end. */}
              <div className="h-2 rounded-[2px] bg-surface dark:bg-surface-dark overflow-hidden">
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-500"
                  style={{ width: `${widthPct}%`, backgroundColor: stageColor(i, stage.isConversion, isDark) }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Stat tile contract: label · value · optional delta · optional hint. Values
 * use proportional figures (tabular-nums makes a large standalone number look
 * loose) and always ink, never a data colour. */
function StatTile({
  label, value, icon, delta, hint, status,
}: {
  label: string
  value: string
  icon: React.ReactNode
  delta?: number | null
  hint?: string
  status?: 'good' | 'warning' | 'critical'
}) {
  return (
    <div className="rounded-lg border border-border dark:border-border-dark p-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold text-text-primary dark:text-text-primary-dark leading-none">
          {value}
        </span>
        {delta != null && <TrendIndicator value={delta} />}
      </div>
      <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mt-1.5 min-h-[14px]">
        {status && (
          <span className={cn(
            'inline-flex items-center gap-1 font-medium',
            status === 'critical' ? 'text-danger' : status === 'warning' ? 'text-warning' : 'text-success'
          )}>
            {status === 'good' ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {status === 'critical' ? 'High' : status === 'warning' ? 'Elevated' : 'Healthy'}
          </span>
        )}
        {status && hint && <span className="mx-1">·</span>}
        {hint}
      </p>
    </div>
  )
}

/** Device categories are NOMINAL — swapping them changes nothing — so they
 * take distinct categorical hues rather than a ramp, assigned in a fixed
 * order so a colour never migrates between categories when the ranking
 * shifts. Both sets are validated (lightness band, chroma floor, adjacent
 * CVD separation, contrast); the dark set is chosen for the dark surface,
 * not flipped from the light one. Reserved status colours are deliberately
 * NOT reused here — a device is not a good/bad state. */
const DEVICE_COLORS_LIGHT: Record<string, string> = {
  desktop: '#2a78d6', mobile: '#eb6834', tablet: '#1baf7a', other: '#8B8D98',
}
const DEVICE_COLORS_DARK: Record<string, string> = {
  desktop: '#4A90E2', mobile: '#DE7433', tablet: '#1FAE79', other: '#8B8D98',
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', other: 'Other',
}

function DeviceSplit({ devices, isDark }: { devices: DeviceShare[]; isDark: boolean }) {
  if (devices.length === 0) return null
  const palette = isDark ? DEVICE_COLORS_DARK : DEVICE_COLORS_LIGHT

  return (
    <div>
      <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">
        Reader devices
      </p>
      {/* Part-to-whole: one bar, 2px surface gaps doing the separating —
          never a border drawn around each segment. */}
      <div className="flex gap-[2px] h-2.5 mb-2.5">
        {devices.map((d, i) => (
          <div
            key={d.device}
            style={{ flexGrow: d.pct, backgroundColor: palette[d.device] ?? palette.other }}
            className={cn(
              'h-full min-w-[3px]',
              i === 0 && 'rounded-l-[4px]',
              i === devices.length - 1 && 'rounded-r-[4px]',
            )}
            title={`${DEVICE_LABELS[d.device] ?? d.device}: ${d.pct}%`}
          />
        ))}
      </div>
      {/* Legend is always present for 2+ series and carries the value, so
          identity never depends on colour alone. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {devices.map((d) => (
          <span key={d.device} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2 w-2 rounded-[2px] flex-shrink-0"
              style={{ backgroundColor: palette[d.device] ?? palette.other }}
            />
            <span className="text-text-secondary dark:text-text-secondary-dark">
              {DEVICE_LABELS[d.device] ?? d.device}
            </span>
            {/* One decimal, not zero: rounding 61.5/38.5 to integers renders
                a visible "62% + 39% = 101%". */}
            <span className="font-semibold text-text-primary dark:text-text-primary-dark tabular-nums">
              {formatPercent(d.pct, 1)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Overview summary ──────────────────────────────────────────────────────────

/** One headline number per data source, each a link into the tab that
 * explains it.
 *
 * This is what makes tabbing safe: splitting a long page into tabs otherwise
 * hides information from anyone who doesn't think to go looking. Every tab is
 * represented here, so the first screen still answers "how is this post
 * doing?" and points at where the detail lives.
 *
 * All three hooks are already cached by their own tabs' cards, so this
 * summary costs no extra requests once anything has loaded.
 */
function SummaryStrip({
  summary, isLoading, onJump,
}: {
  summary: PageInsightsResponse['summary'] | undefined
  isLoading: boolean
  onJump: (tab: string) => void
}) {
  const num = (v: number | null | undefined) =>
    isLoading ? null : v != null ? formatNumber(v) : '—'

  const items = [
    { tab: 'traffic', label: 'Visitors', value: num(summary?.visitors), hint: 'Last 30 days' },
    { tab: 'traffic', label: 'Leads', value: num(summary?.leads), hint: 'Reached confirmation' },
    {
      tab: 'search',
      label: 'Search clicks',
      value: num(summary?.search_clicks),
      hint: summary?.search_position ? `Avg. position ${summary.search_position.toFixed(1)}` : 'From Google',
    },
    {
      tab: 'speed',
      label: 'PageSpeed',
      value: isLoading ? null : summary?.speed_score != null ? String(summary.speed_score) : '—',
      hint: summary?.speed_score != null ? `${summary.speed_strategy} · out of 100` : 'Not tested yet',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => onJump(it.tab)}
          className="text-left rounded-lg border border-border dark:border-border-dark p-3.5 hover:border-primary/40 dark:hover:border-primary-dark/40 hover:bg-surface/40 dark:hover:bg-surface-dark/40 transition-colors group"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10.5px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
              {it.label}
            </span>
            <ArrowRight className="h-3 w-3 text-text-secondary dark:text-text-secondary-dark opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {it.value === null ? (
            <Skeleton className="h-6 w-14" />
          ) : (
            <span className="text-[22px] font-semibold text-text-primary dark:text-text-primary-dark leading-none">
              {it.value}
            </span>
          )}
          <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mt-1.5">{it.hint}</p>
        </button>
      ))}
    </div>
  )
}

const INSIGHT_TONE: Record<InsightSeverity, { border: string; bg: string; icon: string; Icon: typeof AlertTriangle }> = {
  critical: { border: 'border-danger/30', bg: 'bg-danger/[0.04] hover:bg-danger/[0.07]', icon: 'text-danger', Icon: AlertTriangle },
  warning: { border: 'border-warning/30', bg: 'bg-warning/[0.05] hover:bg-warning/[0.09]', icon: 'text-warning', Icon: AlertTriangle },
  info: { border: 'border-border dark:border-border-dark', bg: 'hover:bg-surface/50 dark:hover:bg-surface-dark/50', icon: 'text-text-secondary dark:text-text-secondary-dark', Icon: Info },
}

const SOURCE_TAB: Record<InsightSource, string> = {
  content: 'content', traffic: 'traffic', search: 'search', speed: 'speed',
}

/** Every finding, ranked, computed by rule — no AI, so it's here the instant
 * the page loads and costs nothing. Each row links to the tab holding the
 * evidence behind it. */
function InsightsList({
  insights, onJump,
}: { insights: PageInsight[]; onJump: (tab: string) => void }) {
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/[0.04] px-4 py-3">
        <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
        <span className="text-[12.5px] text-text-primary dark:text-text-primary-dark">
          Nothing flagged — content, traffic, search and speed all look healthy for this post.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {insights.map((insight, i) => {
        const tone = INSIGHT_TONE[insight.severity]
        return (
          <motion.button
            key={insight.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04, ease: 'easeOut' }}
            onClick={() => onJump(SOURCE_TAB[insight.source])}
            className={cn('text-left rounded-lg border p-3.5 transition-colors group', tone.border, tone.bg)}
          >
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary dark:text-text-primary-dark mb-1">
              <tone.Icon className={cn('h-4 w-4 flex-shrink-0', tone.icon)} />
              {insight.title}
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[10.5px] font-medium uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark">
                  {insight.source}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </p>
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark leading-relaxed">
              {insight.detail}
            </p>
            <p className="text-[11.5px] text-text-primary dark:text-text-primary-dark mt-1.5 font-medium">
              → {insight.action}
            </p>
          </motion.button>
        )
      })}
    </div>
  )
}

/** Rotating status lines while the model works. A 10-20s wait behind a bare
 * spinner reads as a hang; naming the step makes the delay legible. */
const AI_STEPS = [
  'Reading your content analysis…',
  'Checking search performance…',
  'Reviewing traffic and speed…',
  'Writing recommendations…',
]

function AIThinking() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % AI_STEPS.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="py-2">
      <div className="flex items-center gap-2.5 mb-4">
        <Sparkles className="h-4 w-4 text-primary dark:text-primary-dark animate-ai-pulse" />
        <motion.span
          key={step}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-[12.5px] text-text-secondary dark:text-text-secondary-dark"
        >
          {AI_STEPS[step]}
        </motion.span>
      </div>
      {/* Shimmering placeholder lines, staggered so the block reads as
          "filling in" rather than three identical bars pulsing in lockstep. */}
      <div className="space-y-2.5">
        {[100, 88, 94].map((w, i) => (
          <div
            key={w}
            className="h-3.5 rounded bg-[linear-gradient(90deg,transparent,rgba(128,158,252,0.22),transparent)] bg-[length:200%_100%] animate-shimmer"
            style={{ width: `${w}%`, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  )
}

/** A rewrite the user is meant to paste straight into WordPress, so it gets
 * a copy button and its character count — the two things that decide whether
 * a title or meta description is actually usable. */
function RewriteBlock({
  label, rewrite, min, max,
}: { label: string; rewrite: GuidanceRewrite; min: number; max: number }) {
  const [copied, setCopied] = useState(false)
  // Derived from the string rather than read off the payload: guidance is
  // persisted, so a row written before these fields existed would otherwise
  // render "undefined chars". The text is the source of truth either way.
  const length = rewrite.proposed.length
  const inRange = length >= min && length <= max

  const copy = () => {
    navigator.clipboard.writeText(rewrite.proposed).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => { /* clipboard blocked — the text is selectable anyway */ })
  }

  return (
    <div className="rounded-lg border border-border dark:border-border-dark p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10.5px] tabular-nums',
            inRange ? 'text-success' : 'text-warning',
          )}>
            {length} chars{inRange ? '' : ` · aim for ${min}–${max}`}
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-[11px] font-medium text-primary dark:text-primary-dark hover:opacity-80"
          >
            {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed select-all">
        {rewrite.proposed}
      </p>
      {rewrite.reason && (
        <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-1.5">{rewrite.reason}</p>
      )}
    </div>
  )
}

function GuidanceBody({ guidance }: { guidance: PageGuidance }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col gap-4"
    >
      {guidance.diagnosis && (
        <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed">
          {guidance.diagnosis}
        </p>
      )}

      {(guidance.title || guidance.meta_description) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {guidance.title && <RewriteBlock label="Proposed title" rewrite={guidance.title} min={30} max={60} />}
          {guidance.meta_description && (
            <RewriteBlock label="Proposed meta description" rewrite={guidance.meta_description} min={120} max={160} />
          )}
        </div>
      )}

      {(guidance.fixes?.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2.5">
            How to fix each finding
          </p>
          <div className="flex flex-col gap-2">
            {guidance.fixes!.map((fix, i) => (
              <motion.div
                key={fix.problem + i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.08 + i * 0.06, ease: 'easeOut' }}
                className="flex gap-2.5 rounded-lg border border-border dark:border-border-dark p-3"
              >
                <CheckCircle className="h-3.5 w-3.5 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
                <div>
                  {fix.problem && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">
                      {fix.problem}
                    </p>
                  )}
                  <p className="text-[12.5px] text-text-primary dark:text-text-primary-dark leading-relaxed">
                    {fix.fix}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {guidance.content_gaps.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2.5">
            Content gaps — searched for, not covered
          </p>
          <div className="flex flex-col gap-2.5">
            {guidance.content_gaps.map((gap, i) => (
              <motion.div
                key={gap.topic}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                className="rounded-lg border border-border dark:border-border-dark p-3.5"
              >
                <p className="text-[12.5px] font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                  {gap.topic}
                </p>
                {gap.evidence && (
                  <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-1.5">
                    Evidence: {gap.evidence}
                  </p>
                )}
                {gap.add && (
                  <p className="text-[12px] text-text-primary dark:text-text-primary-dark leading-relaxed">
                    → {gap.add}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

/** AI synthesis — explicitly requested, never automatic. The rule-based
 * insights above already say WHAT is wrong; this reads the page's real text
 * against its real search queries and returns the specific artifacts rules
 * can't produce: a title to paste, a meta description to paste, and gaps
 * between what searchers ask and what the page actually says. */
function AIPanel({
  postId, recommendation, initialGuidance,
}: { postId: string; recommendation: string | null; initialGuidance: PageGuidance | null }) {
  const regen = useRegenerateAI(postId)
  const guidance = regen.data?.ai_guidance ?? initialGuidance
  const text = regen.data?.ai_recommendation ?? recommendation
  const lines = text ? text.split('\n').filter(Boolean) : []
  const busy = regen.isPending

  return (
    <Card className={cn('p-5 relative overflow-hidden', busy && 'border-primary/30 dark:border-primary-dark/30')}>
      {/* Sweeping top edge while generating — the only motion on the card, so
          it reads as "this is working" without competing with the content. */}
      {busy && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,#0129AC,#809EFC,transparent)] dark:bg-[linear-gradient(90deg,transparent,#809EFC,#B9C9FF,transparent)] bg-[length:200%_100%] animate-ai-sweep" />
      )}
      <CardHeader className="mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className={cn('h-4 w-4 text-primary dark:text-primary-dark', busy && 'animate-ai-pulse')} />
          <CardTitle>AI Recommendations</CardTitle>
        </div>
        <Button
          variant={lines.length > 0 ? 'ghost' : 'primary'}
          size="sm"
          loading={busy}
          onClick={() => regen.mutate()}
          className="flex items-center gap-1.5 text-[12px]"
        >
          {lines.length > 0 ? <RefreshCw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {busy ? 'Generating…' : lines.length > 0 ? 'Re-generate' : 'Generate'}
        </Button>
      </CardHeader>
      <CardContent>
        {busy ? (
          <AIThinking />
        ) : regen.isError ? (
          <p className="text-[13px] text-danger">Couldn&apos;t generate recommendations. Try again in a moment.</p>
        ) : guidance ? (
          <GuidanceBody guidance={guidance} />
        ) : lines.length > 0 ? (
          <ol className="space-y-3">
            {lines.map((line, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.12, ease: 'easeOut' }}
                className="flex gap-3"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 dark:bg-primary-dark/15 text-primary dark:text-primary-dark text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed">{line}</p>
              </motion.li>
            ))}
          </ol>
        ) : (
          <div className="py-2">
            <p className="text-[13px] text-text-primary dark:text-text-primary-dark mb-1">
              Read this page against its real search queries.
            </p>
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
              Returns a paste-ready title and meta description, plus the topics people search
              for that this page doesn&apos;t yet cover. Runs only when you ask — no AI cost otherwise.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OverviewTab({
  post, postRef, onJump,
}: { post: ContentPostDetailData; postRef: string; onJump: (tab: string) => void }) {
  const { data, isLoading } = usePageInsights(postRef, post.site_id)

  return (
    <div className="flex flex-col gap-5">
      <SummaryStrip summary={data?.summary} isLoading={isLoading} onJump={onJump} />

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
            What to fix
          </p>
          {data && (
            <span className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
              {data.insights.length} finding{data.insights.length === 1 ? '' : 's'} across {data.sources.length} source{data.sources.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : (
          <InsightsList insights={data?.insights ?? []} onJump={onJump} />
        )}
      </div>

      <AIPanel
        postId={post.id}
        recommendation={post.ai_recommendation}
        initialGuidance={post.ai_guidance}
      />
    </div>
  )
}

// ── Search Console ────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Position badge — page 1 (≤10) is where clicks live, so it's the line
 * worth colouring around. Icon-free by design: this sits in a dense table
 * where the number itself is the label. */
function positionTone(position: number): string {
  if (position <= 3) return 'bg-success/10 text-success'
  if (position <= 10) return 'bg-warning/10 text-warning'
  return 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark'
}

function QueryTable({
  rows, separatorAt, separatorLabel,
}: {
  rows: SearchQueryRow[]
  /** Row index to insert an inline group divider before. Lets the expanded
   * list stay ONE table with one header — appending a second table with its
   * own header read as a gap and a restart rather than a continuation. */
  separatorAt?: number
  separatorLabel?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark">
            <th className="font-medium pb-1.5">Query</th>
            <th className="font-medium pb-1.5 text-right w-20">Impr.</th>
            <th className="font-medium pb-1.5 text-right w-16">Clicks</th>
            <th className="font-medium pb-1.5 text-right w-16">CTR</th>
            <th className="font-medium pb-1.5 text-right w-16">Pos.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {rows.map((q, i) => (
            <Fragment key={q.query}>
              {separatorAt === i && separatorLabel && (
                <tr>
                  <td colSpan={5} className="pt-3 pb-1.5">
                    <span className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark">
                      {separatorLabel}
                    </span>
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-1.5 pr-3 text-text-primary dark:text-text-primary-dark">
                  <span className="line-clamp-1" title={q.query}>{q.query}</span>
                </td>
                {/* tabular-nums: these are columns that must align vertically. */}
                <td className="py-1.5 text-right tabular-nums text-text-primary dark:text-text-primary-dark">
                  {formatNumber(q.impressions)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-text-primary dark:text-text-primary-dark">
                  {formatNumber(q.clicks)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-text-secondary dark:text-text-secondary-dark">
                  {q.ctr.toFixed(1)}%
                </td>
                <td className="py-1.5 text-right">
                  <span className={cn('inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums', positionTone(q.position))}>
                    {q.position.toFixed(1)}
                  </span>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SearchConsoleCard({ postRef, siteId }: { postRef: string; siteId: string | null }) {
  const { data, isLoading, isError } = useSearchConsole(postRef, siteId)
  const opp = data?.ctr_opportunity
  // `queries` is the top 15 by impressions and `striking_distance` is a
  // filtered subset of the same ranking — so rendering both in full repeated
  // every striking row before continuing. The disclosure below EXTENDS the
  // table with what hasn't been shown yet instead of restating it.
  const shownQueries = new Set((data?.striking_distance ?? []).map((q) => q.query))
  const remainingQueries = (data?.queries ?? []).filter((q) => !shownQueries.has(q.query))
  const [showAllQueries, setShowAllQueries] = useState(false)
  const hasStriking = (data?.striking_distance.length ?? 0) > 0
  const visibleQueries = showAllQueries
    ? [...(data?.striking_distance ?? []), ...remainingQueries]
    : (hasStriking ? data!.striking_distance : remainingQueries)

  return (
    <Card className="p-5 mb-5">
      <CardHeader className="mb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <CardTitle>Search Console</CardTitle>
        </div>
        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
          {data?.range_start && data.range_end
            ? `Google organic · ${formatShortDate(data.range_start)} – ${formatShortDate(data.range_end)}`
            : 'Google organic search'}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        ) : isError || !data ? (
          <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark py-4">
            Couldn&apos;t load Search Console data right now.
          </p>
        ) : !data.connected ? (
          <EmptyState
            title="Connect Search Console"
            description="Connect Google Search Console in Settings to see the queries this page ranks for, and where it's losing clicks."
          />
        ) : data.error ? (
          <p className="text-[13px] text-danger py-4">{data.error}</p>
        ) : data.impressions === 0 ? (
          <EmptyState
            title="No search impressions yet"
            description="Google hasn't shown this page in search results during this period."
          />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Clicks"
                icon={<MousePointerClick className="h-3.5 w-3.5" />}
                value={formatNumber(data.clicks)}
                delta={data.clicks_change_pct}
                hint="From Google search"
              />
              <StatTile
                label="Impressions"
                icon={<Search className="h-3.5 w-3.5" />}
                value={formatNumber(data.impressions)}
                delta={data.impressions_change_pct}
                hint="Times shown in results"
              />
              <StatTile
                label="CTR"
                icon={<Route className="h-3.5 w-3.5" />}
                value={`${data.ctr.toFixed(2)}%`}
                hint="Clicks ÷ impressions"
              />
              <div className="rounded-lg border border-border dark:border-border-dark p-3.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Avg. position
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-semibold text-text-primary dark:text-text-primary-dark leading-none">
                    {data.position.toFixed(1)}
                  </span>
                  {/* Position is the one metric where DOWN is better, and the
                      change is a raw rank difference, not a percentage — so
                      it gets its own readout rather than the % TrendIndicator. */}
                  {data.position_change != null && data.position_change !== 0 && (
                    <span className={cn(
                      'inline-flex items-center gap-0.5 text-[11px] font-medium',
                      data.position_change < 0 ? 'text-success' : 'text-danger',
                    )}>
                      {data.position_change < 0 ? '▲' : '▼'} {Math.abs(data.position_change).toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mt-1.5">
                  {data.position_change != null && data.position_change < 0
                    ? 'Moved up vs prior 28d'
                    : data.position_change != null && data.position_change > 0
                    ? 'Slipped vs prior 28d'
                    : 'Lower is better'}
                </p>
              </div>
            </div>

            {/* The single most actionable thing GSC can say about a page. */}
            {opp && (
              <div className="rounded-lg border border-warning/30 bg-warning/[0.05] p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary dark:text-text-primary-dark mb-1.5">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Ranking well, rarely clicked
                </p>
                <p className="text-[12px] text-text-primary dark:text-text-primary-dark leading-relaxed">
                  At position <strong>{opp.position.toFixed(1)}</strong> a result typically earns around{' '}
                  <strong>{opp.typical_ctr.toFixed(1)}%</strong> CTR — this page gets{' '}
                  <strong>{opp.ctr.toFixed(2)}%</strong>. At a typical rate its current impressions
                  would be worth roughly <strong>{formatNumber(opp.potential_clicks)} clicks</strong>{' '}
                  instead of {formatNumber(data.clicks)}.
                </p>
                <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-2">
                  It already ranks — so this is a title and meta-description problem, not a ranking one.
                  Typical CTR is a rough benchmark, not a target.
                </p>
              </div>
            )}

            {/* Two measures of very different scale — shown as small multiples
                on their own axes. Never one chart with two y-scales. */}
            {data.daily.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">
                    Impressions
                  </p>
                  <AreaChart
                    data={data.daily as unknown as Record<string, unknown>[]}
                    series={[{ key: 'impressions', label: 'Impressions' }]}
                    height={110}
                    formatter={(v) => formatNumber(v)}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">
                    Clicks
                  </p>
                  <AreaChart
                    data={data.daily as unknown as Record<string, unknown>[]}
                    series={[{ key: 'clicks', label: 'Clicks', color: '#059669' }]}
                    height={110}
                    integerYAxis
                    formatter={(v) => formatNumber(v)}
                  />
                </div>
              </div>
            )}

            {/* One table, one header. The striking-distance rows lead; the
                rest are appended in place when expanded, marked by an inline
                divider rather than a second table. */}
            {(data.striking_distance.length > 0 || remainingQueries.length > 0) && (
              <div className="pt-4 border-t border-border dark:border-border-dark">
                <div className="flex items-baseline justify-between gap-3 mb-2.5">
                  <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
                    {hasStriking ? 'Striking distance' : 'Search queries'}
                  </p>
                  <span className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
                    {hasStriking ? 'Positions 4–15 — closest to the clicks' : 'Ranked by impressions'}
                  </span>
                </div>
                <QueryTable
                  rows={visibleQueries}
                  separatorAt={showAllQueries && hasStriking ? data.striking_distance.length : undefined}
                  separatorLabel="Everything else this page ranks for"
                />
                {remainingQueries.length > 0 && (
                  <button
                    onClick={() => setShowAllQueries((v) => !v)}
                    className="mt-3 flex items-center gap-1 text-[12px] font-medium text-primary dark:text-primary-dark hover:opacity-80"
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAllQueries && 'rotate-180')} />
                    {showAllQueries
                      ? 'Show less'
                      : hasStriking
                      ? `${remainingQueries.length} more quer${remainingQueries.length === 1 ? 'y' : 'ies'}`
                      : `Show all ${remainingQueries.length} queries`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── PageSpeed ─────────────────────────────────────────────────────────────────

/** Status tokens are reserved and always ship with an icon + label, so a
 * rating never depends on colour alone. */
const VITAL_STATUS: Record<VitalRating, { label: string; text: string; ring: string; Icon: typeof CheckCircle }> = {
  good: { label: 'Good', text: 'text-success', ring: '#059669', Icon: CheckCircle },
  needs_work: { label: 'Needs work', text: 'text-warning', ring: '#D97706', Icon: AlertTriangle },
  poor: { label: 'Poor', text: 'text-danger', ring: '#DC2626', Icon: XCircle },
}

function formatVital(metric: PageSpeedMetric): string {
  if (metric.unit === 'ms') {
    return metric.value >= 1000 ? `${(metric.value / 1000).toFixed(2)}s` : `${Math.round(metric.value)}ms`
  }
  return metric.value.toFixed(3)
}

function PageSpeedCard({ postRef, siteId }: { postRef: string; siteId: string | null }) {
  const { data, isLoading } = usePageSpeed(postRef, siteId)
  const run = useRunPageSpeed(postRef, siteId)
  const result = run.data ?? data
  const status = result?.rating ? VITAL_STATUS[result.rating] : null
  // Already cached by the Analytics card above — reused, not refetched — so
  // the score can say whether it reflects where readers actually are.
  const { data: analytics } = useContentPostAnalytics(postRef, siteId)
  const audienceShare = analytics?.devices?.find(
    (d) => d.device === (result?.strategy === 'mobile' ? 'mobile' : 'desktop'),
  )

  return (
    <Card className="p-5 mb-5">
      <CardHeader className="mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <CardTitle>PageSpeed</CardTitle>
          {result?.tested && (
            <Badge variant="default" className="ml-1">
              {result.strategy === 'mobile' ? 'Mobile' : 'Desktop'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {result?.tested_at && (
            <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
              Tested {timeAgo(result.tested_at)}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={run.isPending}
            onClick={() => run.mutate()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', run.isPending && 'animate-spin')} />
            {run.isPending ? 'Testing…' : result?.tested ? 'Re-test' : 'Run test'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : run.isPending ? (
          // PSI runs a real Lighthouse pass — ~20-30s. Say so, rather than
          // leaving a spinner that reads as a hang.
          <div className="flex items-center gap-3 py-8 justify-center text-[13px] text-text-secondary dark:text-text-secondary-dark">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Running a live Lighthouse test — this usually takes 20–30 seconds.
          </div>
        ) : run.isError ? (
          <p className="text-[13px] text-danger py-4">Couldn&apos;t reach PageSpeed Insights. Try again in a moment.</p>
        ) : result?.error ? (
          <p className="text-[13px] text-warning py-4">{result.error}</p>
        ) : !result?.tested ? (
          <EmptyState
            title="No PageSpeed test yet"
            description="Run a mobile Lighthouse test to see this page's Core Web Vitals — the metrics Google actually ranks on."
            action={{ label: 'Run test', onClick: () => run.mutate() }}
          />
        ) : (
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            {/* Score meter — the ring carries severity; the number stays ink. */}
            <div className="flex flex-col items-center flex-shrink-0">
              <HealthRing
                value={result.score ?? 0}
                size={104}
                strokeWidth={9}
                trackColor="rgba(128, 158, 252, 0.18)"
                progressColor={status?.ring ?? '#0129AC'}
              >
                <div className="text-center">
                  <span className="text-[26px] font-semibold text-text-primary dark:text-text-primary-dark leading-none">
                    {result.score ?? '—'}
                  </span>
                  <p className="text-[9.5px] text-text-secondary dark:text-text-secondary-dark mt-0.5">/ 100</p>
                </div>
              </HealthRing>
              {status && (
                <span className={cn('mt-2 inline-flex items-center gap-1 text-[11px] font-medium', status.text)}>
                  <status.Icon className="h-3 w-3" /> {status.label}
                </span>
              )}
            </div>

            <div className="flex-1 w-full">
              <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2.5">
                Core Web Vitals
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {result.metrics.map((m) => {
                  const ms = m.rating ? VITAL_STATUS[m.rating] : null
                  return (
                    <div key={m.key} className="flex items-baseline justify-between gap-3 border-b border-border dark:border-border-dark pb-2 last:border-0">
                      <span className="text-[12px] text-text-secondary dark:text-text-secondary-dark truncate" title={m.label}>
                        {m.label}
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[12.5px] font-semibold text-text-primary dark:text-text-primary-dark tabular-nums">
                          {formatVital(m)}
                        </span>
                        {ms && (
                          <span className={cn('inline-flex items-center', ms.text)} title={ms.label}>
                            <ms.Icon className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mt-3">
                {audienceShare
                  ? `Measured on ${result.strategy} — where ${formatPercent(audienceShare.pct, 0)} of this post's readers actually are. `
                  : `Measured on a simulated ${result.strategy} device. `}
                Total Blocking Time is a lab stand-in for INP, which only real-user data can measure.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AnalyticsOverviewCard({ postRef, siteId }: { postRef: string; siteId: string | null }) {
  const { data, isLoading, isError } = useContentPostAnalytics(postRef, siteId)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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
            {/* Lead figure + KPI row. Leads is the outcome this panel exists to
                report, so it leads; the rest are supporting context. */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {data.total_leads != null && (
                <div className="rounded-lg border border-success/30 bg-success/[0.04] p-3.5 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    Leads from this post
                  </div>
                  <span className="text-[40px] font-semibold text-text-primary dark:text-text-primary-dark leading-none">
                    {formatNumber(data.total_leads)}
                  </span>
                  <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mt-2">
                    People who read this, then reached your confirmation page
                  </p>
                </div>
              )}

              <div className={cn(
                'grid gap-4 grid-cols-2',
                data.total_leads != null ? 'lg:col-span-3 lg:grid-cols-4' : 'lg:col-span-4 lg:grid-cols-4',
              )}>
                <StatTile
                  label="Visitors"
                  icon={<Users className="h-3.5 w-3.5" />}
                  value={formatNumber(data.visitors_30d)}
                  hint="Unique people (30d)"
                />
                <StatTile
                  label="Visits"
                  icon={<MousePointerClick className="h-3.5 w-3.5" />}
                  value={formatNumber(data.traffic_30d)}
                  delta={data.traffic_change_pct}
                  hint={`vs ${formatNumber(data.traffic_prev_30d)} prior 30d`}
                />
                <StatTile
                  label="Bounce rate"
                  icon={<Route className="h-3.5 w-3.5" />}
                  value={data.bounce_rate != null ? formatPercent(data.bounce_rate, 1) : '—'}
                  status={
                    data.bounce_rate == null ? undefined
                      : data.bounce_rate > 70 ? 'critical'
                      : data.bounce_rate > 50 ? 'warning' : 'good'
                  }
                />
                <StatTile
                  label="Avg. engagement"
                  icon={<Timer className="h-3.5 w-3.5" />}
                  value={data.avg_engagement_time != null ? formatDuration(data.avg_engagement_time) : '—'}
                  hint="Time on page"
                />
              </div>
            </div>

            {/* Daily traffic — one series, so its title names it and no legend
                box is needed. Integer ticks: half a visitor doesn't exist. */}
            {data.daily_traffic.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5 items-start">
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-2">
                    Daily visits
                  </p>
                  <AreaChart
                    data={data.daily_traffic as unknown as Record<string, unknown>[]}
                    series={[{ key: 'views', label: 'Visits' }]}
                    height={150}
                    integerYAxis
                    formatter={(v) => formatNumber(v)}
                  />
                </div>
                <DeviceSplit devices={data.devices} isDark={isDark} />
              </div>
            )}

            {/* Conversion routes */}
            <div className="pt-4 border-t border-border dark:border-border-dark">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
                  Conversion routes
                </p>
                {data.flows.length > 0 && (
                  <span className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
                    {data.flows.length} route{data.flows.length === 1 ? '' : 's'} · % of readers
                  </span>
                )}
              </div>
              {data.flows.length === 0 ? (
                <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
                  No Contact or Pricing page detected for this site yet.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.flows.map((flow) => (
                      <ConversionRoute key={flow.label} flow={flow} isDark={isDark} />
                    ))}
                  </div>
                  <p className="flex items-start gap-1.5 text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
                    <Info className="h-3 w-3 mt-[1px] flex-shrink-0" />
                    <span>
                      {data.total_leads != null ? (
                        <>
                          Routes overlap — one visitor who passes through more than one
                          still counts <strong className="font-semibold">once</strong> in the lead total above.
                          Adding the routes up would double-count them.
                        </>
                      ) : (
                        'Based on visitors who reached the page — no confirmation ("thank you") page detected yet to confirm actual submissions.'
                      )}
                    </span>
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
  const [tab, setTab] = useState('overview')
  // The route param is the WP slug (clean URLs) — UUIDs still resolve too
  const { postId = '' } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedSiteId } = useSiteContext()

  const { data: post, isLoading } = useContentPostDetail(postId, selectedSiteId)
  // Mutations always target the real UUID once the post has resolved
  const rescan = useRescanPost(post?.id ?? postId)
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

      {/* The page carries four independent analyses; stacked, they ran to
          ~4 screens of scrolling. Tabs keep each one a screen or less, with
          Overview summarising all of them so nothing is hidden without a
          pointer to it. */}
      <Tabs value={tab} defaultValue="overview" onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">
            Content
            {post.issues.length > 0 && <Badge variant="warning" className="ml-1.5">{post.issues.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="speed">Speed</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab post={post} postRef={postId} onJump={setTab} />
        </TabsContent>

        <TabsContent value="content">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {SCORED_BREAKDOWN.map((key) => {
              const data = post.score_breakdown?.[key]
              if (!data) return null
              return <BreakdownCard key={key} categoryKey={key} data={data} />
            })}
          </div>

          {/* Informational sections — meta description, publish history, schema */}
          {INFO_BREAKDOWN.some((k) => post.score_breakdown?.[k]) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {INFO_BREAKDOWN.map((key) => {
                const data = post.score_breakdown?.[key]
                if (!data) return null
                return <BreakdownCard key={key} categoryKey={key} data={data} />
              })}
            </div>
          )}

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
        </TabsContent>

        <TabsContent value="traffic">
          <AnalyticsOverviewCard postRef={postId} siteId={post.site_id} />
        </TabsContent>

        <TabsContent value="search">
          <SearchConsoleCard postRef={postId} siteId={post.site_id} />
        </TabsContent>

        <TabsContent value="speed">
          <PageSpeedCard postRef={postId} siteId={post.site_id} />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
