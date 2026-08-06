import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { BulkRescanProgress } from '@/hooks/useOptimizer'

/**
 * Selection and progress for a bulk rescan.
 *
 * Progress is reported per page rather than as an indeterminate spinner,
 * because a batch of fifty takes minutes — each page costs a WordPress fetch,
 * a live page fetch and an AI call — and a spinner that reveals nothing for
 * that long is indistinguishable from a hang.
 */
export default function BulkRescanBar({
  selectedCount,
  onClear,
  onRescan,
  starting,
  progress,
}: {
  selectedCount: number
  onClear: () => void
  onRescan: () => void
  starting: boolean
  progress?: BulkRescanProgress
}) {
  const running = !!progress?.running
  const settled = (progress?.done ?? 0) + (progress?.failed ?? 0) + (progress?.removed ?? 0)
  const pct = progress?.total ? Math.round((settled / progress.total) * 100) : 0

  // The summary reports a finished action, so it should not sit there
  // indefinitely. Keyed on finished_at so each run gets its own dismissal and
  // the next one is not hidden by the last one having been dismissed. A run
  // that ran into trouble stays until it is read.
  const finishedAt = progress?.running ? null : progress?.finished_at ?? null
  const [dismissed, setDismissed] = useState<string | null>(null)
  const trouble = (progress?.failed ?? 0) + (progress?.removed ?? 0)

  useEffect(() => {
    if (!finishedAt || trouble > 0) return
    const timer = setTimeout(() => setDismissed(finishedAt), 10_000)
    return () => clearTimeout(timer)
  }, [finishedAt, trouble])

  const finished =
    !!progress && !progress.running && progress.total > 0 && dismissed !== finishedAt

  if (running) {
    return (
      <div className="mb-3 rounded-lg border border-border bg-surface/50 p-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Rescanning {settled} of {progress!.total}
          </p>
          <span className="text-[11px] tabular-nums text-text-secondary dark:text-text-secondary-dark">
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border dark:bg-border-dark">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 dark:bg-primary-dark"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark">
          Each page is re-fetched from WordPress and re-analysed, so this takes a moment.
          You can leave this page — it keeps running.
        </p>
      </div>
    )
  }

  if (finished && selectedCount === 0) {
    return (
      <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-border bg-surface/40 p-3 dark:border-border-dark dark:bg-surface-dark">
        {trouble ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
            Rescanned {progress!.done} of {progress!.total}
            {progress!.removed > 0 && ` · ${progress!.removed} no longer on WordPress`}
            {progress!.failed > 0 && ` · ${progress!.failed} failed`}
          </p>
          {progress!.failures?.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {progress!.failures.map((f) => (
                <li key={f} className="truncate font-mono text-[11px] text-text-secondary dark:text-text-secondary-dark" title={f}>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => setDismissed(finishedAt)}
          aria-label="Dismiss"
          className="ml-auto rounded-md p-1 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary dark:text-text-secondary-dark dark:hover:bg-surface-dark"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (selectedCount === 0) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-info/5 p-3 dark:border-primary-dark/30">
      <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
        {selectedCount} selected
      </p>
      <Button size="sm" onClick={onRescan} disabled={starting}>
        {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Rescan selected
      </Button>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-1 text-[12px] text-text-secondary transition-colors hover:text-text-primary dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
      >
        <X className="h-3 w-3" />
        Clear
      </button>
    </div>
  )
}
