import { Link } from 'react-router-dom'
import { coursesApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'

export function StudentDashboardPage() {
  const { data, loading, error, reload } = useAsync(() => coursesApi.list())

  return (
    <div className="space-y-5">
      <PageHeader
        title="Home"
        description="Open a class from the sidebar, or join one with a class code."
        actions={
          <Link to="/student/join">
            <Button>Join course</Button>
          </Link>
        }
      />

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {!loading && !error && (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="You’re not in any classes yet"
          description="Ask your instructor for a class code, then join to see assignments and book vivas."
          action={
            <Link to="/student/join">
              <Button>Join course</Button>
            </Link>
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((course) => (
          <Card key={course.id} hover>
            <CardBody className="py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                {course.code}
              </p>
              <Link
                to={`/student/courses/${course.id}`}
                className="mt-1 block font-display text-lg font-bold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
              >
                {course.title}
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/student/courses/${course.id}`}>
                  <Button variant="secondary" className="!px-3 !py-1.5 text-sm">
                    Assignments
                  </Button>
                </Link>
                <Link to={`/student/courses/${course.id}/viva`}>
                  <Button variant="ghost" className="!px-3 !py-1.5 text-sm">
                    Viva
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
