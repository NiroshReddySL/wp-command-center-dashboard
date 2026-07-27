import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Sun, Moon, Command, Shield, TrendingUp, Zap, CheckCheck, Globe, FileText, BarChart2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { useNotifications } from '@/hooks/useNotifications'
import { useAcknowledgeAlert } from '@/hooks/useAlerts'
import { get } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'
import StatusDot from '@/components/ui/StatusDot'
import type { AgentType } from '@/lib/constants'

// ── Types ────────────────────────────────────────────────
interface SearchResults {
  sites: { id: string; name: string; url: string; health_score: number; status: string }[]
  alerts: { id: string; title: string; severity: string; agent: string; site_name: string; site_id: string; type: string }[]
  posts: { id: string; title: string; url: string; health_score: number; site_name: string; site_id: string }[]
}

// ── Agent helpers ─────────────────────────────────────────
const AgentIcon = ({ agent }: { agent: AgentType }) => {
  const icons: Record<AgentType, typeof Shield> = { watchdog: Shield, optimizer: TrendingUp, autopilot: Zap, traffic: BarChart2 }
  const Icon = icons[agent] ?? Shield
  return <Icon className="h-3.5 w-3.5" />
}
const agentColor: Record<string, string> = {
  watchdog: 'text-blue-500',
  optimizer: 'text-violet-500',
  autopilot: 'text-emerald-500',
  traffic: 'text-sky-500',
}

// ── Search result row ─────────────────────────────────────
function ResultRow({ icon, label, sub, onClick, badge }: {
  icon: React.ReactNode
  label: string
  sub?: string
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface dark:hover:bg-surface-dark transition-colors text-left"
    >
      <div className="flex-shrink-0 text-text-secondary dark:text-text-secondary-dark">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark truncate">{label}</p>
        {sub && <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">{sub}</p>}
      </div>
      {badge}
    </button>
  )
}

// ── Main Header ───────────────────────────────────────────
export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const { data: notifications } = useNotifications()
  const acknowledge = useAcknowledgeAlert()
  const unreadCount = notifications?.filter((n) => n.status === 'open').length ?? 0

  // Debounced search — only fires when query ≥ 2 chars
  const debouncedQuery = useDebounce(query, 250)
  const { data: results, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => get<SearchResults>('/search', { q: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  })

  const hasResults = results && (results.sites.length + results.alerts.length + results.posts.length) > 0
  const showDropdown = searchOpen && debouncedQuery.length >= 2

  // ⌘K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setQuery('')
        setSearchOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function go(path: string) {
    setQuery('')
    setSearchOpen(false)
    navigate(path)
  }

  function handleNotificationClick(n: { id: string; site_id: string; agent: string }) {
    acknowledge.mutate(n.id)
    setPanelOpen(false)
    if (n.agent === 'watchdog') navigate('/watchdog')
    else if (n.agent === 'optimizer') navigate('/optimizer')
    else if (n.agent === 'autopilot') navigate('/autopilot')
    else navigate(`/sites/${n.site_id}`)
  }

  function markAllRead() {
    notifications?.filter((n) => n.status === 'open').forEach((n) => acknowledge.mutate(n.id))
  }

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-8 py-9 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark sticky top-0 z-20">

      {/* ── Search ── */}
      <div ref={searchBoxRef} className="flex-1 max-w-sm relative">
        <div className={cn(
          'flex items-center gap-2 h-8 px-3 rounded-md border transition-all duration-200',
          'bg-background dark:bg-background-dark',
          searchOpen
            ? 'border-secondary ring-2 ring-secondary/15'
            : 'border-border dark:border-border-dark'
        )}>
          <Search className={cn('h-3.5 w-3.5 flex-shrink-0 transition-colors', searchOpen ? 'text-secondary' : 'text-text-secondary dark:text-text-secondary-dark')} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search sites, alerts, content..."
            className="flex-1 bg-transparent text-[12px] text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary dark:placeholder:text-text-secondary-dark focus:outline-none"
          />
          {query ? (
            <button
              onMouseDown={(e) => { e.preventDefault(); setQuery('') }}
              className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
            >
              <span className="text-[11px]">✕</span>
            </button>
          ) : (
            <div className="flex items-center gap-0.5 text-text-secondary dark:text-text-secondary-dark opacity-60">
              <Command className="h-3 w-3" /><span className="text-[10px]">K</span>
            </div>
          )}
        </div>

        {/* Search dropdown */}
        {showDropdown && (
          <div className="absolute top-10 left-0 w-full min-w-[420px] bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-xl overflow-hidden z-50">
            {isFetching && !hasResults ? (
              <div className="px-4 py-6 text-center text-[12px] text-text-secondary dark:text-text-secondary-dark">
                Searching…
              </div>
            ) : !hasResults ? (
              <div className="px-4 py-6 text-center text-[12px] text-text-secondary dark:text-text-secondary-dark">
                No results for <strong>"{debouncedQuery}"</strong>
              </div>
            ) : (
              <div>
                {/* Sites */}
                {results.sites.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">Sites</p>
                    {results.sites.map((s) => (
                      <ResultRow
                        key={s.id}
                        icon={<Globe className="h-3.5 w-3.5" />}
                        label={s.name}
                        sub={s.url}
                        badge={
                          <span className={cn('text-[10px] font-semibold flex-shrink-0', s.health_score >= 70 ? 'text-success' : s.health_score >= 40 ? 'text-warning' : 'text-danger')}>
                            {s.health_score}
                          </span>
                        }
                        onClick={() => go(`/sites/${s.id}`)}
                      />
                    ))}
                  </div>
                )}

                {/* Alerts */}
                {results.alerts.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">Alerts</p>
                    {results.alerts.map((a) => (
                      <ResultRow
                        key={a.id}
                        icon={<span className={agentColor[a.agent]}><AgentIcon agent={a.agent as AgentType} /></span>}
                        label={a.title}
                        sub={a.site_name}
                        badge={<StatusDot status={a.severity as 'critical' | 'warning' | 'info'} />}
                        onClick={() => go(a.agent === 'watchdog' ? '/watchdog' : a.agent === 'optimizer' ? '/optimizer' : '/autopilot')}
                      />
                    ))}
                  </div>
                )}

                {/* Posts */}
                {results.posts.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide">Content</p>
                    {results.posts.map((p) => (
                      <ResultRow
                        key={p.id}
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label={p.title}
                        sub={p.site_name}
                        badge={
                          <span className={cn('text-[10px] font-semibold flex-shrink-0', p.health_score >= 70 ? 'text-success' : p.health_score >= 40 ? 'text-warning' : 'text-danger')}>
                            {p.health_score}
                          </span>
                        }
                        onClick={() => window.open(p.url, '_blank')}
                      />
                    ))}
                  </div>
                )}

                <div className="px-4 py-2 border-t border-border dark:border-border-dark">
                  <p className="text-[10px] text-text-secondary dark:text-text-secondary-dark">
                    {(results.sites.length + results.alerts.length + results.posts.length)} result{results.sites.length + results.alerts.length + results.posts.length !== 1 ? 's' : ''} · Press <kbd className="text-[9px] bg-surface dark:bg-surface-dark px-1 py-0.5 rounded">Esc</kbd> to close
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-1 relative">
        <button
          onClick={toggleTheme}
          className={cn(
            'h-8 w-8 flex items-center justify-center rounded-md transition-colors duration-200',
            'text-text-secondary dark:text-text-secondary-dark',
            'hover:bg-surface dark:hover:bg-surface-dark hover:text-text-primary dark:hover:text-text-primary-dark'
          )}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Bell */}
        <button
          ref={bellRef}
          onClick={() => setPanelOpen((v) => !v)}
          className={cn(
            'relative h-8 w-8 flex items-center justify-center rounded-md transition-colors duration-200',
            'text-text-secondary dark:text-text-secondary-dark',
            'hover:bg-surface dark:hover:bg-surface-dark hover:text-text-primary dark:hover:text-text-primary-dark',
            panelOpen && 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark'
          )}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification panel */}
        {panelOpen && (
          <div ref={panelRef} className="absolute top-10 right-0 w-[380px] bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold bg-danger/10 text-danger px-1.5 py-0.5 rounded-full">{unreadCount} new</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-border dark:divide-border-dark">
              {!notifications?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell className="h-8 w-8 text-text-secondary dark:text-text-secondary-dark opacity-30" />
                  <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark">All clear</p>
                  <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">No new alerts right now</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors duration-150',
                      'hover:bg-surface/50 dark:hover:bg-surface-dark/50',
                      n.status === 'open' && 'bg-primary/[0.03] dark:bg-primary/[0.06]'
                    )}
                  >
                    <div className="flex-shrink-0 mt-1">
                      <StatusDot status={n.severity} pulse={n.severity === 'critical' && n.status === 'open'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn('flex-shrink-0', agentColor[n.agent])}><AgentIcon agent={n.agent as AgentType} /></span>
                        <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark truncate">{n.title}</p>
                      </div>
                      <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate mb-1">{n.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-surface dark:bg-surface-dark px-1.5 py-0.5 rounded text-text-secondary dark:text-text-secondary-dark">{n.site_name}</span>
                        <span className="text-[10px] text-text-secondary dark:text-text-secondary-dark">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                    {n.status === 'open' && (
                      <div className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary dark:bg-primary-dark" />
                    )}
                  </button>
                ))
              )}
            </div>

            {notifications && notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border dark:border-border-dark">
                <button
                  onClick={() => { navigate('/watchdog'); setPanelOpen(false) }}
                  className="text-[12px] text-primary dark:text-primary-dark hover:underline w-full text-center"
                >
                  View all in Watchdog →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

// ── Debounce hook ─────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const cb = useCallback(() => setDebounced(value), [value])
  useEffect(() => {
    const t = setTimeout(cb, delay)
    return () => clearTimeout(t)
  }, [value, delay, cb])
  return debounced
}
