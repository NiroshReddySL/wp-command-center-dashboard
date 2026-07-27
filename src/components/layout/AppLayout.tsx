import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'
import Skeleton from '@/components/ui/Skeleton'

const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-background dark:bg-background-dark">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-[240px] min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <motion.div
            key={location.pathname}
            {...pageTransition}
            className="p-6 max-w-7xl mx-auto w-full"
          >
            <Suspense
              fallback={
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
