import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post, put } from '@/lib/api'

export interface AgentToggle {
  key: string
  label: string
  description: string
  enabled: boolean
}

export interface NotificationPrefs {
  teams_webhook_url: string
  notify_critical: boolean
  weekly_digest: boolean
}

export interface ManualAgentOption {
  agent_name: string
  label: string
  category: string
  default_enabled: boolean
}

/** Agents selectable for a manual "Run agents" trigger, default-checked to
 * match each agent's Agent Configuration toggle. */
export function useManualAgentOptions() {
  return useQuery({
    queryKey: ['agents-manual-options'],
    queryFn: () => get<ManualAgentOption[]>('/agents/manual-options'),
    staleTime: 60_000,
  })
}

export function useAgentToggles() {
  return useQuery({
    queryKey: ['settings-agents'],
    queryFn: () => get<AgentToggle[]>('/settings/agents'),
    staleTime: 60_000,
  })
}

/** Optimistic per-switch update — the UI flips instantly, rolls back on failure. */
export function useUpdateAgentToggle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      put<AgentToggle[]>('/settings/agents', { toggles: { [key]: enabled } }),
    onMutate: async ({ key, enabled }) => {
      await qc.cancelQueries({ queryKey: ['settings-agents'] })
      const previous = qc.getQueryData<AgentToggle[]>(['settings-agents'])
      qc.setQueryData<AgentToggle[]>(['settings-agents'], (old) =>
        old?.map((t) => (t.key === key ? { ...t, enabled } : t))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['settings-agents'], ctx.previous)
    },
    onSuccess: (data) => qc.setQueryData(['settings-agents'], data),
  })
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['settings-notifications'],
    queryFn: () => get<NotificationPrefs>('/settings/notifications'),
  })
}

export function useSaveNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      put<NotificationPrefs>('/settings/notifications', prefs),
    onSuccess: (data) => qc.setQueryData(['settings-notifications'], data),
  })
}

export function useTestTeamsWebhook() {
  return useMutation({
    mutationFn: () => post<{ status: string }>('/settings/notifications/test'),
  })
}
