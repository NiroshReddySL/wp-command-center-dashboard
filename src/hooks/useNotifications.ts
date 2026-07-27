import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api'

export interface Notification {
  id: string
  site_id: string
  site_name: string
  agent: 'watchdog' | 'optimizer' | 'autopilot'
  severity: 'critical' | 'warning'
  type: string
  title: string
  description: string
  status: 'open' | 'acknowledged'
  created_at: string
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<Notification[]>('/notifications'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notification-count'],
    queryFn: () => get<{ count: number }>('/notifications/count'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
