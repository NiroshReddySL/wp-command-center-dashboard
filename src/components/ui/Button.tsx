import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary dark:bg-primary-dark text-white hover:opacity-90 border border-transparent',
  secondary:
    'bg-transparent text-text-primary dark:text-text-primary-dark border border-border dark:border-border-dark hover:bg-surface/50 dark:hover:bg-surface-dark',
  ghost:
    'bg-transparent text-text-secondary dark:text-text-secondary-dark border border-transparent hover:bg-surface dark:hover:bg-surface-dark hover:text-text-primary dark:hover:text-text-primary-dark',
  danger:
    'bg-danger text-white hover:opacity-90 border border-transparent',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-7 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-[13px] rounded-md',
  lg: 'h-10 px-5 text-sm rounded-md',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
