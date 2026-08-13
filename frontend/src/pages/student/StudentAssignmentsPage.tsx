import { Link } from 'react-router-dom'
import { assignmentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function StudentAssignmentsPage() {
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.list())

  return (
    <div>
      <PageHeader title="My assignments" description="Assignments available for submission and viva." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No assignments" description="Your instructor has not published assignments yet." />
      ) : null}
      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.id}>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <Link to={`/student/assignments/${a.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                  {a.title}
                </Link>
                <p className="mt-1 text-sm text-slate-500">Due {formatDate(a.due_at)}</p>
              </div>
              <Badge tone={a.status === 'published' ? 'success' : 'default'}>{a.status}</Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
