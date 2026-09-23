import { Link } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils'

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() =>
    dashboardApi.metrics().then((r) => r.data),
  )

  const pending = data?.pending_reviews_count ?? 0
  const inProgress = data?.viva_completion?.in_progress ?? 0
  const completed = data?.viva_completion?.completed ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="See what needs your decision, then open Review."
        actions={
          <Link to="/assignments">
            <Button variant="secondary">Manage assignments</Button>
          </Link>
        }
      />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          {pending > 0 ? (
            <Alert
              tone="warning"
              title={`${pending} assessment${pending === 1 ? '' : 's'} need review`}
              action={
                <Link to="/submissions?review=pending">
                  <Button>Review assessments</Button>
                </Link>
              }
            >
              Open the filtered Review list and finalize or adjust AI assessments.
            </Alert>
          ) : (
            <Alert tone="success" title="No assessments waiting">
              When students finish vivas, items needing your decision appear here.
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/submissions?review=pending">
              <Card hover>
                <CardBody>
                  <p className="text-sm font-medium text-[var(--color-muted)]">Needs review</p>
                  <p className="mk-kpi mt-2">{pending}</p>
                </CardBody>
              </Card>
            </Link>
            <Link to="/viva-sessions">
              <Card hover>
                <CardBody>
                  <p className="text-sm font-medium text-[var(--color-muted)]">Vivas in progress</p>
                  <p className="mk-kpi mt-2">{inProgress}</p>
                </CardBody>
              </Card>
            </Link>
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-[var(--color-muted)]">Vivas completed</p>
                <p className="mk-kpi mt-2">{completed}</p>
              </CardBody>
            </Card>
            <Link to="/students">
              <Card hover>
                <CardBody>
                  <p className="text-sm font-medium text-[var(--color-muted)]">Students</p>
                  <p className="mk-kpi mt-2">{data.students_count ?? 0}</p>
                </CardBody>
              </Card>
            </Link>
          </div>

          <Card>
            <CardBody>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Recent viva sessions</h2>
                <Link to="/viva-sessions" className="mk-link text-sm">
                  All sessions
                </Link>
              </div>
              {data.recent_sessions.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No viva sessions yet. Publish an assignment and wait for students to book.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.recent_sessions.map((session) => (
                    <Card key={session.id} hover>
                      <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <Link
                            to={`/viva-sessions/${session.id}`}
                            className="text-base font-semibold hover:text-[var(--color-primary)]"
                          >
                            {session.assignment_title}
                          </Link>
                          <p className="mt-1 text-sm text-[var(--color-muted)]">
                            {session.student_name} · {session.questions_asked}/
                            {session.question_budget} questions ·{' '}
                            {formatDate(session.started_at ?? session.created_at)}
                          </p>
                        </div>
                        <StatusBadge kind="viva" value={session.state} />
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  )
}
