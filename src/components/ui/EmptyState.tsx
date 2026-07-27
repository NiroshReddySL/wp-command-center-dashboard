import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Button from './Button'

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: ReactNode
  className?: string
}

function DefaultIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="currentColor" className="text-surface dark:text-surface-dark" fillOpacity="0.5" />
      <path
        d="M24 14C18.477 14 14 18.477 14 24C14 29.523 18.477 34 24 34C29.523 34 34 29.523 34 24C34 18.477 29.523 14 24 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-secondary dark:text-text-secondary-dark"
      />
      <path
        d="M24 20V24M24 28H24.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-secondary dark:text-text-secondary-dark"
      />
    </svg>
  )
}

export default function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="mb-4 text-text-secondary dark:text-text-secondary-dark">
        {icon ?? <DefaultIcon />}
      </div>
      <h3 className="text-[15px] font-semibold text-text-primary dark:text-text-primary-dark mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark max-w-sm mb-5">
          {description}
        </p>
      )}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
