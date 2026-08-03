import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, post, put } from '@/lib/api'

/**
 * Plugins and themes tracked for a site.
 *
 * Reading them from WordPress needs an Application Password, so a site
 * without one can have its components recorded by hand — `source` says
 * which, and manual rows are the only ones that can be edited here.
 */
export interface SiteComponent {
  id: string
  site_id: string
  component_type: 'plugin' | 'theme'
  slug: string
  name: string | null
  installed_version: string
  latest_version: string
  /** Where latest_version came from. "unknown" means the WordPress.org
   *  directory has no record — normal for premium and in-house components —
   *  so latest mirrors installed and must NOT be read as "up to date". */
  latest_source: 'wporg' | 'manual' | 'unknown'
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  /** null means "not known" — distinct from "installed but inactive". */
  is_active: boolean | null
  source: 'wordpress' | 'manual'
  outdated: boolean
  vulnerability_count: number
  audited_at: string
}

export interface ComponentInput {
  site_id: string
  component_type: 'plugin' | 'theme'
  slug: string
  name?: string
  installed_version: string
  /** Only needed for components WordPress.org does not list — the operator is
   *  then the sole authority on what the newest release is. */
  latest_version?: string
  is_active?: boolean | null
}

export interface ComponentLookup {
  slug: string
  found: boolean
  latest_version: string | null
}

/** Resolve a slug against WordPress.org before saving, so the form can say
 *  up front whether the operator needs to supply the latest version. */
export function useComponentLookup(slug: string, componentType: 'plugin' | 'theme') {
  const cleaned = slug.trim()
  return useQuery({
    queryKey: ['component-lookup', componentType, cleaned.toLowerCase()],
    queryFn: () =>
      get<ComponentLookup>('/watchdog/components/lookup', {
        slug: cleaned,
        component_type: componentType,
      }),
    enabled: cleaned.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useComponents(siteId?: string) {
  return useQuery({
    queryKey: ['components', siteId ?? null],
    queryFn: () =>
      get<SiteComponent[]>('/watchdog/components', siteId ? { site_id: siteId } : undefined),
    staleTime: 15_000,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['components'] })
  // A recorded component changes what the next audit can find, so the alert
  // views are stale too.
  qc.invalidateQueries({ queryKey: ['alerts'] })
  qc.invalidateQueries({ queryKey: ['watchdog-summary'] })
}

export function useAddComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ComponentInput) => post<SiteComponent>('/watchdog/components', input),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<ComponentInput>) =>
      put<SiteComponent>(`/watchdog/components/${id}`, patch),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/watchdog/components/${id}`),
    onSuccess: () => invalidate(qc),
  })
}
