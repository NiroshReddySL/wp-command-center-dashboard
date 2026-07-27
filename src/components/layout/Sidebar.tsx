import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Shield, TrendingUp, Zap, ClipboardCheck, Settings, BarChart2, Radio, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import SitePicker from './SitePicker'
import UserProfile from './UserProfile'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Watchdog', icon: Shield, to: '/watchdog' },
  { label: 'Traffic', icon: BarChart2, to: '/traffic' },
  { label: 'Live Visitors', icon: Radio, to: '/live-visitors' },
  { label: 'Flow Categories', icon: GitBranch, to: '/flows' },
  { label: 'Optimizer', icon: TrendingUp, to: '/optimizer' },
  { label: 'Autopilot', icon: Zap, to: '/autopilot' },
  { label: 'Review Queue', icon: ClipboardCheck, to: '/review' },
]

const bottomItems = [
  { label: 'Settings', icon: Settings, to: '/settings' },
]

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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md mb-0.5 transition-all duration-200 group',
                  'text-[13px] font-medium',
                  isActive
                    ? 'bg-surface dark:bg-surface-dark text-primary dark:text-primary-dark border-l-2 border-primary dark:border-primary-dark pl-[10px]'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-surface/50 dark:hover:bg-surface-dark hover:text-text-primary dark:hover:text-text-primary-dark border-l-2 border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary dark:text-primary-dark' : '')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-border dark:border-border-dark px-2 py-3">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200',
                'text-[13px] font-medium',
                isActive
                  ? 'bg-surface dark:bg-surface-dark text-primary dark:text-primary-dark'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:bg-surface/50 dark:hover:bg-surface-dark hover:text-text-primary dark:hover:text-text-primary-dark'
              )
            }
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
