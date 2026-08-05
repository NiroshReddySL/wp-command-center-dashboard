import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import AppLayout from '@/components/layout/AppLayout'
import Skeleton from '@/components/ui/Skeleton'
import { isAuthenticated } from '@/lib/auth'

const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Watchdog = lazy(() => import('@/pages/Watchdog'))
const Optimizer = lazy(() => import('@/pages/Optimizer'))
const Autopilot = lazy(() => import('@/pages/Autopilot'))
const ReviewQueue = lazy(() => import('@/pages/ReviewQueue'))
const SiteDetail = lazy(() => import('@/pages/SiteDetail'))
const Settings = lazy(() => import('@/pages/Settings'))
const Traffic = lazy(() => import('@/pages/Traffic'))
const LiveVisitors = lazy(() => import('@/pages/LiveVisitors'))
const Flows = lazy(() => import('@/pages/Flows'))
const ContentPostDetail = lazy(() => import('@/pages/ContentPostDetail'))
const Reports = lazy(() => import('@/pages/Reports'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function PageFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/watchdog" element={<Watchdog />} />
            <Route path="/optimizer" element={<Optimizer />} />
            <Route path="/optimizer/content/:postId" element={<ContentPostDetail />} />
            <Route path="/autopilot" element={<Autopilot />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/sites/:siteId" element={<SiteDetail />} />
            <Route path="/traffic" element={<Traffic />} />
            <Route path="/live-visitors" element={<LiveVisitors />} />
            <Route path="/flows" element={<Flows />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}
