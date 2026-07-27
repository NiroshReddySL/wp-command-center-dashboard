import { describe, it, expect } from 'vitest'
import { getToken, setSession, getUser, clearSession, isAuthenticated } from './auth'

describe('auth session store', () => {
  it('starts unauthenticated', () => {
    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })

  it('stores and returns the session', () => {
    setSession('jwt-token', { email: 'user@example.com', role: 'admin' })
    expect(getToken()).toBe('jwt-token')
    expect(getUser()).toEqual({ email: 'user@example.com', role: 'admin' })
    expect(isAuthenticated()).toBe(true)
  })

  it('clears everything on sign-out', () => {
    setSession('jwt-token', { email: 'user@example.com', role: 'member' })
    clearSession()
    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })

  it('survives corrupted stored user JSON', () => {
    localStorage.setItem('wpcc_user', 'not-json{')
    expect(getUser()).toBeNull()
  })
})
