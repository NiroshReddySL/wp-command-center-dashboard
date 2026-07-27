import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            'absolute z-50 whitespace-nowrap pointer-events-none',
            'bg-card dark:bg-card-dark border border-border dark:border-border-dark',
            'rounded-md shadow-dropdown px-2.5 py-1.5',
            'text-[11px] text-text-primary dark:text-text-primary-dark',
            'animate-fade-in',
            positionClasses[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
