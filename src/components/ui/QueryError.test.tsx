import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QueryError from './QueryError'

describe('QueryError', () => {
  it('announces the failure explicitly', () => {
    render(<QueryError what="alerts" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText("Couldn't load alerts")).toBeInTheDocument()
  })

  it('calls onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn()
    render(<QueryError what="data" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('hides the retry button when no handler is given', () => {
    render(<QueryError />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
