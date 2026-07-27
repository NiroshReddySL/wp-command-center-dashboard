import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Loader2 } from 'lucide-react'
import { post } from '@/lib/api'
import { setSession, type AuthUser } from '@/lib/auth'

interface LoginResponse {
  access_token: string
  email: string
  role: AuthUser['role']
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await post<LoginResponse>('/auth/login', { email, password })
      setSession(data.access_token, { email: data.email, role: data.role })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(
        status === 401
          ? 'Invalid email or password.'
          : status === 429
            ? 'Too many attempts — wait a minute and try again.'
            : 'Could not reach the server. Try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background-dark p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-card">
            <Zap className="h-5 w-5" />
          </span>
          <h1 className="mt-3 text-[18px] font-semibold text-text-primary dark:text-text-primary-dark">
            WP Command Center
          </h1>
          <p className="mt-0.5 text-[12px] text-text-secondary dark:text-text-secondary-dark">
            Sign in to your workspace
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6 shadow-card flex flex-col gap-4"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-[13px] text-text-primary dark:text-text-primary-dark outline-none transition-colors focus:border-secondary"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-text-primary dark:text-text-primary-dark">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-[13px] text-text-primary dark:text-text-primary-dark outline-none transition-colors focus:border-secondary"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
