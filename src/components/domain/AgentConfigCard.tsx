import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import QueryError from '@/components/ui/QueryError'
import { useAgentToggles, useUpdateAgentToggle } from '@/hooks/useSettings'

/** Enable/disable scheduled agent runs — persisted server-side and honored by the scheduler. */
export default function AgentConfigCard() {
  const { data: toggles, isLoading, isError, refetch } = useAgentToggles()
  const update = useUpdateAgentToggle()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
          Gates scheduled runs — also the default selection for a manual “Run agents”, which you can override per run
        </span>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex flex-col gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-72" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        )}
        {isError && <QueryError what="agent configuration" onRetry={() => refetch()} />}
        {toggles && (
          <div className="flex flex-col gap-4">
            {toggles.map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
                    {toggle.label}
                  </p>
                  <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    {toggle.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={toggle.enabled}
                  aria-label={toggle.label}
                  onClick={() => update.mutate({ key: toggle.key, enabled: !toggle.enabled })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    toggle.enabled ? 'bg-primary' : 'bg-border dark:bg-border-dark'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      toggle.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
            {update.isError && (
              <p className="text-[11px] text-danger">Couldn’t save — the switch was reverted. Try again.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
