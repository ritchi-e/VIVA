import { Link } from 'react-router-dom'
import { reportsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'
import type { DashboardMetrics } from '@/types'

export function ReportsPage() {
  const { data, loading, error, reload } = useAsync(() =>
    reportsApi.summary().then((r) => r.data as DashboardMetrics),
  )

  return (
    <div>
      <PageHeader title="Reports" description="Organization-level analytics from live assessment data." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">Published assignments</p>
                <p className="mt-2 text-2xl font-semibold">{data.active_assignments}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">Submissions processing</p>
                <p className="mt-2 text-2xl font-semibold">{data.pending_submissions}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">Assessments pending review</p>
                <p className="mt-2 text-2xl font-semibold">{data.students_requiring_review}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">Average assessment score</p>
                <p className="mt-2 text-2xl font-semibold">
                  {data.average_assessment != null ? `${data.average_assessment}%` : '—'}
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Viva completion</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Completed</dt>
                    <dd className="font-medium">{data.viva_completion.completed}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">In progress</dt>
                    <dd className="font-medium">{data.viva_completion.in_progress}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Failed</dt>
                    <dd className="font-medium">{data.viva_completion.failed}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <dt className="text-slate-500">Total sessions</dt>
                    <dd className="font-medium">{data.viva_completion.total}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Assessment status distribution</h2>
                {data.assessment_distribution.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No finalized assessments yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm">
                    {data.assessment_distribution.map((row) => (
                      <li key={row.status} className="flex items-center justify-between">
                        <span className="text-slate-600">{row.status.replace(/_/g, ' ')}</span>
                        <Badge>{row.count}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-slate-900">Recent viva sessions</h2>
              {data.recent_sessions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">No sessions recorded yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-4 font-medium">Assignment</th>
                        <th className="py-2 pr-4 font-medium">Student</th>
                        <th className="py-2 pr-4 font-medium">Progress</th>
                        <th className="py-2 pr-4 font-medium">State</th>
                        <th className="py-2 font-medium">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_sessions.map((session) => (
                        <tr key={session.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4">
                            <Link to={`/viva-sessions/${session.id}`} className="text-blue-700 hover:underline">
                              {session.assignment_title}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">{session.student_name}</td>
                          <td className="py-3 pr-4">
                            {session.questions_asked}/{session.question_budget}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge tone={session.state === 'COMPLETED' ? 'success' : 'info'}>{session.state}</Badge>
                          </td>
                          <td className="py-3">{formatDate(session.started_at ?? session.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
