import { Navigate, useParams } from 'react-router-dom'

/** Evidence lives on the submission review page — keep old URLs working. */
export function EvidenceDashboardPage() {
  const { id = '' } = useParams()
  return <Navigate to={`/submissions/${id}?tab=evidence`} replace />
}
