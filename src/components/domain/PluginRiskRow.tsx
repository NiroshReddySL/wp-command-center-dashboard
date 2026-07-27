import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

export interface PluginAudit {
  id: string
  plugin_slug: string
  installed_version: string
  latest_version: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  sites_affected: number
  plugin_name?: string
  vulnerability_details?: { cve?: string; description?: string }
}

interface PluginRiskRowProps {
  plugin: PluginAudit
  onUpdate?: (id: string) => void
  onDismiss?: (id: string) => void
}

const riskVariant: Record<string, 'critical' | 'warning' | 'info' | 'success'> = {
  critical: 'critical',
  high: 'critical',
  medium: 'warning',
  low: 'info',
}

export default function PluginRiskRow({ plugin, onUpdate, onDismiss }: PluginRiskRowProps) {
  const hasUpdate = plugin.installed_version !== plugin.latest_version

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-surface/30 dark:hover:bg-surface-dark transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark truncate">
            {plugin.plugin_name ?? plugin.plugin_slug}
          </p>
          <Badge variant={riskVariant[plugin.risk_level] ?? 'default'}>
            {plugin.risk_level}
          </Badge>
        </div>
        {plugin.vulnerability_details?.description && (
          <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mt-0.5 truncate">
            {plugin.vulnerability_details.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 text-[11px] flex-shrink-0">
        <code className="text-danger bg-danger/5 px-1.5 py-0.5 rounded">
          v{plugin.installed_version}
        </code>
        {hasUpdate && (
          <>
            <span className="text-text-secondary dark:text-text-secondary-dark">→</span>
            <code className="text-success bg-success/5 px-1.5 py-0.5 rounded">
              v{plugin.latest_version}
            </code>
          </>
        )}
      </div>

      <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark flex-shrink-0">
        {plugin.sites_affected} site{plugin.sites_affected !== 1 ? 's' : ''}
      </span>

      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {hasUpdate && (
          <Button variant="primary" size="sm" onClick={() => onUpdate?.(plugin.id)}>
            Update
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDismiss?.(plugin.id)}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
