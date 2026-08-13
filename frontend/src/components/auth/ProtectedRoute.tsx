import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ProgressPanel } from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'

export function ProtectedRoute({ studentOnly = false, instructorOnly = false }) {
  const { isAuthenticated, isLoading, isStudent, isInstructor } = useAuth()
  const location = useLocation()

  if (isLoading) return <ProgressPanel copy={PLATFORM_PROGRESS.session} />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (studentOnly && !isStudent) {
    return <Navigate to="/dashboard" replace />
  }

  if (instructorOnly && !isInstructor) {
    return <Navigate to="/student/dashboard" replace />
  }

  return <Outlet />
}
