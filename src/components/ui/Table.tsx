import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type TrProps = HTMLAttributes<HTMLTableRowElement>
type ThProps = ThHTMLAttributes<HTMLTableCellElement>
type TdProps = TdHTMLAttributes<HTMLTableCellElement>

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn('w-full text-[13px]', className)} {...props} />
    </div>
  )
)
Table.displayName = 'Table'

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('', className)} {...props} />
  )
)
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-border dark:divide-border-dark', className)} {...props} />
  )
)
TableBody.displayName = 'TableBody'

export const TableRow = forwardRef<HTMLTableRowElement, TrProps>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'transition-colors duration-150',
        'hover:bg-surface/40 dark:hover:bg-surface-dark',
        'even:bg-background/60 dark:even:bg-transparent',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export const TableHead = forwardRef<HTMLTableCellElement, ThProps>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider',
        'text-text-secondary dark:text-text-secondary-dark',
        'border-b border-border dark:border-border-dark',
        'bg-background dark:bg-background-dark',
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

export const TableCell = forwardRef<HTMLTableCellElement, TdProps>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3 text-text-primary dark:text-text-primary-dark align-middle',
        className
      )}
      {...props}
    />
  )
)
TableCell.displayName = 'TableCell'

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn('mt-4 text-[12px] text-text-secondary dark:text-text-secondary-dark', className)}
      {...props}
    />
  )
)
TableCaption.displayName = 'TableCaption'
