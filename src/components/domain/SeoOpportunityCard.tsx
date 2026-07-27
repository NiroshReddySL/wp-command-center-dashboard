import { ArrowUpRight, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

export interface SeoOpportunity {
  id: string
  page_title: string
  page_url: string
  word_count?: number | null
  ai_recommendation: string
  site_name: string
  severity: 'critical' | 'warning' | 'info'
}

interface SeoOpportunityCardProps {
  opportunity: SeoOpportunity
  onViewAnalysis?: () => void
}

const severityVariant: Record<string, 'critical' | 'warning' | 'info'> = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
}

export default function SeoOpportunityCard({ opportunity, onViewAnalysis }: SeoOpportunityCardProps) {
  const Icon = opportunity.severity === 'warning' || opportunity.severity === 'critical'
    ? AlertTriangle
    : Info

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-5 hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark line-clamp-1">
            {opportunity.page_title}
          </p>
          <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate mt-0.5">
            {opportunity.page_url}
          </p>
        </div>
        <Badge variant={severityVariant[opportunity.severity] ?? 'info'} className="flex-shrink-0 flex items-center gap-1">
          <Icon className="h-3 w-3" />
          {opportunity.severity}
        </Badge>
      </div>

      {opportunity.word_count != null && (
        <div className="mb-3">
          <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-0.5">
            Word count
          </p>
          <p className={cn(
            'text-[13px] font-semibold',
            opportunity.word_count < 300 ? 'text-danger' : opportunity.word_count < 800 ? 'text-warning' : 'text-success'
          )}>
            {opportunity.word_count.toLocaleString()} words
          </p>
        </div>
      )}

      <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark line-clamp-3 mb-4">
        {opportunity.ai_recommendation}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-secondary dark:bg-surface-dark bg-surface px-2 py-0.5 rounded">
          {opportunity.site_name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewAnalysis?.()}
          className="flex items-center gap-1"
        >
          View <ArrowUpRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
