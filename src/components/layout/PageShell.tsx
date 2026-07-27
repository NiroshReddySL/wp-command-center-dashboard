import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageShellProps {
  title?: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; href?: string }>
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export default function PageShell({ title, subtitle, breadcrumb, actions, children, className }: PageShellProps) {
  const hasHeader = Boolean(title || subtitle || actions || (breadcrumb && breadcrumb.length > 0))

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {hasHeader && (
      <div className="flex items-start justify-between gap-4">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 mb-1.5">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-text-secondary dark:text-text-secondary-dark text-[11px]">/</span>
                  )}
                  <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    {crumb.label}
                  </span>
                </span>
              ))}
            </nav>
          )}
          {title && (
            <h1 className="text-[22px] font-semibold text-text-primary dark:text-text-primary-dark leading-tight">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      )}
      {children}
    </div>
  )
}
