import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Zap, Clock } from 'lucide-react'
import { cn, getHealthColor } from '@/lib/utils'
import type { Site } from '@/hooks/useSites'

interface SiteHealthCardProps {
  site: Site
}

function SiteFavicon({ name, url, className }: { name: string; url: string; className?: string }) {
  const letter = name.charAt(0).toUpperCase()
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const color = colors[name.charCodeAt(0) % colors.length]

  let domain = ''
  try { domain = new URL(url).hostname } catch { domain = url }
  const faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

  return (
    <div className={cn('flex items-center justify-center rounded-md overflow-hidden flex-shrink-0 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark', className)}>
      <img
        src={faviconSrc}
        alt={name}
        className="h-5 w-5 object-contain"
        onError={(e) => {
          const target = e.currentTarget
          target.style.display = 'none'
          const fallback = target.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className={cn('hidden w-full h-full items-center justify-center text-white text-[11px] font-bold', color)}
        style={{ display: 'none' }}
      >
        {letter}
      </div>
    </div>
  )
}

export default function SiteHealthCard({ site }: SiteHealthCardProps) {
  const navigate = useNavigate()
  const healthColor = getHealthColor(site.health_score)

  return (
    <div
      onClick={() => navigate(`/sites/${site.id}`)}
      className={cn(
        'bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-4',
        'hover:shadow-card-hover transition-all duration-200 cursor-pointer',
        'hover:border-secondary/40'
      )}
    >
      <div className="flex items-center gap-3">
        <SiteFavicon name={site.name} url={site.url} className="h-8 w-8" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary dark:text-text-primary-dark truncate">
            {site.name}
          </p>
          <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark truncate">
            {site.url}
          </p>
        </div>
        <div className={cn('text-[22px] font-bold leading-none flex-shrink-0', healthColor)}>
          {site.health_score}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-text-secondary dark:text-text-secondary-dark" />
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            {site.issues_count ?? 0} issues
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-text-secondary dark:text-text-secondary-dark" />
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            Speed {site.speed_score ?? '--'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-text-secondary dark:text-text-secondary-dark" />
          <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">
            {site.content_freshness ?? '--'}% fresh
          </span>
        </div>
      </div>
    </div>
  )
}
