import { useState } from 'react'
import { timeAgo } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { ReviewItem } from '@/hooks/useReviewQueue'

interface ReviewCardProps {
  item: ReviewItem
  onApprove: (id: string, notes?: string) => void
  onReject: (id: string, notes?: string) => void
  isProcessing?: boolean
  isApproving?: boolean
  isRejecting?: boolean
}

const ACTION_LABELS: Record<string, string> = {
  social_post: 'Social Post',
  weekly_report: 'Weekly Report',
  redirect: 'Redirect',
  content_refresh: 'Content Refresh',
  plugin_update: 'Plugin Update',
}

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter / X',
  email: 'Email Newsletter',
  ad: 'Ad Copy',
}

const CHANNEL_COLORS: Record<string, string> = {
  linkedin: 'bg-[#0A66C2]/10 text-[#0A66C2]',
  twitter: 'bg-[#1DA1F2]/10 text-[#1DA1F2]',
  email: 'bg-warning/10 text-warning',
  ad: 'bg-secondary/10 text-secondary',
}

export default function ReviewCard({
  item,
  onApprove,
  onReject,
  isProcessing,
  isApproving,
  isRejecting,
}: ReviewCardProps) {
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const p = item.payload as Record<string, unknown>

  // Determine display content based on action type
  const channel = p.channel as string | undefined
  const postTitle = (p.post_title ?? p.title) as string | undefined
  const postUrl = (p.post_url) as string | undefined
  const contentPreview = (p.content_preview ?? p.content) as string | undefined
  const narrative = p.narrative as string | undefined
  const description = p.description as string | undefined
  const beforeVal = p.before as string | undefined
  const afterVal = p.after as string | undefined
  const stats = p.stats as { alerts_count?: number; health_score?: number } | undefined

  const actionLabel = ACTION_LABELS[item.action_type] ?? item.action_type.replace(/_/g, ' ')

  const approving = isApproving ?? false
  const rejecting = isRejecting ?? false
  const processing = isProcessing ?? approving ?? rejecting

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={item.agent as 'watchdog' | 'optimizer' | 'autopilot'}>{item.agent}</Badge>
          <span className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark capitalize">
            {actionLabel}
          </span>
          {channel && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CHANNEL_COLORS[channel] ?? 'bg-surface text-text-secondary'}`}>
              {CHANNEL_LABELS[channel] ?? channel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark px-2 py-0.5 rounded">
            {item.site_name}
          </span>
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            {timeAgo(item.created_at)}
          </span>
        </div>
      </div>

      {/* Source post reference */}
      {postTitle && (
        <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark mb-2">
          Source:{' '}
          {postUrl ? (
            <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
              {postTitle}
            </a>
          ) : (
            <span className="text-text-primary dark:text-text-primary-dark">{postTitle}</span>
          )}
        </p>
      )}

      {/* Content preview area */}
      {(contentPreview || narrative || description || beforeVal || stats) && (
        <div className="mb-4 rounded-md bg-background dark:bg-background-dark border border-border dark:border-border-dark p-3 space-y-2">
          {description && (
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">{description}</p>
          )}
          {(contentPreview || narrative) && (
            <p className="text-[12px] text-text-primary dark:text-text-primary-dark line-clamp-4 leading-relaxed whitespace-pre-line">
              {contentPreview ?? narrative}
            </p>
          )}
          {beforeVal && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-danger uppercase tracking-wide">Before</span>
                <code className="text-[11px] text-danger bg-danger/5 px-1.5 py-0.5 rounded">{beforeVal}</code>
              </div>
              {afterVal && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-success uppercase tracking-wide">After</span>
                  <code className="text-[11px] text-success bg-success/5 px-1.5 py-0.5 rounded">{afterVal}</code>
                </div>
              )}
            </div>
          )}
          {stats && (
            <div className="flex items-center gap-4 pt-1">
              {stats.alerts_count !== undefined && (
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  <span className="font-semibold text-text-primary dark:text-text-primary-dark">{stats.alerts_count}</span> alerts this week
                </span>
              )}
              {stats.health_score !== undefined && (
                <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  Health score:{' '}
                  <span className={`font-semibold ${stats.health_score >= 70 ? 'text-success' : stats.health_score >= 40 ? 'text-warning' : 'text-danger'}`}>
                    {stats.health_score}/100
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add optional reviewer notes..."
          rows={2}
          className="w-full mb-3 px-3 py-2 text-[12px] rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary dark:placeholder:text-text-secondary-dark focus:outline-none focus:border-secondary resize-none"
        />
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={approving || (!isApproving && processing)}
          onClick={() => onApprove(item.id, notes || undefined)}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={rejecting || (!isRejecting && processing)}
          onClick={() => onReject(item.id, notes || undefined)}
        >
          Reject
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(!showNotes)}
          className="ml-auto"
        >
          {showNotes ? 'Hide notes' : 'Add notes'}
        </Button>
      </div>
    </div>
  )
}
