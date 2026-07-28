import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, AlertTriangle, Zap, X, OctagonX, Check } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { get, post } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { useManualAgentOptions } from '@/hooks/useSettings'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentStep {
  index: number
  label: string
  category: string
  status: 'pending' | 'running' | 'done' | 'error'
  alerts?: number
  error?: string
}

interface AgentProgressModalProps {
  open: boolean
  siteId: string | null
  siteName: string
  initialJobId?: string | null
  onClose: () => void
  onComplete: (jobId: string) => void
  onJobStart?: (jobId: string) => void
}

const CATEGORY_COLOR: Record<string, string> = {
  optimizer:  'text-primary bg-primary/8',
  watchdog:   'text-warning bg-warning/8',
  autopilot:  'text-success bg-success/8',
  flows:      'text-secondary bg-secondary/8',
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: AgentStep }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2"
    >
      <div className="w-5 flex-shrink-0 flex justify-center">
        {step.status === 'pending' && (
          <div className="w-3 h-3 rounded-full border-2 border-border dark:border-border-dark" />
        )}
        {step.status === 'running' && (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        )}
        {step.status === 'done' && (
          <CheckCircle className="h-4 w-4 text-success" />
        )}
        {step.status === 'error' && (
          <XCircle className="h-4 w-4 text-danger" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded capitalize',
            CATEGORY_COLOR[step.category] ?? 'text-text-secondary bg-surface'
          )}>
            {step.category}
          </span>
          <span className={cn(
            'text-[13px]',
            step.status === 'pending'
              ? 'text-text-secondary dark:text-text-secondary-dark'
              : step.status === 'error'
              ? 'text-danger'
              : 'text-text-primary dark:text-text-primary-dark font-medium'
          )}>
            {step.label}
          </span>
        </div>
        {step.status === 'error' && step.error && (
          <p className="text-[11px] text-danger/80 mt-0.5 truncate">{step.error}</p>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        {step.status === 'done' && step.alerts !== undefined && (
          <span className={cn(
            'text-[11px] font-medium',
            step.alerts > 0 ? 'text-warning' : 'text-text-secondary dark:text-text-secondary-dark'
          )}>
            {step.alerts > 0 ? `${step.alerts} alert${step.alerts !== 1 ? 's' : ''}` : 'no alerts'}
          </span>
        )}
        {step.status === 'running' && (
          <span className="text-[11px] text-primary">Running…</span>
        )}
      </div>
    </motion.div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function AgentProgressModal({
  open, siteId, siteName, initialJobId, onClose, onComplete, onJobStart,
}: AgentProgressModalProps) {
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [pct, setPct] = useState(0)
  const [phase, setPhase] = useState<'selecting' | 'starting' | 'running' | 'stopping' | 'stopped' | 'done' | 'error'>('selecting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const esRef = useRef<EventSource | null>(null)

  const { data: agentOptions, isLoading: optionsLoading } = useManualAgentOptions()

  // Seed the checklist from each agent's Agent Configuration toggle, every
  // time the modal opens fresh — reruns if agentOptions was still loading at
  // that point. Deliberately NOT keyed on `selected` itself, so freely
  // toggling checkboxes afterward never gets stomped back to the defaults.
  useEffect(() => {
    if (open && !initialJobId && agentOptions) {
      setSelected(new Set(agentOptions.filter((o) => o.default_enabled).map((o) => o.agent_name)))
    }
  }, [open, initialJobId, agentOptions])

  function toggleAgent(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Ref mirrors phase so closures always see current value
  const phaseRef = useRef<string>('selecting')
  const setPhaseSync = (p: typeof phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  const openStream = useCallback((jid: string) => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    // EventSource cannot send Authorization headers — pass the JWT as a query param
    const es = new EventSource(`/api/agents/jobs/${jid}/stream?token=${encodeURIComponent(getToken() ?? '')}`)
    esRef.current = es

    const finish = (fn: () => void) => {
      es.close()
      esRef.current = null
      fn()
    }

    es.addEventListener('start', (e) => {
      const d = JSON.parse(e.data)
      setSteps(Array.from({ length: d.total }, (_, i) => ({
        index: i, label: '', category: '', status: 'pending' as const,
      })))
      setPhaseSync('running')
    })

    es.addEventListener('step', (e) => {
      const d = JSON.parse(e.data)
      setPct(d.pct ?? 0)
      setSteps((prev) => {
        const next = [...prev]
        next[d.index] = {
          index: d.index,
          label: d.label,
          category: d.category,
          status: d.status,
          alerts: d.alerts,
          error: d.error,
        }
        return next
      })
    })

    es.addEventListener('job_status', (e) => {
      const d = JSON.parse(e.data)
      if (d.status === 'running' && phaseRef.current === 'starting') {
        setPhaseSync('running')
      }
    })

    es.addEventListener('done', () => {
      finish(() => {
        setPct(100)
        setPhaseSync('done')
        setTimeout(() => onComplete(jid), 800)
      })
    })

    es.addEventListener('stopped', (e) => {
      const d = JSON.parse(e.data)
      finish(() => {
        setPct(d.pct ?? 0)
        setPhaseSync('stopped')
      })
    })

    es.addEventListener('error', (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data ?? '{}')
        setErrorMsg(d.message ?? 'Agent run failed')
      } catch {
        setErrorMsg('Agent run failed')
      }
      finish(() => setPhaseSync('error'))
    })

    es.onerror = async () => {
      const current = phaseRef.current
      if (current === 'done' || current === 'stopped' || current === 'error') return
      if (es.readyState === EventSource.CLOSED) {
        // Try to restore state from DB snapshot before showing error
        try {
          const snap = await get<{ status: string }>(`/agents/jobs/${jid}`)
          if (snap.status === 'done') {
            finish(() => { setPct(100); setPhaseSync('done'); onComplete(jid) })
            return
          } else if (snap.status === 'stopped') {
            finish(() => setPhaseSync('stopped'))
            return
          } else if (snap.status === 'error') {
            finish(() => setPhaseSync('error'))
            return
          }
          // Job still running — reopen stream
          openStream(jid)
        } catch {
          setErrorMsg('Connection to server lost')
          finish(() => setPhaseSync('error'))
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable across the modal's lifetime
  }, [onComplete])

  const handleForceStop = useCallback(async () => {
    if (!jobId || phaseRef.current !== 'running') return
    setPhaseSync('stopping')
    try {
      await post(`/agents/jobs/${jobId}/stop`, {})
    } catch {
      // best-effort
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setPhaseSync is a stable ref-writer
  }, [jobId])

  const handleStartRun = useCallback(() => {
    if (!siteId || selected.size === 0) return
    setPhaseSync('starting')
    setErrorMsg(null)

    post<{ job_id: string }>(`/agents/${siteId}/run-job`, { agent_names: Array.from(selected) })
      .then((res) => {
        setJobId(res.job_id)
        onJobStart?.(res.job_id)
        openStream(res.job_id)
      })
      .catch((err) => {
        setErrorMsg(err?.message ?? 'Failed to start agents')
        setPhaseSync('error')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openStream/onJobStart are stable across the modal's lifetime
  }, [siteId, selected])

  useEffect(() => {
    if (!open || !siteId) return

    // If we already have a job (reconnect scenario), jump straight to streaming
    if (initialJobId) {
      setJobId(initialJobId)
      setPhaseSync('running')
      openStream(initialJobId)
      return
    }

    // Fresh open — show the agent picker; the job only starts once the user
    // confirms a selection via handleStartRun. (Checklist seeding is handled
    // by the effect above, keyed on `open` so it reseeds every fresh open.)
    setSteps([])
    setPct(0)
    setPhaseSync('selecting')
    setErrorMsg(null)
    setJobId(null)

    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable across the modal's lifetime
  }, [open, siteId, initialJobId])

  const completedCount = steps.filter((s) => s.status === 'done').length

  if (!open) return null

  const isTerminal = phase !== 'selecting' && phase !== 'running' && phase !== 'stopping' && phase !== 'starting'

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={(isTerminal || phase === 'selecting') ? onClose : undefined}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">
                {phase === 'selecting' ? 'Select agents to run' : 'Running agents'}
              </h2>
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">
                {siteName}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {phase === 'running' && (
                <button
                  onClick={handleForceStop}
                  title="Force stop"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-danger hover:bg-danger/10 border border-danger/30 transition-colors"
                >
                  <OctagonX className="h-3.5 w-3.5" />
                  Stop
                </button>
              )}
              {phase === 'stopping' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-danger/70">
                  <Loader2 className="h-3 w-3 animate-spin" /> Stopping…
                </span>
              )}
              {/* Always show X — job continues in background when closed mid-run */}
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-surface dark:hover:bg-surface-dark text-text-secondary dark:text-text-secondary-dark transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {phase === 'selecting' ? (
            <>
              {/* Agent picker */}
              <div className="px-5 pb-2">
                <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark mb-3">
                  Pre-checked to match Agent Configuration — tick or untick just for this run.
                </p>
                <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                  {optionsLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-9 bg-surface dark:bg-surface-dark rounded-lg animate-pulse" />
                    ))
                  ) : (
                    (agentOptions ?? []).map((opt) => (
                      <label
                        key={opt.agent_name}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface dark:hover:bg-surface-dark cursor-pointer transition-colors"
                      >
                        <span
                          role="checkbox"
                          aria-checked={selected.has(opt.agent_name)}
                          onClick={() => toggleAgent(opt.agent_name)}
                          className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                            selected.has(opt.agent_name)
                              ? 'bg-primary border-primary'
                              : 'border-border dark:border-border-dark'
                          )}
                        >
                          {selected.has(opt.agent_name) && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded capitalize',
                          CATEGORY_COLOR[opt.category] ?? 'text-text-secondary bg-surface'
                        )}>
                          {opt.category}
                        </span>
                        <span className="text-[13px] text-text-primary dark:text-text-primary-dark">
                          {opt.label}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-3 border-t border-border dark:border-border-dark flex items-center gap-2">
                <button
                  onClick={handleStartRun}
                  disabled={selected.size === 0}
                  className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Run {selected.size} agent{selected.size === 1 ? '' : 's'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark hover:bg-border dark:hover:bg-border-dark transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Progress bar */}
              <div className="px-5 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    {phase === 'starting'
                      ? 'Starting agents…'
                      : phase === 'done'
                      ? `Completed — ${completedCount} of ${steps.length} agents ran`
                      : phase === 'stopped'
                      ? `Stopped — ${completedCount} of ${steps.length} agents completed`
                      : phase === 'error'
                      ? 'Stopped due to error'
                      : phase === 'stopping'
                      ? 'Finishing current agent…'
                      : `${completedCount} / ${steps.length || selected.size} agents`}
                  </span>
                  <span className={cn(
                    'text-[11px] font-semibold tabular-nums',
                    phase === 'done' ? 'text-success' : (phase === 'error' || phase === 'stopped') ? 'text-danger' : 'text-primary'
                  )}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface dark:bg-surface-dark rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      phase === 'done' ? 'bg-success'
                      : (phase === 'error' || phase === 'stopped') ? 'bg-danger'
                      : phase === 'stopping' ? 'bg-warning'
                      : 'bg-primary'
                    )}
                    animate={{ width: phase === 'starting' ? '4%' : `${pct}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="px-5 pb-4 divide-y divide-border dark:divide-border-dark max-h-72 overflow-y-auto">
                {phase === 'starting' ? (
                  Array.from({ length: selected.size }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="w-5 flex-shrink-0 flex justify-center">
                        <div className="w-3 h-3 rounded-full border-2 border-border dark:border-border-dark" />
                      </div>
                      <div className="h-3 w-32 bg-surface dark:bg-surface-dark rounded animate-pulse" />
                    </div>
                  ))
                ) : (
                  steps.map((step, i) => (
                    step.label
                      ? <StepRow key={i} step={step} />
                      : (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <div className="w-5 flex-shrink-0 flex justify-center">
                            <div className="w-3 h-3 rounded-full border-2 border-border dark:border-border-dark" />
                          </div>
                          <div className="h-3 w-32 bg-surface dark:bg-surface-dark rounded animate-pulse" />
                        </div>
                      )
                  ))
                )}
              </div>

              {/* Running notice — modal can be closed, job continues */}
              {(phase === 'running' || phase === 'stopping') && (
                <div className="mx-5 mb-4 flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    Job runs in the background — safe to close this window.
                  </p>
                </div>
              )}

              {/* Error / stopped message */}
              {(phase === 'error' || phase === 'stopped') && (
                <div className="mx-5 mb-4 flex items-start gap-2 bg-danger/8 border border-danger/20 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-danger">
                    {phase === 'stopped'
                      ? `Run stopped. ${completedCount} of ${steps.length} agents completed — results so far have been saved.`
                      : (errorMsg ?? 'An error occurred')}
                  </p>
                </div>
              )}

              {/* Footer */}
              {isTerminal && (
                <div className="px-5 pb-5 pt-1 border-t border-border dark:border-border-dark">
                  <button
                    onClick={onClose}
                    className={cn(
                      'w-full py-2 rounded-lg text-[13px] font-medium transition-colors',
                      phase === 'done'
                        ? 'bg-success text-white hover:bg-success/90'
                        : 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark hover:bg-border dark:hover:bg-border-dark'
                    )}
                  >
                    {phase === 'done' ? 'Done' : 'Close'}
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
