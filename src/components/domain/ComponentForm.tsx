import { useEffect, useState } from 'react'
import { Check, Loader2, Info } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { useAddComponent, useComponentLookup, type ComponentInput } from '@/hooks/useComponents'

const FIELD =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] text-text-primary transition-colors placeholder:text-text-secondary focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/15 dark:border-border-dark dark:bg-card-dark dark:text-text-primary-dark'

/**
 * Records one plugin or theme by hand.
 *
 * The slug leads because it is the key WordPress.org and WPScan are queried
 * with — "akismet" finds updates and CVEs where "Akismet Anti-Spam" finds
 * nothing. It is resolved live as it is typed, which answers the question
 * that actually matters up front: does the directory know this component? For
 * premium and in-house builds — Avada, Swift Performance — it never will, and
 * the operator has to supply the latest version themselves or the component
 * would sit at "up to date" forever.
 */
export default function ComponentForm({
  siteId, onDone,
}: {
  siteId: string
  onDone: () => void
}) {
  const add = useAddComponent()
  const [type, setType] = useState<ComponentInput['component_type']>('plugin')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [installed, setInstalled] = useState('')
  const [latest, setLatest] = useState('')
  const [active, setActive] = useState('unknown')
  const [error, setError] = useState<string | null>(null)

  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(slug), 400)
    return () => clearTimeout(t)
  }, [slug])

  const { data: lookup, isFetching } = useComponentLookup(debounced, type)
  const resolved = lookup && lookup.slug === debounced.trim().toLowerCase().replace(/\/.*$/, '')
  const notListed = !!lookup && !lookup.found && !isFetching

  const canSubmit = slug.trim() !== '' && installed.trim() !== ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await add.mutateAsync({
        site_id: siteId,
        component_type: type,
        slug: slug.trim(),
        name: name.trim() || undefined,
        installed_version: installed.trim(),
        latest_version: latest.trim() || undefined,
        is_active: active === 'unknown' ? null : active === 'active',
      })
      onDone()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Could not save this component.')
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-lg border border-border bg-surface/40 p-4 dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as ComponentInput['component_type'])}>
            <option value="plugin">Plugin</option>
            <option value="theme">Theme</option>
          </Select>
        </Field>

        <Field label="Slug" required>
          <input
            className={FIELD}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="akismet"
            required
          />
        </Field>

        <Field label="Name">
          <input
            className={FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={(resolved && lookup?.found && 'From the directory') || 'Akismet Anti-Spam'}
          />
        </Field>

        <Field label="Installed version" required>
          <input
            className={FIELD}
            value={installed}
            onChange={(e) => setInstalled(e.target.value)}
            placeholder="5.3"
            required
          />
        </Field>
      </div>

      {/* Live directory result — the answer to "will this be auditable?" */}
      <div className="mt-2 min-h-[20px] text-[12px]">
        {isFetching && debounced.trim().length >= 2 && (
          <span className="inline-flex items-center gap-1.5 text-text-secondary dark:text-text-secondary-dark">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking WordPress.org…
          </span>
        )}
        {!isFetching && resolved && lookup?.found && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <Check className="h-3 w-3" />
            Found on WordPress.org — latest is v{lookup.latest_version}. Updates will be tracked automatically.
          </span>
        )}
        {notListed && resolved && (
          <span className="inline-flex items-start gap-1.5 text-text-secondary dark:text-text-secondary-dark">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Not in the WordPress.org directory — normal for premium or custom components.
              Add the latest version below, or it will show as <em>Not tracked</em> rather than
              being reported as up to date.
            </span>
          </span>
        )}
      </div>

      {/* Only asked for when it is genuinely needed */}
      {notListed && (
        <div className="mt-3 max-w-xs">
          <Field label="Latest version (from the vendor)">
            <input
              className={cn(FIELD, 'font-mono')}
              value={latest}
              onChange={(e) => setLatest(e.target.value)}
              placeholder="7.11.0"
            />
          </Field>
        </div>
      )}

      <div className="mt-3 max-w-xs">
        <Field label="State">
          <Select value={active} onChange={(e) => setActive(e.target.value)}>
            <option value="unknown">Not sure</option>
            <option value="active">Active</option>
            <option value="inactive">Installed, not active</option>
          </Select>
        </Field>
      </div>

      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
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

function Field({
  label, required, children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-text-secondary dark:text-text-secondary-dark">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  )
}
