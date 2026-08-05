import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportFinding, ReportSection as Section } from '@/hooks/useReports'

const SEVERITY: Record<ReportFinding['severity'], { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-danger/10 text-danger' },
  high: { label: 'High', cls: 'bg-warning/10 text-warning' },
  medium: { label: 'Medium', cls: 'bg-info/10 text-primary dark:text-primary-dark' },
  opportunity: { label: 'Opportunity', cls: 'bg-success/10 text-success' },
}

const fmt = (v: number | string | null) =>
  v === null ? '—' : typeof v === 'number' ? v.toLocaleString() : v

export default function ReportSection({ section }: { section: Section }) {
  return (
    <section className="border-t border-border py-8 dark:border-border-dark">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-primary-dark">
        {section.number} / {section.title}
      </p>
      <h2 className="mt-1 max-w-3xl text-[22px] font-semibold leading-tight tracking-tight text-text-primary dark:text-text-primary-dark">
        {section.headline || section.title}
      </h2>

      {/* A section that could not be measured states why. Rendering zeros
          here would read as "measured, and the answer was none". */}
      {section.unavailable ? (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
              Not available
            </p>
            <p className="mt-0.5 text-[12px] text-text-secondary dark:text-text-secondary-dark">
              {section.unavailable}
            </p>
          </div>
        </div>
      ) : (
        <>
          {section.metrics.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {section.metrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-border p-4 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
                    {m.label}
                  </p>
                  <p className="mt-1 text-[24px] font-semibold leading-none tracking-tight text-text-primary dark:text-text-primary-dark">
                    {fmt(m.value)}
                    <span className="text-[14px]">{m.unit}</span>
                  </p>
                  {/* The basis is not decoration — it is what makes the
                      number checkable. */}
                  <p className="mt-2 text-[11px] leading-snug text-text-secondary dark:text-text-secondary-dark">
                    {m.sub && <span className="block font-medium">{m.sub}</span>}
                    {m.basis}
                  </p>
                </div>
              ))}
            </div>
          )}

          {section.notes.map((note) => (
            <p key={note} className="mt-3 rounded-r-lg border-l-2 border-secondary bg-surface/50 py-2.5 pl-3 pr-4 text-[12px] leading-relaxed text-text-secondary dark:bg-surface-dark dark:text-text-secondary-dark">
              {note}
            </p>
          ))}

          {section.findings.map((f) => <FindingCard key={f.id} finding={f} />)}

          {section.tables.map((t) => (
            <div key={t.title} className="mt-6">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
                {t.title}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border dark:border-border-dark">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-surface/60 dark:bg-surface-dark">
                      {t.columns.map((c) => (
                        <th key={c} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row) => (
                      <tr key={row.join('|')} className="border-t border-border dark:border-border-dark">
                        {row.map((cell, i) => (
                          <td key={i} className={cn('px-3 py-2 text-text-primary dark:text-text-primary-dark', i > 0 && 'whitespace-nowrap tabular-nums')}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {t.note && (
                <p className="mt-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark">{t.note}</p>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function FindingCard({ finding: f }: { finding: ReportFinding }) {
  const sev = SEVERITY[f.severity]
  return (
    <article className="mt-4 rounded-xl border border-border p-5 dark:border-border-dark">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-primary dark:text-primary-dark">{f.id}</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-text-primary dark:text-text-primary-dark">
            {f.title}
          </h3>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', sev.cls)}>
          {sev.label}
        </span>
      </div>

      <div className="mt-3 grid gap-4 rounded-lg bg-surface/50 p-4 dark:bg-surface-dark sm:grid-cols-2">
        <Block title="Evidence">{f.evidence}</Block>
        <Block title="Why it matters">{f.implication}</Block>
      </div>

      {(f.actions.length > 0 || f.measures.length > 0) && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <List title="Recommended actions" items={f.actions} />
          <List title="How success is measured" items={f.measures} />
        </div>
      )}

      <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-text-secondary dark:border-border-dark dark:text-text-secondary-dark">
        Effort: {f.effort}
      </p>
    </article>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
        {title}
      </h4>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-primary dark:text-text-primary-dark">
        {children}
      </p>
    </div>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
        {title}
      </h4>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-[12.5px] leading-relaxed text-text-primary dark:text-text-primary-dark">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  )
}
