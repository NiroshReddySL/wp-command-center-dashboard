export const ROUTES = {
  DASHBOARD: '/',
  WATCHDOG: '/watchdog',
  OPTIMIZER: '/optimizer',
  AUTOPILOT: '/autopilot',
  REVIEW_QUEUE: '/review',
  SITE_DETAIL: '/sites/:siteId',
  SETTINGS: '/settings',
} as const

export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
} as const

export const AGENT_TYPE = {
  WATCHDOG: 'watchdog',
  OPTIMIZER: 'optimizer',
  AUTOPILOT: 'autopilot',
  TRAFFIC: 'traffic',
} as const

export const STATUS = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export const CHANNELS = {
  LINKEDIN: 'linkedin',
  TWITTER: 'twitter',
  EMAIL: 'email',
  AD: 'ad',
} as const

export const SITE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
} as const

export const CHART_COLORS = [
  '#0129AC',
  '#809EFC',
  '#059669',
  '#D97706',
  '#DC2626',
  '#6366F1',
] as const

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY]
export type AgentType = (typeof AGENT_TYPE)[keyof typeof AGENT_TYPE]
export type AlertStatus = (typeof STATUS)[keyof typeof STATUS]
export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS]
export type SiteStatus = (typeof SITE_STATUS)[keyof typeof SITE_STATUS]
