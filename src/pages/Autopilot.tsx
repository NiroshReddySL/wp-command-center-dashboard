import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, put } from '@/lib/api'
import { Linkedin, Twitter, Mail, Download, Check, Copy, X, Sparkles } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import QueryError from '@/components/ui/QueryError'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import ABTestsComingSoon from '@/components/domain/ABTestsComingSoon'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { useSiteContext } from '@/contexts/SiteContext'
import { useSites } from '@/hooks/useSites'

interface ChannelVariant {
  variant_id: string
  channel: string
  status: string
  content_preview: string
  content: string
}

interface RepurposePost {
  id: string
  title: string
  site_name: string
  channels: ChannelVariant[]
  status: 'pending' | 'approved' | 'published'
}

interface Report {
  id: string
  title: string
  type: 'weekly' | 'monthly'
  generated_at: string
  narrative?: string
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  twitter: Twitter,
  email: Mail,
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter / X',
  email: 'Email',
}

const CHANNEL_COLOR: Record<string, string> = {
  linkedin: 'text-[#0A66C2]',
  twitter: 'text-sky-500',
  email: 'text-violet-600',
}

const statusVariant: Record<string, 'success' | 'warning' | 'info'> = {
  published: 'success',
  approved: 'info',
  pending: 'warning',
}

// ——— Content Preview Modal ———————————————————————————————
interface ContentModalProps {
  variant: ChannelVariant
  postTitle: string
  onClose: () => void
  onApprove: (variantId: string) => void
  isApproving: boolean
}

function ContentModal({ variant, postTitle, onClose, onApprove, isApproving }: ContentModalProps) {
  const [copied, setCopied] = useState(false)
  const Icon = CHANNEL_ICON[variant.channel]

  function copy() {
    navigator.clipboard.writeText(variant.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-border-dark">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`h-4 w-4 ${CHANNEL_COLOR[variant.channel] ?? ''}`} />}
            <span className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">
              {CHANNEL_LABEL[variant.channel] ?? variant.channel} Post
            </span>
            <Badge variant={variant.status === 'approved' ? 'success' : variant.status === 'pending' ? 'warning' : 'default'}>
              {variant.status}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source */}
        <div className="px-5 py-2 border-b border-border dark:border-border-dark bg-background dark:bg-background-dark">
          <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            Source: <span className="text-text-primary dark:text-text-primary-dark">{postTitle}</span>
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed whitespace-pre-line">
            {variant.content}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border dark:border-border-dark">
          {variant.status !== 'approved' && (
            <Button
              variant="primary"
              size="sm"
              loading={isApproving}
              onClick={() => onApprove(variant.variant_id)}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

// ——— Report View Modal ——————————————————————————————————
function ReportModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(report.narrative ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-border-dark">
          <div>
            <p className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">{report.title}</p>
            <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-0.5">{formatDate(report.generated_at)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-secondary hover:bg-surface dark:hover:bg-surface-dark transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {report.narrative ? (
            <p className="text-[13px] text-text-primary dark:text-text-primary-dark leading-relaxed whitespace-pre-line">
              {report.narrative}
            </p>
          ) : (
            <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark italic">No narrative available.</p>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border dark:border-border-dark">
          {report.narrative && (
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy text'}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ——— Main Page ——————————————————————————————————————————
export default function Autopilot() {
  const qc = useQueryClient()
  const [openVariant, setOpenVariant] = useState<{ variant: ChannelVariant; postTitle: string } | null>(null)
  const [openReport, setOpenReport] = useState<Report | null>(null)

  const { selectedSiteId } = useSiteContext()
  const { data: sites } = useSites()
  const selectedSiteName = selectedSiteId ? (sites?.find((s) => s.id === selectedSiteId)?.name ?? null) : null

  const siteParam = selectedSiteId ? { site_id: selectedSiteId } : undefined

  const { data: posts, isLoading: postsLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ['repurposer', selectedSiteId],
    queryFn: () => get<RepurposePost[]>('/autopilot/repurposer', siteParam),
    staleTime: 60_000,
  })

  const { data: reports, isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useQuery({
    queryKey: ['reports', selectedSiteId],
    queryFn: () => get<Report[]>('/autopilot/reports', siteParam),
    staleTime: 60_000,
  })

  const filteredPosts = selectedSiteName ? (posts?.filter((p) => p.site_name === selectedSiteName) ?? []) : (posts ?? [])

  const approveVariant = useMutation({
    mutationFn: (variantId: string) => put<{ status: string }>(`/autopilot/variants/${variantId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repurposer'] })
      qc.invalidateQueries({ queryKey: ['review'] })
      setOpenVariant(null)
    },
  })

  const generateReports = useMutation({
    mutationFn: () =>
      post<{ generated: number; failed: string[] }>('/autopilot/reports/generate',
        selectedSiteId ? { site_id: selectedSiteId } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const anyError = postsError || reportsError
  const retryAll = () => { refetchPosts(); refetchReports() }

  return (
    <PageShell title="Autopilot" subtitle="Automate content repurposing, reporting, and A/B testing.">
      {anyError && <QueryError what="autopilot data" onRetry={retryAll} className="mb-4" />}
      <Tabs defaultValue="repurposer">
        <TabsList className="mb-6">
          <TabsTrigger value="repurposer">Content Repurposer</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="ab-tests">
            A/B Tests
            <Badge variant="info" className="ml-1.5 text-[9px]">Soon</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ——— Content Repurposer ——— */}
        <TabsContent value="repurposer">
          {postsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
          ) : !filteredPosts.length ? (
            <EmptyState
              title="No posts to repurpose"
              description="Autopilot will surface your top-performing posts. Sync a site and run the agents to get started."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {filteredPosts.map((post) => (
                <Card key={post.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark">{post.title}</p>
                      <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark px-2 py-0.5 rounded mt-1 inline-block">
                        {post.site_name}
                      </span>
                    </div>
                    <Badge variant={statusVariant[post.status] ?? 'default'}>{post.status}</Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {post.channels.map((ch) => {
                      const Icon = CHANNEL_ICON[ch.channel]
                      return (
                        <button
                          key={ch.channel}
                          onClick={() => setOpenVariant({ variant: ch, postTitle: post.title })}
                          className="flex items-center gap-2 px-3 py-2 rounded-md border border-border dark:border-border-dark hover:border-secondary/60 hover:bg-surface/40 dark:hover:bg-surface-dark transition-all cursor-pointer"
                        >
                          {Icon && <Icon className={`h-4 w-4 flex-shrink-0 ${CHANNEL_COLOR[ch.channel] ?? ''}`} />}
                          <span className="text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
                            {CHANNEL_LABEL[ch.channel] ?? ch.channel}
                          </span>
                          <Badge
                            variant={ch.status === 'approved' ? 'success' : ch.status === 'pending' ? 'warning' : 'default'}
                            className="text-[9px]"
                          >
                            {ch.status}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ——— Reports ——— */}
        <TabsContent value="reports">
          <div className="flex items-center justify-between gap-4 mb-4">
            <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
              AI-written weekly summaries per site — auto-generated every Friday at 06:00 UTC.
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {generateReports.isSuccess && !generateReports.isPending && (
                <span className="text-[11px] text-success flex items-center gap-1">
                  <Check className="h-3 w-3" /> {generateReports.data.generated} report(s) generated
                </span>
              )}
              <Button variant="primary" size="sm" loading={generateReports.isPending}
                onClick={() => generateReports.mutate()} className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {selectedSiteName ? `Generate for ${selectedSiteName}` : 'Generate report now'}
              </Button>
            </div>
          </div>
          {generateReports.isError && (
            <p className="text-[11px] text-danger mb-3">
              {(generateReports.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                ?? 'Report generation failed. Try again.'}
            </p>
          )}
          {reportsLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !reports?.length ? (
            <EmptyState
              title="No reports yet"
              description="Reports auto-generate every Friday — or create one right now with the button above."
            />
          ) : (
            <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg divide-y divide-border dark:divide-border-dark">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">{report.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="info" className="text-[10px]">{report.type}</Badge>
                      <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
                        {formatDate(report.generated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setOpenReport(report)}>View</Button>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5"
                      onClick={() => {
                        if (report.narrative) {
                          const blob = new Blob([report.narrative], { type: 'text/plain' })
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = `${report.title}.txt`
                          a.click()
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ——— A/B Tests — feature under development ——— */}
        <TabsContent value="ab-tests">
          <ABTestsComingSoon />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {openVariant && (
        <ContentModal
          variant={openVariant.variant}
          postTitle={openVariant.postTitle}
          onClose={() => setOpenVariant(null)}
          onApprove={(id) => approveVariant.mutate(id)}
          isApproving={approveVariant.isPending}
        />
      )}
      {openReport && (
        <ReportModal report={openReport} onClose={() => setOpenReport(null)} />
      )}
    </PageShell>
  )
}
