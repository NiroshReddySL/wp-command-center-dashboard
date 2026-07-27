import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, put } from '@/lib/api'

export interface ReviewItem {
  id: string
  alert_id: string | null
  agent: 'watchdog' | 'optimizer' | 'autopilot'
  action_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  site_name: string
  site_id: string
  created_at: string
  reviewed_at: string | null
}

interface ReviewFilters {
  status?: string
  agent?: string
  site_id?: string
}

export function useReviewQueue(filters?: ReviewFilters | string) {
  // Support legacy string usage: useReviewQueue('pending')
  const params: ReviewFilters = typeof filters === 'string' ? { status: filters } : (filters ?? { status: 'pending' })
  if (!params.status) params.status = 'pending'

  return useQuery({
    queryKey: ['review', params],
    queryFn: () => get<ReviewItem[]>('/review', params as Record<string, unknown>),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useApproveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      put<ReviewItem>(`/review/${id}/approve`, { reviewer_notes: notes }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['review'] })
      // Optimistically remove from all cached review queries
      const keys = qc.getQueriesData<ReviewItem[]>({ queryKey: ['review'] })
      const snapshots: Array<{ key: unknown[]; data: ReviewItem[] }> = []
      for (const [key, data] of keys) {
        if (data) {
          snapshots.push({ key: key as unknown[], data })
          qc.setQueryData(key, data.filter((item) => item.id !== id))
        }
      }
      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['review'] }),
  })
}

export function useRejectItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      put<ReviewItem>(`/review/${id}/reject`, { reviewer_notes: notes }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['review'] })
      const keys = qc.getQueriesData<ReviewItem[]>({ queryKey: ['review'] })
      const snapshots: Array<{ key: unknown[]; data: ReviewItem[] }> = []
      for (const [key, data] of keys) {
        if (data) {
          snapshots.push({ key: key as unknown[], data })
          qc.setQueryData(key, data.filter((item) => item.id !== id))
        }
      }
      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['review'] }),
  })
}
