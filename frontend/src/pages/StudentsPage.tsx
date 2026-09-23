import { Link } from 'react-router-dom'
import { studentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'

export function StudentsPage() {
  const { isOrgAdmin } = useAuth()
  const { data, loading, error, reload } = useAsync(() => studentsApi.list())

  return (
    <div>
      <PageHeader title="Students" description="Learners in your organization." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.students} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState
          title="No students yet"
          description={
            isOrgAdmin
              ? 'Add student members from Admin so they can join assessments.'
              : 'Ask your organization admin to add students.'
          }
          action={
            isOrgAdmin ? (
              <Link to="/admin">
                <Button>Open Admin</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}
      <div className="space-y-2">
        {data?.map((student) => (
          <Card key={student.id} hover>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link
                  to={`/students/${student.id}`}
                  className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                >
                  {student.full_name || student.email}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{student.email}</p>
              </div>
              <div className="text-sm text-[var(--color-muted)]">
                {student.submissions_count ?? 0} submissions · {student.viva_sessions_count ?? 0} vivas
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
