import { Navigate, useParams } from 'react-router-dom'

/** Rubric editing lives on the unified setup page. */
export function AssignmentRubricPage() {
  const { id = '' } = useParams()
  return <Navigate to={`/assignments/${id}/settings#rubric`} replace />
}
