import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QueryErrorProps {
  /** What failed to load, e.g. "alerts" — rendered as "Couldn't load alerts" */
  what?: string
  onRetry?: () => void
  className?: string
}

/**
 * Explicit failure state for data queries. An ops dashboard must never
 * render "all healthy" empty states when the backend is unreachable.
 */
export default function QueryError({ what = 'data', onRetry, className }: QueryErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-danger/25 bg-danger/5 px-6 py-10 text-center',
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-[18px] w-[18px]" />
      </span>
      <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
        Couldn&apos;t load {what}
      </p>
      <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
        The server didn&apos;t respond. Data shown elsewhere may be stale.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-3 py-1.5 text-[12px] font-medium text-text-primary dark:text-text-primary-dark transition-colors hover:bg-surface dark:hover:bg-surface-dark"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  )
}
