import { Link, useParams } from 'react-router-dom'
import { submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardBody } from '@/components/ui/Card'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'

export function CourseReviewsPage() {
  const { courseId = '' } = useParams()
  const { data, loading, error, reload } = useAsync(
    () => submissionsApi.list({ course: courseId }),
    [courseId],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">Submissions and reviews for this course</p>

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.submissions} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="When students submit work for this course, reviews appear here."
        />
      ) : null}

      <div className="space-y-2">
        {data?.map((submission) => (
          <Card key={submission.id} hover>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link
                  to={`/submissions/${submission.id}`}
                  className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                >
                  {submission.student_name || submission.student_email || 'Student'}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {submission.assignment_title}
                  {submission.created_at ? ` · ${formatDate(submission.created_at)}` : ''}
                </p>
              </div>
              <StatusBadge kind="submission" value={submission.status} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
