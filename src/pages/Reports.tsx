import { useState } from 'react'
import { Download, FileText, Loader2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react'
import PageShell from '@/components/layout/PageShell'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import QueryError from '@/components/ui/QueryError'
import ReportSection from '@/components/domain/ReportSection'
import { useSiteContext } from '@/contexts/SiteContext'
import { timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useReport, useReports, useGenerateReport } from '@/hooks/useReports'
import { getToken } from '@/lib/auth'

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'opportunity'] as const
const SEVERITY_CLS: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-primary dark:text-primary-dark',
  opportunity: 'text-success',
}

export default function Reports() {
  const { selectedSiteId } = useSiteContext()
  const { data: reports, isLoading, isError, refetch } = useReports(selectedSiteId || undefined)
  const [openId, setOpenId] = useState<string | null>(null)
  const generate = useGenerateReport()

  const currentId = openId ?? reports?.[0]?.id
  const { data: report, isLoading: loadingReport } = useReport(currentId)

  const [exporting, setExporting] = useState(false)

  const openExport = async () => {
    if (!report) return
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/${report.id}/export.html`, {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      })
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank', 'noopener')
      // Revoked once the new tab has had time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setExporting(false)
    }
  }

  const onGenerate = async () => {
    const res = await generate.mutateAsync(selectedSiteId || undefined)
    if (res.report_ids?.[0]) setOpenId(res.report_ids[0])
  }

  return (
    <PageShell
      title="Reports"
      subtitle="Every figure is computed from measured data and says what it counted."
      actions={
        <Button size="sm" onClick={onGenerate} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Generate report
        </Button>
      }
    >
      {isError && <QueryError what="reports" onRetry={() => refetch()} className="mb-4" />}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !reports?.length ? (
        <EmptyState
          title="No reports yet"
          description="Generate one to capture what is true about this site right now."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-1">
            {reports.map((r) => {
              const active = r.id === currentId
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-surface dark:border-primary-dark dark:bg-surface-dark'
                      : 'border-border hover:bg-surface/50 dark:border-border-dark dark:hover:bg-surface-dark'
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {timeAgo(r.generated_at)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-text-secondary dark:text-text-secondary-dark">
                    {SEVERITY_ORDER.filter((s) => r.severity_counts?.[s]).map((s) => (
                      <span key={s} className={SEVERITY_CLS[s]}>
                        {r.severity_counts[s]} {s}
                      </span>
                    ))}
                    {!Object.values(r.severity_counts ?? {}).some(Boolean) && <span>No findings</span>}
                  </p>
                </button>
              )
            })}
          </aside>

          <div>
            {loadingReport || !report ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <>
                <header className="flex flex-wrap items-start justify-between gap-3 pb-2">
                  <div>
                    <h2 className="text-[18px] font-semibold text-text-primary dark:text-text-primary-dark">
                      {report.site_name}
                    </h2>
                    <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark">
                      {report.period_start} → {report.period_end} · generated {timeAgo(report.generated_at)}
                    </p>
                  </div>
                  {/* The export renders the same stored snapshot, so the file
                      and this page can never show different numbers. Fetched
                      with the auth header and opened as a blob rather than
                      linked with a token in the query string, which would put
                      a JWT into browser history and server logs. */}
                  <Button variant="secondary" size="sm" onClick={openExport} disabled={exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Open printable version
                  </Button>
                </header>

                {report.sections.map((s) => <ReportSection key={s.key} section={s} />)}

                <section className="border-t border-border py-8 dark:border-border-dark">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-primary-dark">
                    Appendix / Data coverage
                  </p>
                  <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-text-primary dark:text-text-primary-dark">
                    What this report could and could not measure
                  </h2>
                  <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-secondary dark:text-text-secondary-dark">
                    Nothing above is estimated, inferred or generated. Where a source was
                    unavailable the section says so rather than reporting zero — “measured, and
                    the answer was none” and “we could not look” are different conclusions.
                  </p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {report.sources.map((s) => (
                      <li key={s.key} className="flex items-start gap-2.5 text-[12.5px]">
                        {s.available
                          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                        <span className="text-text-secondary dark:text-text-secondary-dark">
                          <b className="font-medium text-text-primary dark:text-text-primary-dark">{s.label}</b>
                          {' — '}{s.detail}{s.coverage ? ` · ${s.coverage}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
