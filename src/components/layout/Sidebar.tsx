import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import SitePicker from './SitePicker'
import UserProfile from './UserProfile'
import NavGroup, { navLinkClasses } from './NavGroup'
import { navItems, bottomItems, type NavItem } from './navItems'

function Logo() {
  return (
    <div className="flex items-center gap-3 px-4 py-5 border-b border-border dark:border-border-dark">
      <div className="h-8 w-8 rounded-md bg-primary dark:bg-primary-dark flex items-center justify-center flex-shrink-0">
        <span className="text-white text-[11px] font-bold">CF</span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark truncate leading-none mb-0.5">
          WP Command Center
        </p>
        <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark truncate leading-none">
          CloudFuze
        </p>
      </div>
    </div>
  )
}

function NavRow({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => cn(navLinkClasses(isActive), 'mb-0.5 pl-[10px]')}
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn('h-4 w-4 shrink-0', isActive && 'text-primary dark:text-primary-dark')}
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] flex flex-col bg-background dark:bg-background-dark border-r border-border dark:border-border-dark z-30">
      <Logo />
      <SitePicker />

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="mb-4">
          <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-secondary dark:text-text-secondary-dark">
            Navigation
          </p>
          {navItems.map((item) =>
            item.children?.length
              ? <NavGroup key={item.to} item={item} />
              : <NavRow key={item.to} item={item} />
          )}
        </div>
      </nav>

      <div className="border-t border-border dark:border-border-dark px-2 py-3">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(navLinkClasses(isActive), 'pl-[10px]')}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}

        <UserProfile />
      </div>
    </aside>
  )
}
