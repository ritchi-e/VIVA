import { Link } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
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
          <Link to="/assignments" className="mk-link text-[15px]">
            Manage assignments
          </Link>
        }
      />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metricLabels.map(({ key, label }) => (
              <Card key={key} hover>
                <CardBody>
                  <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
                  <p className="mk-kpi mt-2">{data[key] ?? 0}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">
                  Viva activity
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-base">
                  <div>
                    <dt className="text-sm text-[var(--color-muted)]">Completed</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-foreground)]">
                      {data.viva_completion.completed}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-[var(--color-muted)]">In progress</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-foreground)]">
                      {data.viva_completion.in_progress}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-[var(--color-muted)]">Processing submissions</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-foreground)]">
                      {data.pending_submissions}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-[var(--color-muted)]">Avg assessment</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-foreground)]">
                      {data.average_assessment != null ? `${data.average_assessment}%` : '—'}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">
                  Quick links
                </h2>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-base">
                  <Link to="/submissions" className="mk-link">
                    Review submissions
                  </Link>
                  <Link to="/viva-sessions" className="mk-link">
                    Viva sessions
                  </Link>
                  <Link to="/students" className="mk-link">
                    Students
                  </Link>
                  <Link to="/reports" className="mk-link">
                    Reports
                  </Link>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-[var(--color-foreground)]">
              Recent viva sessions
            </h2>
            {data.recent_sessions.length === 0 ? (
              <Card>
                <CardBody className="text-base text-[var(--color-muted)]">No viva sessions yet.</CardBody>
              </Card>
            ) : (
              <div className="space-y-2">
                {data.recent_sessions.map((session) => (
                  <Card key={session.id} hover>
                    <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <Link
                          to={`/viva-sessions/${session.id}`}
                          className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                        >
                          {session.assignment_title}
                        </Link>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                          {session.student_name} · {session.questions_asked}/{session.question_budget}{' '}
                          questions · {formatDate(session.started_at ?? session.created_at)}
                        </p>
                      </div>
                      <Badge
                        tone={
                          session.state === 'COMPLETED'
                            ? 'success'
                            : session.state === 'FAILED'
                              ? 'danger'
                              : 'info'
                        }
                      >
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
