import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BarChart2, Radio, GitBranch } from 'lucide-react'
import NavGroup from './NavGroup'
import type { NavItem } from './navItems'

const TRAFFIC: NavItem = {
  label: 'Traffic',
  icon: BarChart2,
  to: '/traffic',
  children: [
    { label: 'Live Visitors', icon: Radio, to: '/live-visitors' },
    { label: 'Flow Categories', icon: GitBranch, to: '/flows' },
  ],
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavGroup item={TRAFFIC} />
    </MemoryRouter>
  )

describe('NavGroup', () => {
  it('opens itself when a child page is the current one', () => {
    // Arriving by URL or browser Back must never leave the current page
    // hidden inside a collapsed section.
    renderAt('/flows')
    expect(screen.getByRole('link', { name: /flow categories/i })).toBeInTheDocument()
  })

  it('opens itself when the parent page is the current one', () => {
    renderAt('/traffic')
    expect(screen.getByRole('link', { name: /live visitors/i })).toBeInTheDocument()
  })

  it('stays collapsed elsewhere', () => {
    renderAt('/watchdog')
    expect(screen.queryByRole('link', { name: /live visitors/i })).not.toBeInTheDocument()
  })

  it('can be expanded by hand from another page', async () => {
    renderAt('/watchdog')
    await userEvent.click(screen.getByRole('button', { name: /expand traffic/i }))
    expect(screen.getByRole('link', { name: /live visitors/i })).toBeInTheDocument()
  })

  it('keeps the parent navigable rather than turning it into a folder', () => {
    // Traffic is a real page; expanding and navigating are separate controls
    // so neither has to guess which was intended.
    renderAt('/watchdog')
    expect(screen.getByRole('link', { name: /traffic/i })).toHaveAttribute('href', '/traffic')
  })

  it('reports its expanded state to assistive tech', () => {
    renderAt('/flows')
    expect(screen.getByRole('button', { name: /collapse traffic/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
