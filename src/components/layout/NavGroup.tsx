import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavItem } from './navItems'

export const navLinkClasses = (isActive: boolean, nested = false) =>
  cn(
    'flex items-center gap-3 rounded-md transition-all duration-200',
    'text-[13px] font-medium border-l-2',
    nested ? 'py-1.5 pr-3 text-[12.5px]' : 'py-2 pr-3',
    isActive
      ? 'bg-surface dark:bg-surface-dark text-primary dark:text-primary-dark border-primary dark:border-primary-dark'
      : 'text-text-secondary dark:text-text-secondary-dark hover:bg-surface/50 dark:hover:bg-surface-dark hover:text-text-primary dark:hover:text-text-primary-dark border-transparent'
  )

/**
 * A section whose parent is itself a page.
 *
 * The parent stays a link — Traffic is a real destination, not just a folder —
 * so expanding and navigating are separate controls rather than one gesture
 * that has to guess which was meant. The group opens on its own whenever
 * something inside it is active, so arriving by URL or by browser Back never
 * leaves the current page hidden inside a collapsed section.
 */
export default function NavGroup({ item }: { item: NavItem }) {
  const { pathname } = useLocation()
  const children = item.children ?? []
  const holdsCurrentPage =
    pathname === item.to || children.some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = useState(holdsCurrentPage)

  // Re-open on navigation into the section, without collapsing a group the
  // reader opened deliberately.
  useEffect(() => {
    if (holdsCurrentPage) setOpen(true)
  }, [holdsCurrentPage])

  return (
    <div className="mb-0.5">
      <div className="flex items-center">
        <NavLink to={item.to} className={({ isActive }) => cn(navLinkClasses(isActive), 'flex-1 pl-[10px]')}>
          {({ isActive }) => (
            <>
              <item.icon
                className={cn('h-4 w-4 shrink-0', isActive && 'text-primary dark:text-primary-dark')}
              />
              {item.label}
            </>
          )}
        </NavLink>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label} section`}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface/50 hover:text-text-primary dark:text-text-secondary-dark dark:hover:bg-surface-dark dark:hover:text-text-primary-dark"
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
        </button>
      </div>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => cn(navLinkClasses(isActive, true), 'pl-[26px]')}
            >
              {({ isActive }) => (
                <>
                  <child.icon
                    className={cn('h-3.5 w-3.5 shrink-0', isActive && 'text-primary dark:text-primary-dark')}
                  />
                  {child.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
