import { Link } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

const metricLabels: { key: keyof Pick<
  import('@/types').DashboardMetrics,
  'courses_count' | 'assignments_count' | 'submissions_count' | 'viva_sessions_count' | 'pending_reviews_count' | 'students_count'
>; label: string }[] = [
  { key: 'courses_count', label: 'Courses' },
  { key: 'assignments_count', label: 'Assignments' },
  { key: 'submissions_count', label: 'Submissions' },
  { key: 'viva_sessions_count', label: 'Viva sessions' },
  { key: 'pending_reviews_count', label: 'Pending reviews' },
  { key: 'students_count', label: 'Students' },
]

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() =>
    dashboardApi.metrics().then((r) => r.data),
  )

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of courses, submissions, and viva activity."
        actions={
          <Link to="/assignments" className="text-sm font-medium text-blue-700 hover:underline">
            Manage assignments
          </Link>
        }
      />
      {loading ? <LoadingPanel /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricLabels.map(({ key, label }) => (
              <Card key={key}>
                <CardBody>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{data[key] ?? 0}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Viva activity</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Completed</dt>
                    <dd className="font-medium text-slate-900">{data.viva_completion.completed}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">In progress</dt>
                    <dd className="font-medium text-slate-900">{data.viva_completion.in_progress}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Processing submissions</dt>
                    <dd className="font-medium text-slate-900">{data.pending_submissions}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Avg assessment</dt>
                    <dd className="font-medium text-slate-900">
                      {data.average_assessment != null ? `${data.average_assessment}%` : '—'}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link to="/submissions" className="text-blue-700 hover:underline">Review submissions</Link>
                  <Link to="/viva-sessions" className="text-blue-700 hover:underline">Viva sessions</Link>
                  <Link to="/students" className="text-blue-700 hover:underline">Students</Link>
                  <Link to="/reports" className="text-blue-700 hover:underline">Reports</Link>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Recent viva sessions</h2>
            {data.recent_sessions.length === 0 ? (
              <Card>
                <CardBody className="text-sm text-slate-600">No viva sessions yet.</CardBody>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.recent_sessions.map((session) => (
                  <Card key={session.id}>
                    <CardBody className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          to={`/viva-sessions/${session.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700"
                        >
                          {session.assignment_title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          {session.student_name} · {session.questions_asked}/{session.question_budget} questions ·{' '}
                          {formatDate(session.started_at ?? session.created_at)}
                        </p>
                      </div>
                      <Badge tone={session.state === 'COMPLETED' ? 'success' : session.state === 'FAILED' ? 'danger' : 'info'}>
                        {session.state}
                      </Badge>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
