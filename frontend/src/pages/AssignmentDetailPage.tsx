import { Link, useParams } from 'react-router-dom'
import { assignmentsApi, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function AssignmentDetailPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const submissions = useAsync(() => submissionsApi.list({ assignment: id }), [id])

  if (loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title={data.title}
        description={`Due ${formatDate(data.due_at)} · ${data.status}`}
        actions={
          <>
            <Link to={`/assignments/${id}/rubric`}>
              <Button variant="secondary">Rubric</Button>
            </Link>
            <Link to={`/assignments/${id}/settings`}>
              <Button variant="secondary">Settings</Button>
            </Link>
            <Link to={`/submissions?assignment=${id}`}>
              <Button variant="secondary">All submissions</Button>
            </Link>
          </>
        }
      />
      <Card className="mb-6">
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>{data.description || 'No description.'}</p>
          <p className="whitespace-pre-wrap">{data.instructions || 'No instructions.'}</p>
          <p className="text-xs text-slate-500">
            Allowed:{' '}
            {[
              data.allow_pdf && 'PDF',
              data.allow_docx && 'DOCX',
              data.allow_pptx && 'PPTX',
              data.allow_zip && 'ZIP',
              data.allow_github && 'GitHub',
            ]
              .filter(Boolean)
              .join(', ') || 'None'}
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent submissions</h2>
          {submissions.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.submissions} /> : null}
          {!submissions.loading && (submissions.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-600">No submissions yet.</p>
          ) : (
            <ul className="space-y-3">
              {(submissions.data || []).slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link to={`/submissions/${s.id}`} className="font-medium text-blue-700 hover:underline">
                    {s.student_name || s.student_email || 'Student'}
                  </Link>
                  <Badge tone={s.status === 'ready' ? 'success' : 'default'}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
