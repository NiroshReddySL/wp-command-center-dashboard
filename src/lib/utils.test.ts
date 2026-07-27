import { describe, it, expect } from 'vitest'
import { cn, formatNumber, formatPercent, timeAgo, clamp, getHealthColor } from './utils'

describe('cn', () => {
  it('merges conditional classes and resolves tailwind conflicts', () => {
    const isHidden = [].length > 0
    expect(cn('p-2', isHidden && 'hidden', 'p-4')).toBe('p-4')
  })
})

describe('formatNumber', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(1_500)).toBe('1.5K')
    expect(formatNumber(2_300_000)).toBe('2.3M')
  })
})

describe('formatPercent', () => {
  it('formats with the requested precision', () => {
    expect(formatPercent(99.987, 2)).toBe('99.99%')
    expect(formatPercent(50)).toBe('50.0%')
  })
})

describe('timeAgo', () => {
  it('handles nullish input', () => {
    expect(timeAgo(null)).toBe('—')
    expect(timeAgo(undefined)).toBe('—')
  })

  it('renders recent times as relative', () => {
    const now = new Date()
    expect(timeAgo(now)).toBe('just now')
    expect(timeAgo(new Date(now.getTime() - 5 * 60_000))).toBe('5m ago')
    expect(timeAgo(new Date(now.getTime() - 3 * 3_600_000))).toBe('3h ago')
  })
})

describe('clamp', () => {
  it('bounds values to the range', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(42, 0, 100)).toBe(42)
  })
})

describe('getHealthColor', () => {
  it('maps score bands to status colors', () => {
    expect(getHealthColor(95)).toBe('text-success')
    expect(getHealthColor(70)).toBe('text-warning')
    expect(getHealthColor(30)).toBe('text-danger')
  })
})
