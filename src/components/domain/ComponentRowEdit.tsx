import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { useUpdateComponent, type SiteComponent } from '@/hooks/useComponents'

const FIELD =
  'h-8 w-full rounded-md border border-border bg-card px-2.5 text-[12px] text-text-primary transition-colors placeholder:text-text-secondary focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15 dark:border-border-dark dark:bg-card-dark dark:text-text-primary-dark'

const stateValue = (v: boolean | null) => (v === null ? 'unknown' : v ? 'active' : 'inactive')

/**
 * Inline editor for a hand-recorded component.
 *
 * The slug and type are deliberately fixed: together they are the component's
 * identity — the key wp.org and WPScan are queried with, and the key its
 * alerts are filed under. Changing one in place would silently re-point the
 * record at a different component while leaving the old findings behind, so
 * a wrong slug is a remove-and-re-add, not an edit.
 */
export default function ComponentRowEdit({
  component: c,
  onDone,
}: {
  component: SiteComponent
  onDone: () => void
}) {
  const update = useUpdateComponent()
  const [name, setName] = useState(c.name ?? '')
  const [installed, setInstalled] = useState(c.installed_version)
  // An unresolved component mirrors installed into latest, which is a
  // placeholder rather than a real answer — so don't prefill it as one.
  const [latest, setLatest] = useState(c.latest_source === 'unknown' ? '' : c.latest_version)
  const [state, setState] = useState(stateValue(c.is_active))
  const [error, setError] = useState<string | null>(null)

  const tracked = c.latest_source === 'wporg'

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({
        id: c.id,
        name: name.trim() || undefined,
        installed_version: installed.trim(),
        // Only sent when the operator owns this value. For a directory-tracked
        // component, sending it would pin a snapshot as "manual" and stop
        // wp.org updating it.
        ...(tracked ? {} : { latest_version: latest.trim() }),
        is_active: state === 'unknown' ? null : state === 'active',
      })
      onDone()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Could not save these changes.')
    }
  }

  return (
    <form
      onSubmit={save}
      className="border-l-2 border-primary bg-surface/50 px-4 py-3 dark:border-primary-dark dark:bg-surface-dark"
    >
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
          {c.slug}
        </span>
        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
          {c.component_type} · slug and type can&apos;t be changed
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder={c.slug} />
        </Field>

        <Field label="Installed version">
          <input
            className={cn(FIELD, 'font-mono')}
            value={installed}
            onChange={(e) => setInstalled(e.target.value)}
            required
          />
        </Field>

        <Field label={tracked ? 'Latest (from WordPress.org)' : 'Latest version'}>
          {tracked ? (
            <p className="flex h-8 items-center font-mono text-[12px] text-text-secondary dark:text-text-secondary-dark">
              {c.latest_version}
            </p>
          ) : (
            <input
              className={cn(FIELD, 'font-mono')}
              value={latest}
              onChange={(e) => setLatest(e.target.value)}
              placeholder="Leave blank if unknown"
            />
          )}
        </Field>

        <Field label="State">
          <Select value={state} onChange={(e) => setState(e.target.value)} className="h-8 text-[12px]">
            <option value="unknown">Not sure</option>
            <option value="active">Active</option>
            <option value="inactive">Installed, not active</option>
          </Select>
        </Field>
      </div>

      {!tracked && (
        <p className="mt-1.5 text-[11px] text-text-secondary dark:text-text-secondary-dark">
          WordPress.org has no record of this one, so its latest version is whatever you record here.
        </p>
      )}

      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!installed.trim() || update.isPending}>
          {update.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Save changes
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">
        {label}
      </span>
      {children}
    </label>
  )
}
