import { Link, useParams } from 'react-router-dom'
import { studentsApi, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function StudentDetailPage() {
  const { id = '' } = useParams()
  const student = useAsync(() => studentsApi.get(id).then((r) => r.data), [id])
  const submissions = useAsync(() => submissionsApi.list({ student: id }), [id])

  if (student.loading) return <LoadingPanel />
  if (student.error || !student.data) {
    return <ErrorState message={student.error ?? 'Student not found'} onRetry={student.reload} />
  }

  const s = student.data

  return (
    <div>
      <PageHeader title={s.full_name || s.email} description={s.email} />
      <Card className="mb-6">
        <CardBody className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
          <p>Submissions: {s.submissions_count ?? 0}</p>
          <p>Viva sessions: {s.viva_sessions_count ?? 0}</p>
          <p>Pending reviews: {s.pending_reviews_count ?? 0}</p>
        </CardBody>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Submissions</h2>
      {submissions.loading ? <LoadingPanel /> : null}
      {submissions.error ? <ErrorState message={submissions.error} onRetry={submissions.reload} /> : null}
      <div className="space-y-3">
        {submissions.data?.map((sub) => (
          <Card key={sub.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/submissions/${sub.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                  {sub.assignment_title || 'Submission'} · v{sub.version}
                </Link>
                <p className="mt-1 text-sm text-slate-500">{formatDate(sub.created_at)}</p>
              </div>
              <Badge tone={sub.status === 'ready' ? 'success' : sub.status === 'failed' ? 'danger' : 'info'}>
                {sub.status}
              </Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
