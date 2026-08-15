import { Navigate } from 'react-router-dom'
import { ProgressPanel } from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { HomePage } from '@/pages/HomePage'

export function HomeRedirect() {
  const { isLoading, isAuthenticated, isStudent } = useAuth()
  if (isLoading) return <ProgressPanel copy={PLATFORM_PROGRESS.session} />
  if (!isAuthenticated) return <HomePage />
  return <Navigate to={isStudent ? '/student/dashboard' : '/dashboard'} replace />
}
