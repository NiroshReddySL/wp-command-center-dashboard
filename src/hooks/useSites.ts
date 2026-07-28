import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, del } from '@/lib/api'

export interface Site {
  id: string
  name: string
  url: string
  status: 'active' | 'inactive' | 'error'
  health_score: number
  last_synced_at: string | null
  created_at: string
  issues_count?: number
  speed_score?: number
  content_freshness?: number
  content_count?: number
}

export interface CreateSitePayload {
  name: string
  url: string
  api_key: string
}

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: () => get<Site[]>('/sites'),
    staleTime: 30_000,
  })
}

export function useSiteDetail(id: string) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: () => get<Site>(`/sites/${id}`),
    enabled: Boolean(id),
  })
}

export function useAddSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSitePayload) => post<Site>('/sites', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export function useDeleteSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/sites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export interface SyncResult {
  status: string
  site_id: string
  posts_synced: number
  pages_synced: number
  removed: number
  /** "full" the first time (or periodic reconciliation) — "incremental" once a checkpoint exists */
  mode: 'full' | 'incremental'
  last_synced_at: string | null
}

export function useSyncSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, flush = false }: { id: string; flush?: boolean }) =>
      post<SyncResult>(`/sites/${id}/sync?flush=${flush}`),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['sites', id] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['site-performance', id] })
      qc.invalidateQueries({ queryKey: ['site-content', id] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      qc.invalidateQueries({ queryKey: ['priority-queue'] })
    },
  })
}

export function useRunAgents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post<{ status: string; site_id: string }>(`/agents/${id}/run`),
    onSuccess: () => {
      // Invalidate everything so results show up after agents complete
      qc.invalidateQueries()
    },
  })
}
