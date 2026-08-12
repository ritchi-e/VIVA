import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingPanel } from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ studentOnly = false, instructorOnly = false }) {
  const { isAuthenticated, isLoading, isStudent, isInstructor } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingPanel label="Checking session…" />

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
