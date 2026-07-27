import { cn } from '@/lib/utils'

interface ContentScoreBarProps {
  score: number
  showLabel?: boolean
  height?: 'sm' | 'md'
  className?: string
}

function getScoreStyle(score: number) {
  if (score >= 70) return { bar: 'bg-success', text: 'text-success', bg: 'bg-success/10' }
  if (score >= 40) return { bar: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10' }
  return { bar: 'bg-danger', text: 'text-danger', bg: 'bg-danger/10' }
}

export default function ContentScoreBar({
  score,
  showLabel = true,
  height = 'md',
  className,
}: ContentScoreBarProps) {
  const style = getScoreStyle(score)
  const barHeight = height === 'sm' ? 'h-1' : 'h-1.5'
  const clamped = Math.min(100, Math.max(0, score))

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 bg-border dark:bg-border-dark rounded-full overflow-hidden', barHeight)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', style.bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-[11px] font-semibold flex-shrink-0 w-8 text-right', style.text)}>
          {clamped}
        </span>
      )}
    </div>
  )
}
