import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@/lib/api'

export interface ReportMetric {
  label: string
  value: number | string | null
  /** What was counted. Shown beside every figure — without it a reader
   *  cannot tell whether two reports disagree or count different things. */
  basis: string
  sub?: string
  unit?: string
}

export interface ReportFinding {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'opportunity'
  evidence: string
  implication: string
  actions: string[]
  measures: string[]
  effort: string
}

export interface ReportTable {
  title: string
  columns: string[]
  rows: string[][]
  note?: string
}

export interface ReportSection {
  key: string
  number: string
  title: string
  headline: string
  metrics: ReportMetric[]
  findings: ReportFinding[]
  tables: ReportTable[]
  notes: string[]
  /** Set when the section could not be produced. The page renders this
   *  reason instead of the content — never zeros. */
  unavailable: string | null
}

export interface ReportSource {
  key: string
  label: string
  available: boolean
  detail: string
  coverage?: string
}

export interface FullReport {
  id: string
  site_id: string
  site_name: string
  site_url: string
  period_start: string
  period_end: string
  generated_at: string
  severity_counts: Record<string, number>
  sources: ReportSource[]
  sections: ReportSection[]
}

export interface ReportSummary {
  id: string
  site_id: string
  title: string
  generated_at: string
  severity_counts: Record<string, number>
  unavailable_sources: number
}

export function useReports(siteId?: string) {
  return useQuery({
    queryKey: ['reports', siteId ?? null],
    queryFn: () => get<ReportSummary[]>('/reports', siteId ? { site_id: siteId } : undefined),
    staleTime: 30_000,
  })
}

export function useReport(reportId?: string) {
  return useQuery({
    queryKey: ['report', reportId],
    queryFn: () => get<FullReport>(`/reports/${reportId}`),
    enabled: !!reportId,
    // A stored snapshot never changes, so there is nothing to refetch for.
    staleTime: Infinity,
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (siteId?: string) =>
      post<{ report_ids: string[] }>('/reports', siteId ? { site_id: siteId } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}
