import { AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAlerts, useDismissAlert } from '@/hooks/useAlerts'

/**
 * Site-level findings about the audit itself — "no Application Password", "the
 * WPScan key was rejected". They are not components and must not be rendered
 * as though they were: fed through the plugin row they came out as a nameless
 * "unknown · v—" entry, which buried a message about vulnerability scanning
 * being switched off entirely.
 */
export default function ComponentNotices({ siteId }: { siteId?: string }) {
  const { data } = useAlerts({
    agent: 'watchdog',
    site_id: siteId,
    // Matches component_audit_unavailable and component_audit_wpscan_auth.
    type: 'component_audit',
    limit: 10,
  })
  const dismiss = useDismissAlert()
  const notices = data ?? []
  if (notices.length === 0) return null

  return (
    <div className="mb-4 flex flex-col gap-2">
      {notices.map((n) => {
        const serious = n.severity === 'critical' || n.severity === 'warning'
        const Icon = serious ? AlertTriangle : Info
        return (
          <div
            key={n.id}
            role="alert"
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4',
              serious
                ? 'border-warning/25 bg-warning/5'
                : 'border-border bg-surface/40 dark:border-border-dark dark:bg-surface-dark'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                serious ? 'bg-warning/10 text-warning' : 'bg-info/10 text-primary dark:text-primary-dark'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
                {n.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary dark:text-text-secondary-dark">
                {n.description}
              </p>
            </div>
            <button
              onClick={() => dismiss.mutate(n.id)}
              aria-label="Dismiss"
              title="Dismiss"
              className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary dark:text-text-secondary-dark dark:hover:bg-surface-dark"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
