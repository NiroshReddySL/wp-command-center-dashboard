import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'h-9 w-full rounded-md border border-border dark:border-border-dark',
              'bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark',
              'px-3 text-[13px] placeholder:text-text-secondary dark:placeholder:text-text-secondary-dark',
              'transition-all duration-200',
              'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon && 'pl-9',
              error && 'border-danger focus:border-danger focus:ring-danger/15',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
