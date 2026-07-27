import { forwardRef, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'h-9 w-full appearance-none rounded-md border border-border dark:border-border-dark',
              'bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark',
              'pl-3 pr-8 text-[13px]',
              'transition-all duration-200',
              'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-danger',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark pointer-events-none" />
        </div>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
