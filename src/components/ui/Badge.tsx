import { cn } from '@/lib/utils'

type Variant = 'critical' | 'warning' | 'info' | 'success' | 'default' | 'watchdog' | 'optimizer' | 'autopilot'

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<Variant, string> = {
  critical: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-primary dark:text-primary-dark',
  success: 'bg-success/10 text-success',
  default: 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark',
  watchdog: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  optimizer: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  autopilot: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
}

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2.5 py-0.5 text-[11px] font-medium leading-none',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
