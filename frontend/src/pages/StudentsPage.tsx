import { Link } from 'react-router-dom'
import { studentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'

export function StudentsPage() {
  const { data, loading, error, reload } = useAsync(() => studentsApi.list())

  return (
    <div>
      <PageHeader title="Students" description="Learners enrolled in your organization." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.students} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No students" description="Invite students to your organization to see them here." />
      ) : null}
      <div className="space-y-3">
        {data?.map((student) => (
          <Card key={student.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/students/${student.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                  {student.full_name || student.email}
                </Link>
                <p className="mt-1 text-sm text-slate-500">{student.email}</p>
              </div>
              <div className="text-sm text-slate-500">
                {student.submissions_count ?? 0} submissions · {student.viva_sessions_count ?? 0} vivas
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
