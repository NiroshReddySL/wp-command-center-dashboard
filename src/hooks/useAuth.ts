import { useQuery, useMutation } from '@tanstack/react-query'
import { get, put } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

export interface Me {
  id: string
  email: string
  role: 'admin' | 'member'
  created_at: string
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => get<Me>('/auth/me'),
    enabled: isAuthenticated(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export interface PasswordChangePayload {
  current_password: string
  new_password: string
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: PasswordChangePayload) => put<void>('/auth/me/password', payload),
  })
}
