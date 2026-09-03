import { Link, useSearchParams } from 'react-router-dom'
import { submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
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
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.submissions} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No submissions" description="Submissions appear when students upload assignments." />
      ) : null}
      <div className="space-y-2">
        {data?.map((s) => (
          <Card key={s.id} hover>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link to={`/submissions/${s.id}`} className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
                  {s.assignment_title || 'Submission'} · v{s.version}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {s.student_name || s.student_email || s.student} · {formatDate(s.created_at)}
                </p>
                {s.assignment_mismatch ? (
                  <p className="mt-1 text-sm font-medium text-amber-800">Not related to this assignment</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/assignments/${s.assignment}`} className="mk-link text-sm">
                  Assignment
                </Link>
                <div className="flex items-center gap-2">
                  {s.plagiarism_flagged ? <Badge tone="warning">Similarity</Badge> : null}
                  {s.assignment_mismatch ? <Badge tone="warning">Unrelated</Badge> : null}
                  <Badge tone={s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'info'}>
                    {s.status}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
