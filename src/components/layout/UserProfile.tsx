import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronsUpDown, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearSession, getUser } from '@/lib/auth'
import { useMe } from '@/hooks/useAuth'
import ChangePasswordModal from './ChangePasswordModal'

function displayName(email: string): string {
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export default function UserProfile() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Live data with the cached session as instant fallback
  const email = me?.email ?? getUser()?.email ?? '—'
  const role = me?.role ?? getUser()?.role ?? 'member'

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleSignOut = () => {
    clearSession()
    navigate('/login')
  }

  return (
    <div ref={rootRef} className="relative mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors duration-200',
          open ? 'bg-surface dark:bg-surface-dark' : 'hover:bg-surface/50 dark:hover:bg-surface-dark'
        )}
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary-dark/20">
          <span className="text-[10px] font-semibold text-primary dark:text-primary-dark">
            {email.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
            {displayName(email)}
          </p>
          <p className="truncate text-[10px] text-text-secondary dark:text-text-secondary-dark">{email}</p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary dark:text-text-secondary-dark" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-2 right-2 z-40 mb-1.5 overflow-hidden rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark shadow-dropdown"
          >
            <div className="border-b border-border dark:border-border-dark px-3 py-2.5">
              <p className="truncate text-[12px] font-medium text-text-primary dark:text-text-primary-dark">{email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 dark:bg-primary-dark/15 px-1.5 py-0.5 text-[10px] font-medium capitalize text-primary dark:text-primary-dark">
                <ShieldCheck className="h-2.5 w-2.5" />
                {role}
              </span>
            </div>
            <div className="p-1">
              <button
                onClick={() => { setOpen(false); setPwOpen(true) }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text-primary dark:text-text-primary-dark transition-colors hover:bg-surface dark:hover:bg-surface-dark"
              >
                <KeyRound className="h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark" />
                Change password
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}
