import { cn } from '@/lib/utils'
import type { Severity } from '@/lib/constants'

interface StatusDotProps {
  status: Severity | 'healthy' | 'active' | 'inactive' | 'error'
  pulse?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const colorMap: Record<string, string> = {
  critical: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-primary dark:bg-primary-dark',
  healthy: 'bg-success',
  active: 'bg-success',
  inactive: 'bg-text-secondary',
  error: 'bg-danger',
}

const pulseMap: Record<string, string> = {
  critical: 'animate-ping bg-danger/50',
  error: 'animate-ping bg-danger/50',
  warning: 'animate-ping bg-warning/50',
  healthy: 'animate-ping bg-success/50',
  active: 'animate-ping bg-success/50',
  info: 'animate-ping bg-primary/50',
  inactive: '',
}

export default function StatusDot({ status, pulse = false, size = 'md', className }: StatusDotProps) {
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'

  return (
    <span className={cn('relative inline-flex items-center justify-center', className)}>
      {pulse && pulseMap[status] && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            pulseMap[status]
          )}
        />
      )}
      <span className={cn('relative inline-flex rounded-full', dotSize, colorMap[status] ?? 'bg-text-secondary')} />
    </span>
  )
}
