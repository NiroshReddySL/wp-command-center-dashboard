import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './Card'
import TrendIndicator from './TrendIndicator'

type Accent = 'primary' | 'secondary' | 'success' | 'warning' | 'danger'

interface MetricCardProps {
  label: string
  value: string | number
  trend?: number
  trendLabel?: string
  invertTrend?: boolean
  suffix?: string
  icon?: ReactNode
  accent?: Accent
  children?: ReactNode
  className?: string
  valueClassName?: string
}

const accentChip: Record<Accent, string> = {
  primary: 'bg-primary/10 text-primary dark:bg-primary-dark/15 dark:text-primary-dark',
  secondary: 'bg-secondary/15 text-secondary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

const accentGlow: Record<Accent, string> = {
  primary: 'before:bg-primary/[0.07] dark:before:bg-primary-dark/[0.07]',
  secondary: 'before:bg-secondary/[0.08]',
  success: 'before:bg-success/[0.07]',
  warning: 'before:bg-warning/[0.07]',
  danger: 'before:bg-danger/[0.07]',
}

export default function MetricCard({
  label,
  value,
  trend,
  trendLabel,
  invertTrend,
  suffix,
  icon,
  accent,
  children,
  className,
  valueClassName,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        'relative flex flex-col gap-3 p-5 justify-between overflow-hidden',
        'transition-shadow duration-200 hover:shadow-card-hover',
        accent && [
          'before:absolute before:-right-8 before:-top-10 before:h-28 before:w-28 before:rounded-full before:blur-2xl before:content-[""]',
          accentGlow[accent],
        ],
        className
      )}
    >
      <div className="relative flex items-center justify-between">
        <span className="text-[12px] font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">
          {label}
        </span>
        {icon && (
          accent ? (
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accentChip[accent])}>
              {icon}
            </span>
          ) : (
            <span className="text-text-secondary dark:text-text-secondary-dark">{icon}</span>
          )
        )}
      </div>

      <div className="relative flex items-end gap-3">
        <span className={cn('text-[28px] font-semibold leading-none text-text-primary dark:text-text-primary-dark', valueClassName)}>
          {value}
          {suffix && <span className="text-lg ml-0.5">{suffix}</span>}
        </span>

        {trend !== undefined && (
          <div className="mb-0.5 flex items-center gap-1">
            <TrendIndicator value={trend} invertColors={invertTrend} />
            {trendLabel && (
              <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{trendLabel}</span>
            )}
          </div>
        )}
      </div>

      {children && <div className="relative">{children}</div>}
    </Card>
  )
}
