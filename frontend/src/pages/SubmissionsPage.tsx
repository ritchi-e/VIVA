import { Link, useSearchParams } from 'react-router-dom'
import { submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function SubmissionsPage() {
  const [params] = useSearchParams()
  const assignmentId = params.get('assignment') || undefined
  const { data, loading, error, reload } = useAsync(
    () => submissionsApi.list(assignmentId ? { assignment: assignmentId } : undefined),
    [assignmentId],
  )

  return (
    <div>
      <PageHeader title="Submissions" description="Student work awaiting or completed processing." />
      {loading ? <LoadingPanel /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No submissions" description="Submissions appear when students upload assignments." />
      ) : null}
      <div className="space-y-3">
        {data?.map((s) => (
          <Card key={s.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/submissions/${s.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                  {s.assignment_title || 'Submission'} · v{s.version}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  {s.student_name || s.student_email || s.student} · {formatDate(s.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/assignments/${s.assignment}`} className="text-xs text-blue-700 hover:underline">
                  Assignment
                </Link>
                <Badge tone={s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'info'}>
                  {s.status}
                </Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
