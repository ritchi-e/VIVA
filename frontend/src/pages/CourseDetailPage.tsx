import { Link, useParams } from 'react-router-dom'
import { coursesApi, assignmentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'

export function CourseDetailPage() {
  const { id = '' } = useParams()
  const course = useAsync(() => coursesApi.get(id).then((r) => r.data), [id])
  const assignments = useAsync(() => assignmentsApi.list({ course: id }), [id])

  if (course.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.courses} />
  if (course.error || !course.data) return <ErrorState message={course.error ?? 'Course not found'} onRetry={course.reload} />

  return (
    <div>
      <PageHeader
        title={`${course.data.code} — ${course.data.title}`}
        description={course.data.description || 'Course details'}
      />
      <Card className="mb-6">
        <CardBody>
          <p className="text-sm text-slate-600">{course.data.description || 'No description provided.'}</p>
        </CardBody>
      </Card>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Assignments</h2>
      {assignments.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {assignments.error ? <ErrorState message={assignments.error} onRetry={assignments.reload} /> : null}
      <div className="space-y-3">
        {assignments.data?.map((a) => (
          <Card key={a.id}>
            <CardBody>
              <Link to={`/assignments/${a.id}`} className="mk-link">
                {a.title}
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
