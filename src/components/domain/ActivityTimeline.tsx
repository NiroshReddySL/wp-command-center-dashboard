import { type ElementType } from 'react'
import { Shield, TrendingUp, Zap, ArrowUpRight, BarChart2 } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { ActivityItem } from '@/hooks/useMetrics'
import type { AgentType } from '@/lib/constants'

interface ActivityTimelineProps {
  items: ActivityItem[]
}

const AgentIcon = ({ agent }: { agent: AgentType }) => {
  const config: Record<string, { Icon: ElementType; color: string }> = {
    watchdog: { Icon: Shield, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
    optimizer: { Icon: TrendingUp, color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' },
    autopilot: { Icon: Zap, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
    traffic: { Icon: BarChart2, color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' },
  }
  const { Icon, color } = config[agent] ?? config['watchdog']
  return (
    <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  )
}

export default function ActivityTimeline({ items }: ActivityTimelineProps) {
  if (!items.length) {
    return (
      <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark text-center py-6">
        No recent activity
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-3 group">
          <div className="flex flex-col items-center">
            <AgentIcon agent={item.agent} />
            {i < items.length - 1 && (
              <div className="w-px flex-1 mt-1.5 mb-1 bg-border dark:bg-border-dark" />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] text-text-primary dark:text-text-primary-dark leading-snug">
                {item.description}
              </p>
              {item.link && (
                <a
                  href={item.link}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark px-1.5 py-0.5 rounded">
                {item.site_name}
              </span>
              <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
                {timeAgo(item.created_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
