import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/utils'

interface TrendIndicatorProps {
  value: number
  suffix?: string
  className?: string
  invertColors?: boolean
}

export default function TrendIndicator({ value, suffix = '%', className, invertColors = false }: TrendIndicatorProps) {
  const isPositive = value > 0
  const isNeutral = value === 0

  let colorClass: string
  if (isNeutral) {
    colorClass = 'text-text-secondary dark:text-text-secondary-dark'
  } else if (invertColors) {
    colorClass = isPositive ? 'text-danger' : 'text-success'
  } else {
    colorClass = isPositive ? 'text-success' : 'text-danger'
  }

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', colorClass, className)}>
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isNeutral ? '—' : `${isPositive ? '+' : ''}${formatPercent(Math.abs(value), 1)}${suffix !== '%' ? suffix : ''}`}
    </span>
  )
}
