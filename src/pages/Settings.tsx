import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Eye, EyeOff, Trash2, CheckCircle, AlertCircle, Zap, TriangleAlert } from 'lucide-react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import PageShell from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import StatusDot from '@/components/ui/StatusDot'
import Modal from '@/components/ui/Modal'
import { useSites, useAddSite, useDeleteSite, useSyncSite, SyncResult } from '@/hooks/useSites'
import AgentProgressModal from '@/components/domain/AgentProgressModal'
import AgentConfigCard from '@/components/domain/AgentConfigCard'
import NotificationPrefsCard from '@/components/domain/NotificationPrefsCard'
import { useGoogleStatus } from '@/hooks/useMetrics'
import { get, post, put, del } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteConfigFields {
  ga_property_id: string | null
  gsc_site_url: string | null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MaskedInput({ label, placeholder, value, onChange, error }: {
  label: string; placeholder: string; value: string
  onChange: (value: string) => void; error?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark px-3 pr-10 text-[13px] placeholder:text-text-secondary dark:placeholder:text-text-secondary-dark focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15"
        />
        <button type="button" onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark">
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  )
}

function SyncBadge({ result }: { result: SyncResult }) {
  const parts = [`${result.posts_synced} post${result.posts_synced === 1 ? '' : 's'}`]
  if (result.pages_synced > 0) parts.push(`${result.pages_synced} page${result.pages_synced === 1 ? '' : 's'}`)
  if (result.removed > 0) parts.push(`${result.removed} removed`)
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-success">
      <CheckCircle className="h-3.5 w-3.5" />
      Synced {parts.join(', ')}
      {result.mode === 'incremental' && <span className="text-text-secondary dark:text-text-secondary-dark">(incremental)</span>}
    </span>
  )
}

/** Per-site GA / GSC config row — fetches its own saved values */
function SiteConfigRow({ siteId, siteName }: { siteId: string; siteName: string }) {
  const qc = useQueryClient()

  const { data: saved } = useQuery({
    queryKey: ['site-config', siteId],
    queryFn: () => get<SiteConfigFields>(`/sites/${siteId}/config`),
  })

  const [ga, setGa] = useState('')
  const [gsc, setGsc] = useState('')

  // Pre-fill inputs once saved data loads
  useEffect(() => {
    if (saved) {
      setGa(saved.ga_property_id ?? '')
      setGsc(saved.gsc_site_url ?? '')
    }
  }, [saved])

  const save = useMutation({
    mutationFn: () => put<SiteConfigFields>(`/sites/${siteId}/config`, {
      ga_property_id: ga || null,
      gsc_site_url: gsc || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-config', siteId] })
      qc.invalidateQueries({ queryKey: ['traffic-overview'] })
    },
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">{siteName}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="GA4 Property ID" placeholder="properties/123456789"
          value={ga} onChange={(e) => setGa(e.target.value)} />
        <Input label="GSC Site URL" placeholder="https://myblog.com/"
          value={gsc} onChange={(e) => setGsc(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
        {save.isSuccess && (
          <span className="text-[11px] text-success flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}

function GoogleIntegrationCard() {
  const qc = useQueryClient()
  const { data: status, isLoading } = useGoogleStatus()
  const { data: sites } = useSites()
  const [refreshError, setRefreshError] = useState('')
  const [refreshOk, setRefreshOk] = useState(false)

  const disconnect = useMutation({
    mutationFn: () => del<void>('/auth/google'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-status'] }),
  })

  const refresh = useMutation({
    mutationFn: () => post<{ status: string; message: string }>('/auth/google/refresh'),
    onSuccess: () => {
      setRefreshError('')
      setRefreshOk(true)
      qc.invalidateQueries({ queryKey: ['google-status'] })
      setTimeout(() => setRefreshOk(false), 4000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setRefreshError(msg ?? 'Refresh failed — please reconnect.')
      // A dead refresh token means the backend already cleared the connection —
      // reflect that immediately instead of waiting for the next poll.
      qc.invalidateQueries({ queryKey: ['google-status'] })
    },
  })

  const handleConnect = async () => {
    const data = await get<{ url: string }>('/auth/google')
    window.location.href = data.url
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Integration</CardTitle>
        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">Analytics · Search Console</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`h-2 w-2 rounded-full ${
              !status?.connected ? 'bg-border dark:bg-border-dark'
              : status.missing_scopes?.length ? 'bg-warning' : 'bg-success'
            }`} />
            <div>
              <span className="text-[13px] text-text-primary dark:text-text-primary-dark">
                {isLoading ? 'Checking…'
                  : !status?.connected ? 'Not connected'
                  : status.missing_scopes?.length ? 'Connected, but missing permissions'
                  : 'Connected to Google'}
              </span>
              {status?.connected && status.expires_at && (
                <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                  Access token valid until {new Date(status.expires_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          {status?.connected ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" loading={refresh.isPending}
                onClick={() => refresh.mutate()} className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="ghost" size="sm" loading={disconnect.isPending}
                onClick={() => disconnect.mutate()} className="text-danger hover:bg-danger/10">
                Disconnect
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={handleConnect}>Connect Google</Button>
          )}
        </div>

        {!!status?.missing_scopes?.length && (
          <div role="alert" className="rounded-lg border border-warning/25 bg-warning/5 p-3">
            <p className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
              {!status.analytics && !status.search_console
                ? 'Analytics and Search Console access was not granted'
                : !status.analytics
                  ? 'Analytics access was not granted'
                  : 'Search Console access was not granted'}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-secondary dark:text-text-secondary-dark">
              The connection works, but Google refuses every data request with a
              permissions error, so traffic, flows and Search Console panels stay
              empty. Reconnect and make sure the Google Analytics and Search
              Console checkboxes stay ticked on the consent screen.
            </p>
            <Button variant="primary" size="sm" onClick={handleConnect} className="mt-2.5">
              Reconnect Google
            </Button>
          </div>
        )}

        {refreshOk && (
          <p className="text-[11px] text-success flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Connection refreshed.
          </p>
        )}
        {refreshError && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-danger bg-danger/8 rounded-md px-3 py-2">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {refreshError}
            </span>
            {!status?.connected && (
              <Button variant="primary" size="sm" onClick={handleConnect}>Reconnect</Button>
            )}
          </div>
        )}

        {!status?.connected && !isLoading && (
          <div className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark rounded-md p-3 space-y-1.5">
            <p className="font-medium text-text-primary dark:text-text-primary-dark">Before connecting:</p>
            <p>
              Add{' '}
              <code className="bg-border/50 dark:bg-border-dark/50 px-1 py-0.5 rounded text-[10px]">
                http://localhost:8000/api/auth/google/callback
              </code>{' '}
              as an Authorised redirect URI in your{' '}
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer"
                className="text-primary dark:text-primary-dark underline">
                Google Cloud Console
              </a>{' '}
              OAuth2 credentials.
            </p>
          </div>
        )}

        {status?.connected && sites && sites.length > 0 && (
          <div className="flex flex-col gap-5 pt-2 border-t border-border dark:border-border-dark">
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
              Enter your GA4 Property ID (e.g.{' '}
              <code className="bg-surface dark:bg-surface-dark px-1 rounded">properties/123456789</code>)
              and GSC site URL to enable real traffic and ranking data.
            </p>
            {sites.map((site) => (
              <SiteConfigRow key={site.id} siteId={site.id} siteName={site.name} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const [showAddSite, setShowAddSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', url: '', api_key: '' })
  const [requireApiKey, setRequireApiKey] = useState(true)
  const [addError, setAddError] = useState('')
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({})
  const [resetConfirm, setResetConfirm] = useState(false)

  const [agentModal, setAgentModal] = useState<{ siteId: string; siteName: string } | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: sites } = useSites()
  const addSite = useAddSite()
  const deleteSite = useDeleteSite()
  const sync = useSyncSite()
  const qc = useQueryClient()
  const resetAll = useMutation({
    mutationFn: () => post('/admin/reset', {}),
    onSuccess: () => {
      qc.clear()
      setResetConfirm(false)
    },
  })

  const handleAddSite = async () => {
    setAddError('')
    if (!newSite.name.trim()) { setAddError('Site name is required'); return }
    if (!newSite.url.trim()) { setAddError('Site URL is required'); return }
    if (requireApiKey && !newSite.api_key.trim()) { setAddError('Application password is required'); return }
    const url = newSite.url.trim().replace(/\/$/, '')
    try {
      await addSite.mutateAsync({ ...newSite, api_key: requireApiKey ? newSite.api_key : '', url })
      setNewSite({ name: '', url: '', api_key: '' })
      setShowAddSite(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setAddError(msg ?? 'Failed to connect to WordPress. Check the URL and application password.')
    }
  }

  const handleSync = async (siteId: string) => {
    try {
      const result = await sync.mutateAsync({ id: siteId })
      setSyncResults((prev) => ({ ...prev, [siteId]: result }))
      setTimeout(() => setSyncResults((prev) => { const n = { ...prev }; delete n[siteId]; return n }), 5000)
    } catch { /* handled by mutation */ }
  }

  return (
    <PageShell title="Settings" subtitle="Configure your sites, API keys, and agent behavior.">

      {/* Connected Sites */}
      <Card className="p-0">
        <CardHeader className="px-6 pt-5 pb-4 border-b border-border dark:border-border-dark mb-0">
          <CardTitle>Connected Sites</CardTitle>
          <Button variant="primary" size="sm" onClick={() => { setAddError(''); setShowAddSite(true) }}
            className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add site
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!sites?.length ? (
            <p className="text-center py-10 text-[13px] text-text-secondary dark:text-text-secondary-dark">
              No sites connected yet. Add your first WordPress site above.
            </p>
          ) : (
            <div className="divide-y divide-border dark:divide-border-dark">
              {sites.map((site) => (
                <div key={site.id} className="flex items-center gap-4 px-6 py-4">
                  <StatusDot
                    status={site.status === 'active' ? 'healthy' : site.status === 'error' ? 'critical' : 'inactive'}
                    pulse={site.status === 'error'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">{site.name}</p>
                    <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{site.url}</p>
                    {site.status === 'error' && (
                      <p className="text-[11px] text-danger flex items-center gap-1 mt-0.5">
                        <AlertCircle className="h-3 w-3" /> Connection failed — check URL and credentials
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {syncResults[site.id] && <SyncBadge result={syncResults[site.id]} />}
                    <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                      {site.last_synced_at ? `Synced ${timeAgo(site.last_synced_at)}` : 'Never synced'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm"
                      loading={sync.isPending && sync.variables?.id === site.id}
                      onClick={() => handleSync(site.id)} className="flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" /> Sync
                    </Button>
                    <Button variant="secondary" size="sm"
                      onClick={() => setAgentModal({ siteId: site.id, siteName: site.name })}
                      className="flex items-center gap-1.5" title="Choose agents to run">
                      <Zap className="h-3 w-3" /> Run agents
                    </Button>
                    <Button variant="ghost" size="sm"
                      loading={deleteSite.isPending && deleteSite.variables === site.id}
                      onClick={() => deleteSite.mutate(site.id)}
                      className="text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Integration */}
      <GoogleIntegrationCard />

      {/* Agent Configuration — server-persisted, honored by the scheduler */}
      <AgentConfigCard />

      {/* Notifications — MS Teams webhook + alert/digest prefs */}
      <NotificationPrefsCard />

      {/* Brand Voice */}
      <Card>
        <CardHeader><CardTitle>Brand Voice</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark mb-3">
            Describe your brand voice. Autopilot uses this when generating content variants.
          </p>
          <textarea rows={5}
            defaultValue="We communicate in a professional yet approachable tone. We're experts but don't talk down to our audience. We focus on practical, actionable insights without buzzwords or jargon."
            className="w-full px-3 py-2 text-[13px] rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:border-secondary resize-none"
          />
          <Button variant="primary" size="md" className="mt-3">Save Brand Guide</Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div className="border border-danger/30 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <TriangleAlert className="h-4 w-4 text-danger" />
          <h3 className="text-[14px] font-semibold text-danger">Danger Zone</h3>
        </div>
        <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark mb-4">
          These actions are irreversible. All collected data — sites, snapshots, alerts, predictions, content — will be permanently deleted.
        </p>
        {resetConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-danger font-medium">Are you absolutely sure?</span>
            <Button
              variant="ghost"
              size="sm"
              loading={resetAll.isPending}
              onClick={() => resetAll.mutate()}
              className="border border-danger text-danger hover:bg-danger/10"
            >
              Yes, delete everything
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setResetConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetConfirm(true)}
            className="flex items-center gap-1.5 border border-danger/40 text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Reset All Data
          </Button>
        )}
        {resetAll.isSuccess && (
          <p className="text-[11px] text-success mt-2 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> All data deleted. Add a site in Connected Sites to start fresh.
          </p>
        )}
      </div>

      {/* Add Site Modal */}
      <Modal open={showAddSite} onClose={() => { setShowAddSite(false); setAddError(''); setRequireApiKey(true) }} title="Add WordPress Site">
        <div className="flex flex-col gap-4">
          <Input label="Site Name" placeholder="My WordPress Blog"
            value={newSite.name} onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))} />
          <Input label="Site URL" placeholder="https://myblog.com" type="url"
            value={newSite.url} onChange={(e) => setNewSite((s) => ({ ...s, url: e.target.value }))} />
          {/* Toggle: require API key */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">Application Password</p>
              <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                Required for write access (sync, repurpose). Optional for read-only monitoring.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requireApiKey}
              onClick={() => { setRequireApiKey((v) => !v); setNewSite((s) => ({ ...s, api_key: '' })) }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${requireApiKey ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${requireApiKey ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {requireApiKey && (
            <>
              <MaskedInput label="WordPress Application Password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={newSite.api_key} onChange={(val) => setNewSite((s) => ({ ...s, api_key: val }))} />
              <div className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark rounded-md p-3">
                <p className="font-medium text-text-primary dark:text-text-primary-dark mb-1">How to get an Application Password:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Log in to your WordPress admin (wp-admin)</li>
                  <li>Go to Users → Your Profile</li>
                  <li>Scroll down to Application Passwords</li>
                  <li>Enter a name → click Add New</li>
                  <li>Copy the generated password here</li>
                </ol>
              </div>
            </>
          )}
          {!requireApiKey && (
            <p className="text-[11px] text-warning flex items-center gap-1.5 bg-warning/10 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Without an application password, content sync and write features will be unavailable.
            </p>
          )}
          {addError && (
            <p className="text-[12px] text-danger flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {addError}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button variant="primary" onClick={handleAddSite} loading={addSite.isPending}>
              Connect Site
            </Button>
            <Button variant="ghost" onClick={() => { setShowAddSite(false); setAddError('') }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <AgentProgressModal
        open={Boolean(agentModal)}
        siteId={agentModal?.siteId ?? null}
        siteName={agentModal?.siteName ?? ''}
        initialJobId={activeJobId}
        onJobStart={(jid) => setActiveJobId(jid)}
        onClose={() => setAgentModal(null)}
        onComplete={() => {
          setActiveJobId(null)
          qc.invalidateQueries()
          setAgentModal(null)
        }}
      />
    </PageShell>
  )
}
