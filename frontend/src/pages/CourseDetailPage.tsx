import { Link, useParams } from 'react-router-dom'
import { coursesApi, assignmentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'

export function CourseDetailPage() {
  const { id = '' } = useParams()
  const course = useAsync(() => coursesApi.get(id).then((r) => r.data), [id])
  const assignments = useAsync(() => assignmentsApi.list({ course: id }), [id])

  if (course.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.courses} />
  if (course.error || !course.data) {
    return <ErrorState message={course.error ?? 'Course not found'} onRetry={course.reload} />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${course.data.code} — ${course.data.title}`}
        description={course.data.description || 'Course details'}
        actions={
          <Link to={`/assignments/new?course=${id}`}>
            <Button>Create assignment</Button>
          </Link>
        }
      />
      <h2 className="font-display text-lg font-semibold">Assignments</h2>
      {assignments.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {assignments.error ? <ErrorState message={assignments.error} onRetry={assignments.reload} /> : null}
      {!assignments.loading && (assignments.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Create an assignment for this course, then publish it when ready."
          action={
            <Link to={`/assignments/new?course=${id}`}>
              <Button>Create assignment</Button>
            </Link>
          }
        />
      ) : null}
      <div className="space-y-2">
        {assignments.data?.map((a) => (
          <Card key={a.id} hover>
            <CardBody className="flex items-center justify-between gap-3 py-4">
              <Link to={`/assignments/${a.id}`} className="text-base font-semibold hover:text-[var(--color-primary)]">
                {a.title}
              </Link>
              <StatusBadge kind="assignment" value={a.status} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
