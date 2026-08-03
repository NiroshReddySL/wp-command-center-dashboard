import type { SiteComponent } from '@/hooks/useComponents'

/**
 * The four states a tracked plugin or theme can be in.
 *
 * `untracked` exists because it is NOT the same as `current`, though the raw
 * data makes them look identical: both have latest_version equal to
 * installed_version. One means "checked, nothing newer exists"; the other
 * means "the WordPress.org directory has never heard of this, so nobody has
 * checked anything" — which is the normal case for premium and in-house
 * components like Avada or Swift Performance.
 */
export type ComponentStatus = 'vulnerable' | 'outdated' | 'untracked' | 'current'

export interface StatusMeta {
  /** Sort weight — most serious first. */
  rank: number
  label: string
  /** Tailwind text colour. Always paired with an icon and this label: the
   *  brand's warning and danger hues sit at ΔE 14.4, which is too close to
   *  carry meaning on their own. */
  tone: string
  /** Background tint for badges. */
  tint: string
}

export const STATUS_META: Record<ComponentStatus, StatusMeta> = {
  vulnerable: {
    rank: 0,
    label: 'Vulnerable',
    tone: 'text-danger',
    tint: 'bg-danger/10',
  },
  outdated: {
    rank: 1,
    label: 'Update available',
    tone: 'text-warning',
    tint: 'bg-warning/10',
  },
  untracked: {
    rank: 2,
    label: 'Not tracked',
    tone: 'text-text-secondary dark:text-text-secondary-dark',
    tint: 'bg-surface dark:bg-surface-dark',
  },
  current: {
    rank: 3,
    label: 'Up to date',
    tone: 'text-success',
    tint: 'bg-success/10',
  },
}

export function statusOf(c: SiteComponent): ComponentStatus {
  if (c.vulnerability_count > 0) return 'vulnerable'
  if (c.outdated) return 'outdated'
  // Deliberately ahead of `current`: an unresolved latest version is an
  // absence of information, never a clean bill of health.
  if (c.latest_source === 'unknown') return 'untracked'
  return 'current'
}

/** Most serious first, then by name so the order is stable between renders. */
export function byRisk(a: SiteComponent, b: SiteComponent): number {
  const d = STATUS_META[statusOf(a)].rank - STATUS_META[statusOf(b)].rank
  if (d !== 0) return d
  return (a.name ?? a.slug).localeCompare(b.name ?? b.slug)
}

export interface StatusCounts {
  total: number
  vulnerable: number
  outdated: number
  untracked: number
  current: number
}

export function countByStatus(components: SiteComponent[]): StatusCounts {
  const counts: StatusCounts = {
    total: components.length,
    vulnerable: 0,
    outdated: 0,
    untracked: 0,
    current: 0,
  }
  for (const c of components) counts[statusOf(c)] += 1
  return counts
}
