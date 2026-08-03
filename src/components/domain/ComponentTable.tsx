import { useState } from 'react'
import {
  ArrowRight, ShieldAlert, ArrowUpCircle, HelpCircle, CheckCircle2,
  Puzzle, Paintbrush, Trash2, Pencil, Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useDeleteComponent, useUpdateComponent, type SiteComponent,
} from '@/hooks/useComponents'
import { STATUS_META, statusOf, type ComponentStatus } from '@/lib/componentStatus'

const STATUS_ICON: Record<ComponentStatus, typeof ShieldAlert> = {
  vulnerable: ShieldAlert,
  outdated: ArrowUpCircle,
  untracked: HelpCircle,
  current: CheckCircle2,
}

export default function ComponentTable({ components }: { components: SiteComponent[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border dark:divide-border-dark dark:border-border-dark">
      {components.map((c) => <ComponentRow key={c.id} component={c} />)}
    </div>
  )
}

function ComponentRow({ component: c }: { component: SiteComponent }) {
  const remove = useDeleteComponent()
  const update = useUpdateComponent()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.latest_version)

  const status = statusOf(c)
  const meta = STATUS_META[status]
  const Icon = STATUS_ICON[status]
  const TypeIcon = c.component_type === 'theme' ? Paintbrush : Puzzle

  const save = () => {
    update.mutate({ id: c.id, latest_version: draft.trim() })
    setEditing(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-3 transition-colors hover:bg-surface/40 dark:bg-card-dark dark:hover:bg-surface-dark/50">
      {/* Identity */}
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-2.5">
        <TypeIcon className="h-4 w-4 shrink-0 text-text-secondary dark:text-text-secondary-dark" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
            {c.name ?? c.slug}
          </p>
          <p className="truncate font-mono text-[11px] text-text-secondary dark:text-text-secondary-dark">
            {c.slug}
          </p>
        </div>
      </div>

      {/* Version — the delta is the point, so installed and latest sit together */}
      <div className="flex shrink-0 basis-40 items-center gap-1.5 font-mono text-[12px] tabular-nums">
        <span className="text-text-primary dark:text-text-primary-dark">{c.installed_version}</span>
        {c.outdated && (
          <>
            <ArrowRight className="h-3 w-3 text-text-secondary dark:text-text-secondary-dark" />
            <span className="font-medium text-warning">{c.latest_version}</span>
          </>
        )}
      </div>

      {/* Status — icon + label, never colour alone */}
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
          meta.tint, meta.tone
        )}
      >
        <Icon className="h-3 w-3" />
        {status === 'vulnerable' && c.vulnerability_count > 1
          ? `${c.vulnerability_count} vulnerabilities`
          : meta.label}
      </span>

      {/* State: null is "not known", which is not the same as inactive */}
      <span className="shrink-0 basis-20 text-[12px] text-text-secondary dark:text-text-secondary-dark">
        {c.is_active === null ? '—' : c.is_active ? 'Active' : 'Inactive'}
      </span>

      <span className="shrink-0 text-[11px] text-text-secondary dark:text-text-secondary-dark">
        {c.source === 'manual' ? 'Manual' : 'WordPress'}
      </span>

      {/* Actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') setEditing(false)
              }}
              placeholder="7.11.0"
              aria-label={`Latest version for ${c.name ?? c.slug}`}
              className="h-7 w-24 rounded-md border border-border bg-card px-2 font-mono text-[12px] text-text-primary focus:border-secondary focus:outline-none dark:border-border-dark dark:bg-card-dark dark:text-text-primary-dark"
            />
            <IconButton label="Save" onClick={save}><Check className="h-3.5 w-3.5" /></IconButton>
            <IconButton label="Cancel" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></IconButton>
          </>
        ) : (
          c.source === 'manual' && (
            <>
              {/* The affordance that makes an off-directory component
                  auditable: WordPress.org will never answer for Avada or an
                  in-house build, so the operator supplies the version. */}
              <button
                onClick={() => { setDraft(c.latest_version); setEditing(true) }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  status === 'untracked'
                    ? 'text-primary hover:bg-info/10 dark:text-primary-dark'
                    : 'text-text-secondary hover:bg-surface dark:text-text-secondary-dark dark:hover:bg-surface-dark'
                )}
              >
                <Pencil className="h-3 w-3" />
                {status === 'untracked' ? 'Set latest' : 'Edit'}
              </button>
              <IconButton
                label={`Remove ${c.name ?? c.slug}`}
                danger
                disabled={remove.isPending && remove.variables === c.id}
                onClick={() => remove.mutate(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </>
          )
        )}
      </div>
    </div>
  )
}

function IconButton({
  label, onClick, children, danger, disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md p-1.5 text-text-secondary transition-colors disabled:opacity-50 dark:text-text-secondary-dark',
        danger ? 'hover:bg-danger/10 hover:text-danger' : 'hover:bg-surface dark:hover:bg-surface-dark'
      )}
    >
      {children}
    </button>
  )
}
