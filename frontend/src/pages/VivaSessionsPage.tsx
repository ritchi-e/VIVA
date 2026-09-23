import { Link } from 'react-router-dom'
import { vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export function VivaSessionsPage() {
  const { data, loading, error, reload } = useAsync(() => vivaApi.list())

  return (
    <div>
      <PageHeader
        title="Viva sessions"
        description="Dialogue and monitoring detail. Use Review to finalize grades."
        actions={
          <Link to="/submissions?review=pending">
            <Button variant="secondary">Needs review</Button>
          </Link>
        }
      />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.vivaList} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState
          title="No viva sessions"
          description="Sessions appear when students start a booked viva."
          action={
            <Link to="/assignments">
              <Button variant="secondary">View assignments</Button>
            </Link>
          }
        />
      ) : null}
      <div className="space-y-2">
        {data?.map((session) => (
          <Card key={session.id} hover>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link
                  to={`/viva-sessions/${session.id}`}
                  className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                >
                  {session.assignment_title || `Session ${session.id.slice(0, 8)}`}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {session.student_name || session.student_email || session.student} ·{' '}
                  {session.questions_asked}/{session.question_budget} questions ·{' '}
                  {formatDate(session.started_at ?? session.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/submissions/${session.submission}`} className="mk-link text-sm">
                  Open review
                </Link>
                {session.integrity_terminated ? (
                  <Badge tone="warning">Left window</Badge>
                ) : (
                  <StatusBadge kind="viva" value={session.state} />
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
