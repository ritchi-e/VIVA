import { Link } from 'react-router-dom'
import { vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function VivaSessionsPage() {
  const { data, loading, error, reload } = useAsync(() => vivaApi.list())

  return (
    <div>
      <PageHeader title="Viva sessions" description="Oral defense sessions across assignments." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.vivaList} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No viva sessions" description="Sessions are created when students start a viva." />
      ) : null}
      <div className="space-y-3">
        {data?.map((session) => (
          <Card key={session.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/viva-sessions/${session.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                  {session.assignment_title || `Session ${session.id.slice(0, 8)}`}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  {session.student_name || session.student_email || session.student} ·{' '}
                  {session.questions_asked}/{session.question_budget} questions · {session.mode} ·{' '}
                  {formatDate(session.started_at ?? session.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/submissions/${session.submission}`} className="text-xs text-blue-700 hover:underline">
                  Submission
                </Link>
                <Badge
                  tone={
                    session.integrity_terminated
                      ? 'warning'
                      : session.state === 'COMPLETED'
                        ? 'success'
                        : session.state === 'FAILED'
                          ? 'danger'
                          : 'info'
                  }
                >
                  {session.integrity_terminated ? 'Integrity stop' : session.state}
                </Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
