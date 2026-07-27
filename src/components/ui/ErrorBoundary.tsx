import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background-dark p-6">
        <div className="max-w-md rounded-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6 shadow-card text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h1 className="text-[16px] font-semibold text-text-primary dark:text-text-primary-dark">
            Something went wrong
          </h1>
          <p className="mt-1.5 text-[13px] text-text-secondary dark:text-text-secondary-dark">
            The dashboard hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
          >
            Reload dashboard
          </button>
        </div>
      </div>
    )
  }
}
