import {
  LayoutDashboard, Shield, TrendingUp, Zap, ClipboardCheck,
  Settings, BarChart2, Radio, GitBranch, FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  icon: LucideIcon
  to: string
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Watchdog', icon: Shield, to: '/watchdog' },
  {
    // Live Visitors and Flow Categories are both readings of the same
    // traffic, so they belong under it rather than beside it. The routes are
    // unchanged, so existing links and bookmarks still resolve.
    label: 'Traffic',
    icon: BarChart2,
    to: '/traffic',
    children: [
      { label: 'Live Visitors', icon: Radio, to: '/live-visitors' },
      { label: 'Flow Categories', icon: GitBranch, to: '/flows' },
    ],
  },
  { label: 'Optimizer', icon: TrendingUp, to: '/optimizer' },
  { label: 'Autopilot', icon: Zap, to: '/autopilot' },
  { label: 'Review Queue', icon: ClipboardCheck, to: '/review' },
  { label: 'Reports', icon: FileText, to: '/reports' },
]

export const bottomItems: NavItem[] = [
  { label: 'Settings', icon: Settings, to: '/settings' },
]
