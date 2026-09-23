import { Link } from 'react-router-dom'
import { coursesApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'

export function CoursesPage() {
  const { data, loading, error, reload } = useAsync(() => coursesApi.list())

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Courses in your organization."
        actions={
          <Link to="/courses/new">
            <Button>Create course</Button>
          </Link>
        }
      />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.courses} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create a course, then share the join code with students."
          action={
            <Link to="/courses/new">
              <Button>Create course</Button>
            </Link>
          }
        />
      ) : null}
      <div className="grid gap-2">
        {data?.map((course) => (
          <Card key={course.id} hover>
            <CardBody className="py-4">
              <Link
                to={`/courses/${course.id}`}
                className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
              >
                {course.code} — {course.title}
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
