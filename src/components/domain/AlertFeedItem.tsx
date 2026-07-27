import { Shield, TrendingUp, Zap, BarChart2, X, ChevronRight } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import StatusDot from '@/components/ui/StatusDot'
import Button from '@/components/ui/Button'
import type { Alert } from '@/hooks/useAlerts'
import type { AgentType } from '@/lib/constants'

interface AlertFeedItemProps {
  alert: Alert | {
    id: string
    severity: 'critical' | 'warning' | 'info'
    agent: AgentType
    title: string
    site_name: string
    created_at: string
    action_type?: string
  }
  onAction?: (id: string, action: string) => void
  onDismiss?: (id: string) => void
  onClick?: () => void
  showSite?: boolean
}

const AgentIcon = ({ agent }: { agent: AgentType }) => {
  const icons: Record<AgentType, typeof Shield> = {
    watchdog: Shield,
    optimizer: TrendingUp,
    autopilot: Zap,
    traffic: BarChart2,
  }
  const Icon = icons[agent] ?? Shield
  return <Icon className="h-3.5 w-3.5 flex-shrink-0" />
}

const agentColors: Record<AgentType, string> = {
  watchdog: 'text-blue-600 dark:text-blue-400',
  optimizer: 'text-violet-600 dark:text-violet-400',
  autopilot: 'text-emerald-600 dark:text-emerald-400',
  traffic: 'text-sky-600 dark:text-sky-400',
}

export default function AlertFeedItem({ alert, onAction, onDismiss, onClick, showSite = true }: AlertFeedItemProps) {
  const actionLabel = 'action_type' in alert ? alert.action_type : 'fix'

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-150 group',
        'hover:bg-surface/30 dark:hover:bg-surface-dark',
        onClick && 'cursor-pointer'
      )}
    >
      <StatusDot
        status={alert.severity}
        pulse={alert.severity === 'critical'}
        className="flex-shrink-0"
      />

      <span className={cn('flex-shrink-0', agentColors[alert.agent])}>
        <AgentIcon agent={alert.agent} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-text-primary dark:text-text-primary-dark truncate">
          {alert.title}
        </p>
        {showSite && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark px-1.5 py-0.5 rounded">
              {alert.site_name}
            </span>
          </div>
        )}
      </div>

      <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark flex-shrink-0 whitespace-nowrap">
        {timeAgo(alert.created_at)}
      </span>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onAction && (
          <Button
            variant={actionLabel === 'fix' ? 'primary' : 'secondary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onAction(alert.id, actionLabel ?? 'review')
            }}
            className="text-[11px] gap-0.5"
          >
            {actionLabel === 'fix' ? 'Fix' : 'Review'}
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
        {onDismiss && (
          <button
            type="button"
            title="Dismiss"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss(alert.id)
            }}
            className="p-1.5 rounded-md text-text-secondary dark:text-text-secondary-dark hover:bg-danger/10 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
