import { Link } from 'react-router-dom'
import { assignmentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function AssignmentsPage() {
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.list())

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Published and draft viva assignments."
        actions={
          <Link to="/assignments/new">
            <Button>Create assignment</Button>
          </Link>
        }
      />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Create one assignment with brief, rubric, and viva settings in a single form."
          action={
            <Link to="/assignments/new">
              <Button>Create assignment</Button>
            </Link>
          }
        />
      ) : null}
      <div className="space-y-2">
        {data?.map((assignment) => (
          <Card key={assignment.id} hover>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link
                  to={`/assignments/${assignment.id}`}
                  className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                >
                  {assignment.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Due {formatDate(assignment.due_at)}</p>
              </div>
              <Badge tone={assignment.status === 'published' ? 'success' : 'default'}>
                {assignment.status}
              </Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
