import { useEffect, useRef, useState } from 'react'
import { Plus, Play, Pencil, Trash2, ChevronDown, ArrowUp, ArrowDown, X, AlertCircle, Loader2, GitBranch, Target, Search, GitCompare } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import QueryError from '@/components/ui/QueryError'
import SparkLine from '@/components/charts/SparkLine'
import TrendIndicator from '@/components/ui/TrendIndicator'
import {
  DAILY_RANGE_OPTIONS, daysAgoIso, rangeSummaryLabel, RangeControl,
  type DailyRangeKey,
} from '@/components/domain/DateRangePicker'
import { useSiteContext } from '@/contexts/SiteContext'
import {
  useFlowsDashboard, useCreateFlowCategory, useUpdateFlowCategory, useDeleteFlowCategory, useRunFlowCategory,
  useSitePagesSearch, BREAKDOWN_DIMENSIONS, MATCH_TYPE_OPTIONS,
  type FlowCategory, type FlowStepInput, type FlowDashboardItem, type SitePageOption,
} from '@/hooks/useFlows'
import { cn, formatNumber, formatPercent } from '@/lib/utils'

/** Relative % change vs. the comparison period — null means "can't express
 * as a percent of zero" (previous was 0), which the UI shows as "New"
 * rather than a nonsensical/infinite percentage. */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function CompareDelta({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous)
  return change === null
    ? <Badge variant="info">New</Badge>
    : <TrendIndicator value={change} />
}

function apiErrorDetail(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
}

const COLOR_OPTIONS: { value: string; className: string }[] = [
  { value: 'primary', className: 'bg-primary dark:bg-primary-dark' },
  { value: 'secondary', className: 'bg-secondary' },
  { value: 'success', className: 'bg-success' },
  { value: 'warning', className: 'bg-warning' },
  { value: 'danger', className: 'bg-danger' },
]

function colorDotClass(color: string | null): string {
  return COLOR_OPTIONS.find((c) => c.value === color)?.className ?? 'bg-primary dark:bg-primary-dark'
}

function emptyStep(): FlowStepInput {
  return { label: '', match_type: 'contains', pattern: '', is_directly_followed: false, within_seconds: null, is_goal: false }
}

/** The URL path only — patterns match against page_location with
 * match_type "contains", so the domain/protocol prefix is just noise. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

// ── Page picker — build a step from a real page instead of typing a pattern blind ──

function PagePicker({ siteId, onPick }: { siteId: string | null; onPick: (page: SitePageOption) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: options, isLoading } = useSitePagesSearch(siteId, query)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Pick from your site's real pages"
        className="h-8 px-2.5 rounded-md border border-border dark:border-border-dark text-[11px] text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark flex items-center gap-1 transition-colors"
      >
        <Search className="h-3 w-3" /> Pick a page
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-72 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-card-dark shadow-dropdown p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your pages by title or URL…"
            className="w-full h-8 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark mb-2 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15"
          />
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
            {query.trim().length < 2 ? (
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark px-1 py-2">Type at least 2 characters…</p>
            ) : isLoading ? (
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark px-1 py-2">Searching…</p>
            ) : !options?.length ? (
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark px-1 py-2">No matching pages found.</p>
            ) : (
              options.map((page) => (
                <button
                  key={page.url}
                  type="button"
                  onClick={() => { onPick(page); setOpen(false); setQuery('') }}
                  className="text-left px-2 py-1.5 rounded-md hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                >
                  <p className="text-[12px] text-text-primary dark:text-text-primary-dark truncate">{page.title}</p>
                  <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark truncate">{pathOf(page.url)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step builder ────────────────────────────────────────────────────────────────

function StepBuilder({ steps, onChange, siteId }: { steps: FlowStepInput[]; onChange: (steps: FlowStepInput[]) => void; siteId: string | null }) {
  const update = (i: number, patch: Partial<FlowStepInput>) => {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border border-border dark:border-border-dark p-3 bg-surface/30 dark:bg-surface-dark/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 dark:bg-primary-dark/15 text-primary dark:text-primary-dark text-[11px] font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <input
              value={step.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder={`Step ${i + 1} label, e.g. "Views pricing page"`}
              className="flex-1 h-8 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15"
            />
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="p-1 rounded text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-30 disabled:cursor-not-allowed">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1}
                className="p-1 rounded text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-30 disabled:cursor-not-allowed">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(i)} disabled={steps.length <= 1}
                className="p-1 rounded text-danger hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Select value={step.match_type} onChange={(e) => update(i, { match_type: e.target.value as FlowStepInput['match_type'] })} className="w-36 h-8 text-[12px]">
              {MATCH_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </Select>
            <input
              value={step.pattern}
              onChange={(e) => update(i, { pattern: e.target.value })}
              placeholder="/pricing"
              className="flex-1 h-8 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-2 text-[12px] font-mono text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15"
            />
            <PagePicker
              siteId={siteId}
              onPick={(page) => update(i, {
                pattern: pathOf(page.url),
                label: step.label || page.title,
              })}
            />
          </div>
          <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mb-2">
            {MATCH_TYPE_OPTIONS.find((o) => o.value === step.match_type)?.hint}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => update(i, { is_goal: !step.is_goal })}
              title="Mark this step as the conversion event (e.g. a 'thank you' page) — its count becomes this flow's Leads."
              className={cn(
                'h-7 px-2.5 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-colors',
                step.is_goal
                  ? 'bg-success/10 border-success/40 text-success'
                  : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark'
              )}
            >
              <Target className="h-3 w-3" />
              {step.is_goal ? 'Goal step' : 'Mark as goal'}
            </button>

            {i > 0 && (
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-secondary dark:text-text-secondary-dark cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={step.is_directly_followed}
                  onChange={(e) => update(i, { is_directly_followed: e.target.checked, within_seconds: e.target.checked ? step.within_seconds ?? 1800 : null })} />
                Must happen immediately after the previous step
                {step.is_directly_followed && (
                  <>
                    , within
                    <input type="number" min={1} max={86400} value={step.within_seconds ?? 1800}
                      onChange={(e) => update(i, { within_seconds: Number(e.target.value) })}
                      className="w-16 h-6 rounded border border-border dark:border-border-dark bg-card dark:bg-card-dark px-1.5 text-[11px] text-text-primary dark:text-text-primary-dark" />
                    seconds
                  </>
                )}
              </label>
            )}
          </div>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={() => onChange([...steps, emptyStep()])}
        disabled={steps.length >= 20} className="self-start flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add step
      </Button>
    </div>
  )
}

// ── Create / edit modal ──────────────────────────────────────────────────────────

function FlowCategoryModal({
  open, onClose, siteId, editing,
}: { open: boolean; onClose: () => void; siteId: string | null; editing: FlowCategory | null }) {
  const isEdit = Boolean(editing)
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [color, setColor] = useState(editing?.color ?? 'primary')
  const [steps, setSteps] = useState<FlowStepInput[]>(
    editing?.steps.length ? editing.steps.map((s) => ({ ...s })) : [emptyStep(), emptyStep()]
  )
  const [error, setError] = useState('')
  const create = useCreateFlowCategory(siteId)
  const update = useUpdateFlowCategory(siteId)
  const saving = create.isPending || update.isPending

  const reset = () => {
    setName(editing?.name ?? ''); setDescription(editing?.description ?? ''); setColor(editing?.color ?? 'primary')
    setSteps(editing?.steps.length ? editing.steps.map((s) => ({ ...s })) : [emptyStep(), emptyStep()])
    setError('')
  }

  const close = () => { onClose(); reset() }

  const handleSave = async () => {
    setError('')
    if (!name.trim()) { setError('Give this flow category a name.'); return }
    const cleanSteps = steps.map((s) => ({ ...s, label: s.label.trim() || s.pattern, pattern: s.pattern.trim() }))
    if (cleanSteps.some((s) => !s.pattern)) { setError('Every step needs a page pattern.'); return }

    try {
      if (isEdit && editing) {
        await update.mutateAsync({ id: editing.id, name: name.trim(), description: description.trim() || null, color, steps: cleanSteps })
      } else {
        await create.mutateAsync({ name: name.trim(), description: description.trim() || null, color, steps: cleanSteps })
      }
      close()
    } catch (err) {
      setError(apiErrorDetail(err, 'Failed to save this flow category.'))
    }
  }

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit flow category' : 'New flow category'} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark mb-1 block">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "A", "Trial Signup Flow"'
              className="w-full h-9 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-3 text-[13px] text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark mb-1 block">Color</label>
            <div className="flex items-center gap-1.5 h-9">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={cn('h-6 w-6 rounded-full', c.className, color === c.value && 'ring-2 ring-offset-2 ring-primary dark:ring-primary-dark dark:ring-offset-card-dark')} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark mb-1 block">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this journey represents"
            className="w-full h-9 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-3 text-[13px] text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15" />
        </div>

        <div>
          <label className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark mb-2 block">
            Ordered steps — a session must hit these page patterns in this order
          </label>
          <StepBuilder steps={steps} onChange={setSteps} siteId={siteId} />
        </div>

        {error && (
          <p className="text-[12px] text-danger flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border dark:border-border-dark">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {isEdit ? 'Save changes' : 'Create flow category'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Run modal ────────────────────────────────────────────────────────────────────

function RunModal({ open, onClose, siteId, category }: { open: boolean; onClose: () => void; siteId: string | null; category: FlowCategory }) {
  const [start, setStart] = useState(daysAgoIso(6))
  const [end, setEnd] = useState(daysAgoIso(0))
  const [breakdown, setBreakdown] = useState('')
  const [error, setError] = useState('')
  const run = useRunFlowCategory(siteId)
  const today = daysAgoIso(0)

  const close = () => { onClose(); setError('') }

  const handleRun = async () => {
    setError('')
    if (start > end) { setError('From date must be before the To date.'); return }
    try {
      await run.mutateAsync({ id: category.id, start_date: start, end_date: end, breakdown_dimension: breakdown || undefined })
      close()
    } catch (err) {
      setError(apiErrorDetail(err, 'Failed to run this flow category against GA4.'))
    }
  }

  return (
    <Modal open={open} onClose={close} title={`Run "${category.name}"`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)}
            className="h-9 flex-1 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark" />
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">to</span>
          <input type="date" value={end} max={today} onChange={(e) => setEnd(e.target.value)}
            className="h-9 flex-1 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-2 text-[12px] text-text-primary dark:text-text-primary-dark" />
        </div>
        <Select label="Breakdown by (optional)" value={breakdown} onChange={(e) => setBreakdown(e.target.value)}>
          <option value="">No breakdown</option>
          {BREAKDOWN_DIMENSIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
        {error && (
          <p className="text-[12px] text-danger flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" loading={run.isPending} onClick={handleRun} className="flex items-center gap-1.5">
            {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Funnel bar (single-series magnitude across ordered steps) ────────────────────

function FunnelBar({ label, activeUsers, maxUsers, abandonmentRate, isGoal }: {
  label: string; activeUsers: number; maxUsers: number; abandonmentRate: number; isGoal?: boolean
}) {
  const pct = maxUsers > 0 ? Math.max((activeUsers / maxUsers) * 100, activeUsers > 0 ? 2 : 0) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 flex-shrink-0 flex items-center gap-1 text-[12px] text-text-primary dark:text-text-primary-dark truncate" title={label}>
        {isGoal && <Target className="h-3 w-3 text-success flex-shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <div className="flex-1 h-5 rounded-full bg-surface dark:bg-surface-dark overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', isGoal ? 'bg-success' : 'bg-primary dark:bg-primary-dark')}
          style={{ width: `${pct}%` }}
          title={`${formatNumber(activeUsers)} users`}
        />
      </div>
      <span className={cn('w-16 flex-shrink-0 text-[12px] font-medium text-right', isGoal ? 'text-success' : 'text-text-primary dark:text-text-primary-dark')}>
        {formatNumber(activeUsers)}
      </span>
      <span className="w-14 flex-shrink-0 text-[11px] text-text-secondary dark:text-text-secondary-dark text-right">
        {activeUsers > 0 ? `-${formatPercent(abandonmentRate * 100, 0)}` : ''}
      </span>
    </div>
  )
}

// ── Category card ────────────────────────────────────────────────────────────────

function FlowCategoryCard({ item, siteId }: { item: FlowDashboardItem; siteId: string | null }) {
  const { category, current, previous, trend } = item
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const update = useUpdateFlowCategory(siteId)
  const del = useDeleteFlowCategory(siteId)

  const maxUsers = current ? Math.max(...current.step_results.map((s) => s.active_users), 1) : 1
  const trendData = trend.map((s) => s.conversion_rate * 100)
  const hasGoal = current?.leads != null
  const leadsTrendData = trend.map((s) => s.leads ?? 0)
  // Rare: a goal marked mid-funnel, with more steps after it — show the
  // full-funnel completion as auxiliary info rather than hiding it.
  const goalIsFinalStep = current?.goal_step_index === (current?.step_results.length ?? 0) - 1

  const handleDelete = () => {
    if (confirm(`Delete "${category.name}"? This removes its steps and history.`)) {
      del.mutate(category.id)
    }
  }

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-3 border-b border-border dark:border-border-dark mb-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', colorDotClass(category.color))} />
          <CardTitle className="truncate">{category.name}</CardTitle>
          {!category.is_active && <Badge variant="default">Paused</Badge>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setShowRun(true)} title="Run now" className="p-1.5">
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)} title="Edit" className="p-1.5">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: category.id, is_active: !category.is_active })}
            title={category.is_active ? 'Pause daily classification' : 'Resume daily classification'} className="p-1.5">
            <span className={cn('block h-3.5 w-3.5 rounded-full border-2', category.is_active ? 'border-success bg-success/20' : 'border-text-secondary dark:border-text-secondary-dark')} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} title="Delete" className="p-1.5 text-danger hover:bg-danger/10">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-5 pt-3 pb-4">
        {category.description && (
          <p className="text-[11.5px] text-text-secondary dark:text-text-secondary-dark mb-3">{category.description}</p>
        )}

        {!current ? (
          <EmptyState
            title="No funnel data for this range"
            description="Connect Google Analytics for this site, or try a different range."
            action={{ label: 'Run now', onClick: () => setShowRun(true) }}
            className="py-8"
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div>
                <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Entered</p>
                <p className="text-[18px] font-semibold text-text-primary dark:text-text-primary-dark">{formatNumber(current.total_entered)}</p>
                {previous && <CompareDelta current={current.total_entered} previous={previous.total_entered} />}
              </div>
              {hasGoal ? (
                <>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Leads</p>
                    <p className="text-[18px] font-semibold text-success flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" /> {formatNumber(current.leads!)}
                    </p>
                    {previous?.leads != null && <CompareDelta current={current.leads!} previous={previous.leads} />}
                  </div>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Lead Rate</p>
                    <p className="text-[18px] font-semibold text-success">{formatPercent((current.lead_rate ?? 0) * 100)}</p>
                    {previous?.lead_rate != null && (
                      <CompareDelta current={current.lead_rate ?? 0} previous={previous.lead_rate} />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Completed</p>
                    <p className="text-[18px] font-semibold text-text-primary dark:text-text-primary-dark">{formatNumber(current.total_completed)}</p>
                    {previous && <CompareDelta current={current.total_completed} previous={previous.total_completed} />}
                  </div>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Conversion</p>
                    <p className="text-[18px] font-semibold text-primary dark:text-primary-dark">{formatPercent(current.conversion_rate * 100)}</p>
                    {previous && <CompareDelta current={current.conversion_rate} previous={previous.conversion_rate} />}
                  </div>
                </>
              )}
            </div>

            {hasGoal && !goalIsFinalStep && (
              <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mb-2">
                {formatNumber(current.total_completed)} completed the full sequence ({formatPercent(current.conversion_rate * 100)})
              </p>
            )}

            {trendData.length > 1 && (
              <div className="flex flex-col gap-1.5 mb-3">
                <div className="flex items-center gap-2">
                  <SparkLine data={hasGoal ? leadsTrendData : trendData} width={140} height={28} color={hasGoal ? '#059669' : '#0129AC'} />
                  <span className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
                    {trend.length}-day {hasGoal ? 'leads' : 'conversion'} trend
                  </span>
                </div>
                {hasGoal && (
                  <div className="flex items-center gap-2">
                    <SparkLine data={trendData} width={140} height={20} color="#809EFC" />
                    <span className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
                      {trend.length}-day lead rate trend
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[12px] font-medium text-primary dark:text-primary-dark hover:opacity-80"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
              {expanded ? 'Hide' : 'Show'} step-by-step breakdown
            </button>

            {expanded && (
              <div className="mt-3 pt-3 border-t border-border dark:border-border-dark flex flex-col gap-2">
                {current.step_results.map((s) => (
                  <FunnelBar
                    key={s.step_index} label={s.label} activeUsers={s.active_users}
                    maxUsers={maxUsers} abandonmentRate={s.abandonment_rate}
                    isGoal={s.step_index === current.goal_step_index}
                  />
                ))}

                <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark pt-1">
                  Aggregate GA4 activity for {rangeSummaryLabel(current.range_start, current.range_end)} —
                  not a list of individual sessions (GA4 doesn't expose those outside BigQuery Export).
                  Want a breakdown by device, channel, or country? Use "Run now" with a breakdown dimension.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>

      <FlowCategoryModal open={showEdit} onClose={() => setShowEdit(false)} siteId={siteId} editing={category} />
      <RunModal open={showRun} onClose={() => setShowRun(false)} siteId={siteId} category={category} />
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Flows() {
  const { selectedSiteId } = useSiteContext()
  const [showCreate, setShowCreate] = useState(false)
  const [range, setRange] = useState<DailyRangeKey>('7d')
  const [customStart, setCustomStart] = useState(() => daysAgoIso(6))
  const [customEnd, setCustomEnd] = useState(() => daysAgoIso(0))
  const [compare, setCompare] = useState(false)
  const { data, isLoading, isFetching, isError, refetch } = useFlowsDashboard(selectedSiteId, {
    range, startDate: customStart, endDate: customEnd, compare,
  })

  const items = data?.items ?? []
  // Summed across every flow with a marked goal step, for the currently
  // selected range — the single number the whole page exists to answer.
  const goalFlows = items.filter((item) => item.current?.leads != null)
  const totalLeads = goalFlows.reduce((sum, item) => sum + (item.current?.leads ?? 0), 0)

  return (
    <PageShell
      title="Flow Categories"
      subtitle="Define named page-pattern journeys and see how much of your GA4 traffic completes each one."
      actions={
        selectedSiteId ? (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Flow Category
          </Button>
        ) : undefined
      }
    >
      {!selectedSiteId ? (
        <EmptyState title="Select a site" description="Pick a site from the site switcher above to manage its flow categories." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {isFetching && !isLoading && (
                <span className="flex items-center gap-1.5 text-[11.5px] text-text-secondary dark:text-text-secondary-dark">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={compare ? 'primary' : 'secondary'} size="sm"
                onClick={() => setCompare((v) => !v)}
                className="flex items-center gap-1.5"
              >
                <GitCompare className="h-3.5 w-3.5" /> Compare
              </Button>
              <RangeControl
                value={range}
                onChange={setRange}
                options={DAILY_RANGE_OPTIONS}
                customStart={customStart}
                customEnd={customEnd}
                onCustomApply={(start, end) => { setCustomStart(start); setCustomEnd(end) }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
            </div>
          ) : isError ? (
            <QueryError what="flow categories" onRetry={() => refetch()} />
          ) : !items.length ? (
            <EmptyState
              icon={<GitBranch className="h-10 w-10" />}
              title="No flow categories yet"
              description='Create one to classify GA4 activity into named journeys — e.g. "Pricing → Signup" or "Blog → Contact".'
              action={{ label: 'New Flow Category', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <>
              {goalFlows.length > 0 && (
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success bg-success/10 px-3 py-1.5 rounded-full">
                    <Target className="h-4 w-4" />
                    {formatNumber(totalLeads)} total lead{totalLeads === 1 ? '' : 's'} across {goalFlows.length} flow{goalFlows.length === 1 ? '' : 's'} ({rangeSummaryLabel(data?.range_start ?? null, data?.range_end ?? null)})
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {items.map((item) => <FlowCategoryCard key={item.category.id} item={item} siteId={selectedSiteId} />)}
              </div>
            </>
          )}
        </>
      )}

      <FlowCategoryModal open={showCreate} onClose={() => setShowCreate(false)} siteId={selectedSiteId} editing={null} />
    </PageShell>
  )
}
