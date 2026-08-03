import { useState } from 'react'
import {
  ArrowRight, ShieldAlert, ArrowUpCircle, HelpCircle, CheckCircle2,
  Puzzle, Paintbrush, Trash2, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useDeleteComponent, type SiteComponent } from '@/hooks/useComponents'
import { STATUS_META, statusOf, type ComponentStatus } from '@/lib/componentStatus'
import ComponentRowEdit from './ComponentRowEdit'

const STATUS_ICON: Record<ComponentStatus, typeof ShieldAlert> = {
  vulnerable: ShieldAlert,
  outdated: ArrowUpCircle,
  untracked: HelpCircle,
  current: CheckCircle2,
}

export default function ComponentTable({ components }: { components: SiteComponent[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border dark:divide-border-dark dark:border-border-dark">
      {components.map((c) =>
        editingId === c.id ? (
          <ComponentRowEdit key={c.id} component={c} onDone={() => setEditingId(null)} />
        ) : (
          <ComponentRow key={c.id} component={c} onEdit={() => setEditingId(c.id)} />
        )
      )}
    </div>
  )
}

function ComponentRow({
  component: c,
  onEdit,
}: {
  component: SiteComponent
  onEdit: () => void
}) {
  const remove = useDeleteComponent()
  const [confirming, setConfirming] = useState(false)
  const status = statusOf(c)
  const meta = STATUS_META[status]
  const Icon = STATUS_ICON[status]
  const TypeIcon = c.component_type === 'theme' ? Paintbrush : Puzzle
  const editable = c.source === 'manual'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-3 transition-colors hover:bg-surface/40 dark:bg-card-dark dark:hover:bg-surface-dark/50">
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

      {/* The delta is the point, so installed and latest sit together */}
      <div className="flex shrink-0 basis-40 items-center gap-1.5 font-mono text-[12px] tabular-nums">
        <span className="text-text-primary dark:text-text-primary-dark">{c.installed_version}</span>
        {c.outdated && (
          <>
            <ArrowRight className="h-3 w-3 text-text-secondary dark:text-text-secondary-dark" />
            <span className="font-medium text-warning">{c.latest_version}</span>
          </>
        )}
      </div>

      {/* Icon + label, never colour alone */}
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

      {/* null is "not known", which is not the same as inactive */}
      <span className="shrink-0 basis-20 text-[12px] text-text-secondary dark:text-text-secondary-dark">
        {c.is_active === null ? '—' : c.is_active ? 'Active' : 'Inactive'}
      </span>

      <span className="shrink-0 text-[11px] text-text-secondary dark:text-text-secondary-dark">
        {c.source === 'manual' ? 'Manual' : 'WordPress'}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {editable ? (
          <>
            <button
              onClick={onEdit}
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
            <button
              aria-label={`Remove ${c.name ?? c.slug}`}
              title={`Remove ${c.name ?? c.slug}`}
              onClick={() => setConfirming(true)}
              disabled={remove.isPending && remove.variables === c.id}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50 dark:text-text-secondary-dark"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <ConfirmDialog
              open={confirming}
              onCancel={() => setConfirming(false)}
              onConfirm={() => remove.mutate(c.id, { onSuccess: () => setConfirming(false) })}
              title={`Remove ${c.name ?? c.slug}?`}
              confirmLabel="Remove"
              pending={remove.isPending && remove.variables === c.id}
            >
              {/* The distinction that actually matters: this is a record, not
                  the software. Someone who reads "remove" as "uninstall" would
                  never click it. */}
              This only stops WP Command Center tracking the {c.component_type} — it
              stays installed on your site. Its update and vulnerability findings
              will be cleared, and you can add it again at any time.
            </ConfirmDialog>
          </>
        ) : (
          // Read from WordPress: editing here would be overwritten on the very
          // next run, so the affordance would be a lie.
          <span className="px-2 text-[11px] text-text-secondary dark:text-text-secondary-dark">
            Managed in WordPress
          </span>
        )}
      </div>
    </div>
  )
}
