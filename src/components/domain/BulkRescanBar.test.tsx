import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkRescanBar from './BulkRescanBar'
import type { BulkRescanProgress } from '@/hooks/useOptimizer'

const progress = (over: Partial<BulkRescanProgress> = {}): BulkRescanProgress => ({
  total: 10, done: 10, failed: 0, removed: 0,
  running: false,
  started_at: '2026-08-06T12:38:49Z',
  finished_at: '2026-08-06T12:39:08Z',
  failures: [],
  ...over,
})

const noop = () => {}

describe('BulkRescanBar', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('shows real progress while a batch runs', () => {
    render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false}
        progress={progress({ running: true, done: 3, finished_at: null })} />
    )
    expect(screen.getByText(/Rescanning 3 of 10/)).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('reports the outcome when a batch finishes', () => {
    render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false}
        progress={progress()} />
    )
    expect(screen.getByText(/Rescanned 10 of 10/)).toBeInTheDocument()
  })

  it('clears a clean summary on its own', () => {
    // Regression: the summary reported a finished action and then sat there
    // permanently, with no way to get rid of it.
    render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false}
        progress={progress()} />
    )
    expect(screen.getByText(/Rescanned 10 of 10/)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(10_500) })
    expect(screen.queryByText(/Rescanned 10 of 10/)).not.toBeInTheDocument()
  })

  it('keeps a summary that needs reading', () => {
    // Failures and removals must not scroll past unseen.
    render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false}
        progress={progress({ done: 8, failed: 2, failures: ['abc123: boom'] })} />
    )
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(screen.getByText(/2 failed/)).toBeInTheDocument()
  })

  it('can be dismissed by hand', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false}
        progress={progress({ done: 8, failed: 2 })} />
    )
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/Rescanned 8 of 10/)).not.toBeInTheDocument()
  })

  it('gives way to the selection bar as soon as rows are picked', () => {
    // Regression: selecting new rows after a run left the old summary up.
    render(
      <BulkRescanBar selectedCount={4} onClear={noop} onRescan={noop} starting={false}
        progress={progress()} />
    )
    expect(screen.queryByText(/Rescanned 10 of 10/)).not.toBeInTheDocument()
    expect(screen.getByText('4 selected')).toBeInTheDocument()
  })

  it('shows nothing when there is nothing to say', () => {
    const { container } = render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('treats a fresh run as running even at zero done', () => {
    // The 0% frozen bar came from a stale completed record; an in-flight
    // record at 0 must still render as running, not as a finished summary.
    render(
      <BulkRescanBar selectedCount={0} onClear={noop} onRescan={noop} starting={false}
        progress={progress({ running: true, done: 0, finished_at: null })} />
    )
    expect(screen.getByText(/Rescanning 0 of 10/)).toBeInTheDocument()
    expect(screen.queryByText(/Rescanned/)).not.toBeInTheDocument()
  })
})
