import { Link, useParams } from 'react-router-dom'
import { coursesApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'

export function CourseStudentsPage() {
  const { courseId = '' } = useParams()
  const { data, loading, error, reload } = useAsync(
    () => coursesApi.enrollments(courseId).then((list) => list.filter((e) => e.role === 'student')),
    [courseId],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-muted)]">
          {data?.length ?? 0} student{(data?.length ?? 0) === 1 ? '' : 's'} enrolled
        </p>
        <Link to={`/courses/${courseId}`}>
          <Button variant="secondary">Invite / class code</Button>
        </Link>
      </div>

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.students} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No students yet"
          description="Share this course’s join code or invite link so students can enroll."
          action={
            <Link to={`/courses/${courseId}`}>
              <Button>Open invite</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-2">
        {data?.map((enrollment) => (
          <Card key={enrollment.id} hover>
            <CardBody className="py-4">
              <Link
                to={`/students/${enrollment.user.id}`}
                className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
              >
                {enrollment.user.full_name || enrollment.user.email}
              </Link>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{enrollment.user.email}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
