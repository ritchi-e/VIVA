import { Link, useParams } from 'react-router-dom'
import { assessmentsApi, submissionsApi, vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function StudentSubmissionPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(() => submissionsApi.get(id).then((r) => r.data), [id])
  const sessions = useAsync(
    () => (data?.assignment ? vivaApi.list({ assignment: data.assignment }) : Promise.resolve([])),
    [data?.assignment],
  )
  const assessment = useAsync(
    () => (data?.id ? assessmentsApi.bySubmission(data.id) : Promise.resolve(null)),
    [data?.id],
  )

  if (loading) return <ProgressPanel copy={PLATFORM_PROGRESS.submissions} />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  const relatedSessions = (sessions.data || []).filter((s) => s.submission === data.id)

  return (
    <div>
      <PageHeader
        title={data.assignment_title || 'Your submission'}
        description={`Version ${data.version}`}
      />
      <Card className="mb-4">
        <CardBody className="space-y-2 text-sm text-slate-700">
          <p>
            Status:{' '}
            <Badge tone={data.status === 'ready' ? 'success' : data.status === 'failed' ? 'danger' : 'warning'}>
              {data.status}
            </Badge>
          </p>
          <p>Submitted: {formatDate(data.created_at)}</p>
          {data.processed_at ? <p>Processed: {formatDate(data.processed_at)}</p> : null}
          {data.github_url ? (
            <a href={data.github_url} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
              {data.github_url}
            </a>
          ) : null}
          {data.processing_error ? <p className="text-red-600">{data.processing_error}</p> : null}
          <Link to={`/student/assignments/${data.assignment}`} className="inline-block text-blue-700 hover:underline">
            Back to assignment
          </Link>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Viva sessions for this submission</h2>
          {relatedSessions.length === 0 ? (
            <p className="text-sm text-slate-600">No viva started yet for this submission.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {relatedSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <Link to={`/student/viva/${s.id}`} className="text-blue-700 hover:underline">
                    Session · {s.questions_asked}/{s.question_budget}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge>{s.state}</Badge>
                    {['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state) ? (
                      <Link to={`/student/results/${s.id}`} className="text-xs text-blue-700 hover:underline">
                        Results
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {assessment.data ? (
        <Card>
          <CardBody className="text-sm">
            <p className="font-medium text-slate-900">Assessment status: {assessment.data.status}</p>
            <Link
              to={`/student/results/${assessment.data.viva_session}`}
              className="mt-2 inline-block text-blue-700 hover:underline"
            >
              View results →
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
