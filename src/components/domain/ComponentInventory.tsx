import { useState } from 'react'
import { Plus, Trash2, Puzzle, Paintbrush } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { useComponents, useDeleteComponent, type SiteComponent } from '@/hooks/useComponents'
import ComponentForm from './ComponentForm'

/**
 * Plugins and themes tracked for a site.
 *
 * Reading them from WordPress needs an Application Password, so this is also
 * where they get recorded by hand when there isn't one — otherwise those
 * sites are simply never audited, which the Watchdog page used to render as
 * a clean bill of health.
 */
export default function ComponentInventory({ siteId }: { siteId?: string }) {
  const { data: components, isLoading } = useComponents(siteId)
  const remove = useDeleteComponent()
  const [adding, setAdding] = useState(false)

  const rows = components ?? []
  const manualCount = rows.filter((c) => c.source === 'manual').length

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl p-6 shadow-card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary dark:text-text-primary-dark">
            Plugins &amp; Themes
          </h3>
          <p className="mt-0.5 text-[12px] text-text-secondary dark:text-text-secondary-dark">
            {rows.length === 0
              ? 'Nothing tracked yet — add components to have them checked for updates and known vulnerabilities.'
              : `${rows.length} tracked${manualCount ? ` · ${manualCount} added manually` : ''}`}
          </p>
        </div>
        {siteId && (
          <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        )}
      </div>

      {!siteId && (
        <p className="rounded-lg border border-border dark:border-border-dark bg-surface/40 dark:bg-surface-dark px-4 py-3 text-[12px] text-text-secondary dark:text-text-secondary-dark">
          Select a single site to add or edit components.
        </p>
      )}

      {adding && siteId && (
        <ComponentForm siteId={siteId} onDone={() => setAdding(false)} />
      )}

      {isLoading ? (
        <div className="flex flex-col gap-1 mt-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        !adding && (
          <EmptyState
            title="No components tracked"
            description="Connect an Application Password to read them from WordPress, or add them by hand."
          />
        )
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead>Latest</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Source</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <ComponentRow
                  key={c.id}
                  component={c}
                  onDelete={() => remove.mutate(c.id)}
                  deleting={remove.isPending && remove.variables === c.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function ComponentRow({
  component: c,
  onDelete,
  deleting,
}: {
  component: SiteComponent
  onDelete: () => void
  deleting: boolean
}) {
  const Icon = c.component_type === 'theme' ? Paintbrush : Puzzle
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0 text-text-secondary dark:text-text-secondary-dark" />
          <span className="truncate text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
            {c.name ?? c.slug}
          </span>
          {!!c.vulnerability_count && (
            <Badge variant="critical">{c.vulnerability_count} CVE</Badge>
          )}
        </div>
        <span className="font-mono text-[11px] text-text-secondary dark:text-text-secondary-dark">
          {c.slug}
        </span>
      </TableCell>
      <TableCell className="font-mono text-[12px]">{c.installed_version}</TableCell>
      <TableCell className="font-mono text-[12px]">
        {c.outdated ? (
          <Badge variant="warning">{c.latest_version}</Badge>
        ) : (
          <span className="text-text-secondary dark:text-text-secondary-dark">
            {c.latest_version}
          </span>
        )}
      </TableCell>
      <TableCell>
        {/* null is "not known", which is not the same as inactive — a manual
            entry where nobody said must not be shown as deactivated. */}
        {c.is_active === null ? (
          <span className="text-[12px] text-text-secondary dark:text-text-secondary-dark">—</span>
        ) : (
          <Badge variant={c.is_active ? 'success' : 'default'}>
            {c.is_active ? 'Active' : 'Inactive'}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={c.source === 'manual' ? 'info' : 'default'}>
          {c.source === 'manual' ? 'Manual' : 'WordPress'}
        </Badge>
      </TableCell>
      <TableCell>
        {c.source === 'manual' && (
          <button
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Remove ${c.name ?? c.slug}`}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50 dark:text-text-secondary-dark"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </TableCell>
    </TableRow>
  )
}
