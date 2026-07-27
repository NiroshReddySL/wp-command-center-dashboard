import { useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import ReviewCard from '@/components/domain/ReviewCard'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import QueryError from '@/components/ui/QueryError'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { useReviewQueue, useApproveItem, useRejectItem } from '@/hooks/useReviewQueue'
import { useSiteContext } from '@/contexts/SiteContext'

export default function ReviewQueue() {
  const [agentFilter, setAgentFilter] = useState('')
  const { selectedSiteId } = useSiteContext()

  const { data: items, isLoading, isError, refetch } = useReviewQueue({
    status: 'pending',
    agent: agentFilter || undefined,
    site_id: selectedSiteId || undefined,
  })
  const approve = useApproveItem()
  const reject = useRejectItem()

  return (
    <PageShell
      title="Review Queue"
      subtitle="Approve or reject actions proposed by your agents."
      actions={
        <div className="flex items-center gap-2">
          <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-40">
            <option value="">All agents</option>
            <option value="watchdog">Watchdog</option>
            <option value="optimizer">Optimizer</option>
            <option value="autopilot">Autopilot</option>
          </Select>
        </div>
      }
    >
      <div className="flex items-center gap-2 -mt-2 mb-2">
        <span className="text-[13px] text-text-secondary dark:text-text-secondary-dark">
          {items?.length ?? 0} items pending review
        </span>
        {items && items.length > 0 && (
          <Badge variant="warning">{items.length}</Badge>
        )}
      </div>

      {isError ? (
        <QueryError what="the review queue" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : !items?.length ? (
        <EmptyState
          title="Queue is empty"
          description="All items have been reviewed. Your agents are working on finding new opportunities."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              onApprove={(id, notes) => approve.mutate({ id, notes })}
              onReject={(id, notes) => reject.mutate({ id, notes })}
              isApproving={approve.isPending && approve.variables?.id === item.id}
              isRejecting={reject.isPending && reject.variables?.id === item.id}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
