import { type ElementType } from 'react'
import { Shield, TrendingUp, Zap, ChevronRight } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import type { AgentSummary } from '@/hooks/useMetrics'

interface AgentMeta {
  name: string
  tagline: string
  countLabel: string
  Icon: ElementType
  chip: string
  bar: string
}

const META: Record<AgentSummary['agent'], AgentMeta> = {
  watchdog: {
    name: 'Watchdog',
    tagline: 'Uptime, security & broken links',
    countLabel: 'open issues',
    Icon: Shield,
    chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
  optimizer: {
    name: 'Optimizer',
    tagline: 'SEO & content opportunities',
    countLabel: 'opportunities',
    Icon: TrendingUp,
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    bar: 'bg-violet-500',
  },
  autopilot: {
    name: 'Autopilot',
    tagline: 'Drafts awaiting your review',
    countLabel: 'pending',
    Icon: Zap,
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
}

interface AgentStatusCardProps {
  summary: AgentSummary
  onClick: () => void
}

export default function AgentStatusCard({ summary, onClick }: AgentStatusCardProps) {
  const meta = META[summary.agent]
  const { Icon } = meta
  const idle = summary.open_count === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border dark:border-border-dark',
        'bg-card dark:bg-card-dark p-5 text-left shadow-card transition-all duration-200',
        'hover:shadow-card-hover hover:border-secondary/40'
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-0.5', meta.bar, idle && 'opacity-30')} />

      <div className="flex items-start justify-between">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', meta.chip)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <ChevronRight className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </div>

      <div className="mt-3.5">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">
            {meta.name}
          </p>
          {summary.critical_count > 0 && (
            <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
              {summary.critical_count} critical
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-text-secondary dark:text-text-secondary-dark">
          {meta.tagline}
        </p>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-[26px] font-bold leading-none',
              idle ? 'text-success' : 'text-text-primary dark:text-text-primary-dark'
            )}
          >
            {idle ? '✓' : summary.open_count}
          </span>
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            {idle ? 'all clear' : meta.countLabel}
          </span>
        </div>
        <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
          {summary.last_activity_at ? timeAgo(summary.last_activity_at) : 'no activity'}
        </span>
      </div>
    </button>
  )
}
