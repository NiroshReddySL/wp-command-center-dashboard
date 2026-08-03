import { useState } from 'react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { useAddComponent, type ComponentInput } from '@/hooks/useComponents'

const ACTIVE_OPTIONS = [
  { value: 'unknown', label: 'Not sure' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Installed, not active' },
]

/**
 * Records one plugin or theme by hand.
 *
 * The slug matters more than the name: it is the key WordPress.org and WPScan
 * are queried with, so "akismet" finds updates and CVEs where "Akismet
 * Anti-Spam" finds nothing at all. The version matters just as much — a CVE
 * only applies to the versions it was not fixed in.
 */
export default function ComponentForm({
  siteId,
  onDone,
}: {
  siteId: string
  onDone: () => void
}) {
  const add = useAddComponent()
  const [form, setForm] = useState({
    component_type: 'plugin' as ComponentInput['component_type'],
    slug: '',
    name: '',
    installed_version: '',
    active: 'unknown',
  })
  const [error, setError] = useState<string | null>(null)

  const canSubmit = form.slug.trim() !== '' && form.installed_version.trim() !== ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await add.mutateAsync({
        site_id: siteId,
        component_type: form.component_type,
        slug: form.slug.trim(),
        name: form.name.trim() || undefined,
        installed_version: form.installed_version.trim(),
        is_active:
          form.active === 'unknown' ? null : form.active === 'active',
      })
      onDone()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Could not save this component.')
    }
  }

  const field =
    'w-full rounded-md border border-border dark:border-border-dark bg-card dark:bg-card-dark px-3 py-2 text-[13px] text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:border-primary focus:outline-none'

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-lg border border-border dark:border-border-dark bg-surface/40 dark:bg-surface-dark p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">Type</span>
          <Select
            value={form.component_type}
            onChange={(e) =>
              setForm({ ...form, component_type: e.target.value as ComponentInput['component_type'] })
            }
          >
            <option value="plugin">Plugin</option>
            <option value="theme">Theme</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">
            Slug <span className="text-danger">*</span>
          </span>
          <input
            className={field}
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="akismet"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">Name</span>
          <input
            className={field}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Akismet Anti-Spam"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">
            Version <span className="text-danger">*</span>
          </span>
          <input
            className={field}
            value={form.installed_version}
            onChange={(e) => setForm({ ...form, installed_version: e.target.value })}
            placeholder="5.3"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">State</span>
          <Select
            value={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.value })}
          >
            {ACTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
      </div>

      <p className="mt-2 text-[11px] text-text-secondary dark:text-text-secondary-dark">
        The slug is the WordPress.org directory name — it&apos;s what update and
        vulnerability lookups key on.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit || add.isPending}>
          {add.isPending ? 'Saving…' : 'Save component'}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
