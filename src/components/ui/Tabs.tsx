import { createContext, useContext, useState, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  active: string
  setActive: (value: string) => void
  layoutId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>')
  return ctx
}

interface TabsProps {
  defaultValue: string
  value?: string
  children: ReactNode
  className?: string
  onValueChange?: (value: string) => void
}

export function Tabs({ defaultValue, value, children, className, onValueChange }: TabsProps) {
  const [internalActive, setInternalActive] = useState(defaultValue)
  const active = value ?? internalActive
  const layoutId = `tabs-${Math.random().toString(36).slice(2)}`

  const setActive = (v: string) => {
    setInternalActive(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ active, setActive, layoutId }}>
      <div className={cn('', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 border-b border-border dark:border-border-dark',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const { active, setActive, layoutId } = useTabsContext()
  const isActive = active === value

  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        'relative px-4 py-2.5 text-[13px] font-medium transition-colors duration-200',
        isActive
          ? 'text-primary dark:text-primary-dark'
          : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark',
        className
      )}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId={layoutId}
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary dark:bg-primary-dark rounded-full"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
        />
      )}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const { active } = useTabsContext()
  if (active !== value) return null
  return <div className={cn('', className)}>{children}</div>
}
