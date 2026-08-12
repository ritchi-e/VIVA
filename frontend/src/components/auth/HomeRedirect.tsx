import { Navigate } from 'react-router-dom'
import { LoadingPanel } from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'

export function HomeRedirect() {
  const { isLoading, isAuthenticated, isStudent } = useAuth()
  if (isLoading) return <LoadingPanel label="Loading…" />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={isStudent ? '/student/dashboard' : '/dashboard'} replace />
}
