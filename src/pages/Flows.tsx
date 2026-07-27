import { useState } from 'react'
import { Plus, Play, Pencil, Trash2, ChevronDown, ArrowUp, ArrowDown, X, AlertCircle, Loader2, GitBranch } from 'lucide-react'
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
import { useSiteContext } from '@/contexts/SiteContext'
import {
  useFlowsDashboard, useCreateFlowCategory, useUpdateFlowCategory, useDeleteFlowCategory, useRunFlowCategory,
  BREAKDOWN_DIMENSIONS, MATCH_TYPE_OPTIONS,
  type FlowCategory, type FlowStepInput, type FlowDashboardItem,
} from '@/hooks/useFlows'
import { cn, formatNumber, formatPercent } from '@/lib/utils'

function apiErrorDetail(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
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
  return { label: '', match_type: 'contains', pattern: '', is_directly_followed: false, within_seconds: null }
}

// ── Step builder ────────────────────────────────────────────────────────────────

function StepBuilder({ steps, onChange }: { steps: FlowStepInput[]; onChange: (steps: FlowStepInput[]) => void }) {
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
          </div>
          <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark mb-2">
            {MATCH_TYPE_OPTIONS.find((o) => o.value === step.match_type)?.hint}
          </p>

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
          <StepBuilder steps={steps} onChange={setSteps} />
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

function FunnelBar({ label, activeUsers, maxUsers, abandonmentRate }: { label: string; activeUsers: number; maxUsers: number; abandonmentRate: number }) {
  const pct = maxUsers > 0 ? Math.max((activeUsers / maxUsers) * 100, activeUsers > 0 ? 2 : 0) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 flex-shrink-0 text-[12px] text-text-primary dark:text-text-primary-dark truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 h-5 rounded-full bg-surface dark:bg-surface-dark overflow-hidden">
        <div
          className="h-full rounded-full bg-primary dark:bg-primary-dark transition-all duration-300"
          style={{ width: `${pct}%` }}
          title={`${formatNumber(activeUsers)} users`}
        />
      </div>
      <span className="w-16 flex-shrink-0 text-[12px] font-medium text-text-primary dark:text-text-primary-dark text-right">
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
  const { category, latest, trend } = item
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const update = useUpdateFlowCategory(siteId)
  const del = useDeleteFlowCategory(siteId)

  const maxUsers = latest ? Math.max(...latest.step_results.map((s) => s.active_users), 1) : 1
  const trendData = trend.map((s) => s.conversion_rate * 100)

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

        {!latest ? (
          <EmptyState
            title="No data yet"
            description="Runs nightly at 4 AM UTC, or trigger it now."
            action={{ label: 'Run now', onClick: () => setShowRun(true) }}
            className="py-8"
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Entered</p>
                <p className="text-[18px] font-semibold text-text-primary dark:text-text-primary-dark">{formatNumber(latest.total_entered)}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Completed</p>
                <p className="text-[18px] font-semibold text-text-primary dark:text-text-primary-dark">{formatNumber(latest.total_completed)}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-0.5">Conversion</p>
                <p className="text-[18px] font-semibold text-primary dark:text-primary-dark">{formatPercent(latest.conversion_rate * 100)}</p>
              </div>
            </div>

            {trendData.length > 1 && (
              <div className="flex items-center gap-2 mb-3">
                <SparkLine data={trendData} width={140} height={28} color="#0129AC" />
                <span className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark">
                  {trend.length}-day conversion trend
                </span>
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
                {latest.step_results.map((s) => (
                  <FunnelBar key={s.step_index} label={s.label} activeUsers={s.active_users} maxUsers={maxUsers} abandonmentRate={s.abandonment_rate} />
                ))}

                {latest.breakdown.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark mb-1.5">
                      By {BREAKDOWN_DIMENSIONS.find((d) => d.value === latest.breakdown_dimension)?.label ?? latest.breakdown_dimension}
                    </p>
                    <table className="w-full text-[12px]">
                      <tbody className="divide-y divide-border dark:divide-border-dark">
                        {latest.breakdown.map((b, i) => (
                          <tr key={i}>
                            <td className="py-1 text-text-primary dark:text-text-primary-dark">{b.value}</td>
                            <td className="py-1 text-right text-text-secondary dark:text-text-secondary-dark">{formatNumber(b.active_users)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-[10.5px] text-text-secondary dark:text-text-secondary-dark pt-1">
                  Aggregate GA4 activity for {latest.range_start === latest.range_end ? latest.range_start : `${latest.range_start} – ${latest.range_end}`} —
                  not a list of individual sessions (GA4 doesn't expose those outside BigQuery Export).
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
  const { data, isLoading, isError, refetch } = useFlowsDashboard(selectedSiteId)

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
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <QueryError what="flow categories" onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState
          icon={<GitBranch className="h-10 w-10" />}
          title="No flow categories yet"
          description='Create one to classify GA4 activity into named journeys — e.g. "Pricing → Signup" or "Blog → Contact".'
          action={{ label: 'New Flow Category', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((item) => <FlowCategoryCard key={item.category.id} item={item} siteId={selectedSiteId} />)}
        </div>
      )}

      <FlowCategoryModal open={showCreate} onClose={() => setShowCreate(false)} siteId={selectedSiteId} editing={null} />
    </PageShell>
  )
}
