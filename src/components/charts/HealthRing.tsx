import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn, clamp } from '@/lib/utils'

interface HealthRingProps {
  /** 0–100 */
  value: number
  size?: number
  strokeWidth?: number
  trackColor?: string
  progressColor?: string
  children?: ReactNode
  className?: string
}

/** Animated circular gauge for a 0–100 score. */
export default function HealthRing({
  value,
  size = 132,
  strokeWidth = 11,
  trackColor = 'rgba(255,255,255,0.22)',
  progressColor = '#FFFFFF',
  children,
  className,
}: HealthRingProps) {
  const pct = clamp(value, 0, 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
