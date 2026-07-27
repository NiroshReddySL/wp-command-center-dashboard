import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="mb-6">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="20" fill="#E1ECFF" />
          <path
            d="M40 20C28.954 20 20 28.954 20 40C20 51.046 28.954 60 40 60C51.046 60 60 51.046 60 40C60 28.954 51.046 20 40 20Z"
            stroke="#0129AC"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M30 30L50 50M50 30L30 50"
            stroke="#0129AC"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="text-[72px] font-bold text-primary dark:text-primary-dark leading-none mb-2">404</p>
      <h1 className="text-[22px] font-semibold text-text-primary dark:text-text-primary-dark mb-3">
        Page not found
      </h1>
      <p className="text-[14px] text-text-secondary dark:text-text-secondary-dark max-w-sm mb-8">
        The page you're looking for doesn't exist or has been moved. Let's get you back to your dashboard.
      </p>

      <Button variant="primary" onClick={() => navigate('/')}>
        Back to Dashboard
      </Button>
    </div>
  )
}
