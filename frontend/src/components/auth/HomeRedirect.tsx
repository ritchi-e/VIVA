import { Navigate } from 'react-router-dom'
import { ProgressPanel } from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'

export function HomeRedirect() {
  const { isLoading, isAuthenticated, isStudent } = useAuth()
  if (isLoading) return <ProgressPanel copy={PLATFORM_PROGRESS.session} />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={isStudent ? '/student/dashboard' : '/dashboard'} replace />
}
