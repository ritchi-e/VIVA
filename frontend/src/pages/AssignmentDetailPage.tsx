import { Link, useParams } from 'react-router-dom'
import { assignmentsApi, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState, EmptyState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { InstructionsHtml } from '@/components/ui/RichTextInstructions'
import { formatDate } from '@/lib/utils'

export function AssignmentDetailPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const submissions = useAsync(() => submissionsApi.list({ assignment: id }), [id])

  if (loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  const isDraft = data.status === 'draft'
  const budget =
    typeof data.viva_config?.question_budget === 'number'
      ? data.viva_config.question_budget
      : null

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.title}
        description={`Due ${formatDate(data.due_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="assignment" value={data.status} />
            {isDraft ? (
              <Link to={`/assignments/${id}/settings`}>
                <Button>Finish setup & publish</Button>
              </Link>
            ) : (
              <Link to={`/submissions?assignment=${id}`}>
                <Button>Review submissions</Button>
              </Link>
            )}
          </div>
        }
      />

      {isDraft ? (
        <Alert
          tone="warning"
          title="This assessment is still a draft"
          action={
            <Link to={`/assignments/${id}/settings`}>
              <Button>Open setup</Button>
            </Link>
          }
        >
          Students cannot access it until you publish. Confirm the rubric pack and viva settings first.
        </Alert>
      ) : null}

      <Card>
        <CardBody className="space-y-3 text-sm text-[var(--color-muted)]">
          <InstructionsHtml html={data.instructions} empty="No instructions yet." />
          <p>
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
            {budget != null ? ` · About ${budget} viva questions` : ''}
          </p>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link to={`/assignments/${id}/settings`}>
          <Button variant="secondary">Setup (settings & rubric)</Button>
        </Link>
        <Link to={`/assignments/${id}/booked-slots`}>
          <Button variant="secondary">Booked slots</Button>
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Recent submissions</h2>
            <Link to={`/submissions?assignment=${id}`} className="mk-link text-sm">
              All submissions
            </Link>
          </div>
          {submissions.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.submissions} /> : null}
          {!submissions.loading && (submissions.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No submissions yet"
              description="Students appear here after they upload work for this assignment."
            />
          ) : (
            <ul className="space-y-3">
              {(submissions.data || []).slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link to={`/submissions/${s.id}`} className="mk-link">
                    {s.student_name || s.student_email || 'Student'}
                  </Link>
                  <StatusBadge kind="submission" value={s.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
