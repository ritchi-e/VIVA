import { Link } from 'react-router-dom'
import { assignmentsApi, submissionsApi, vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'

export function StudentDashboardPage() {
  const assignments = useAsync(() => assignmentsApi.list())
  const submissions = useAsync(() => submissionsApi.list())
  const sessions = useAsync(() => vivaApi.list())

  const published = (assignments.data || []).filter((a) => a.status === 'published')
  const recentSessions = (sessions.data || []).slice(0, 5)
  const recentSubs = (submissions.data || []).slice(0, 5)

  return (
    <div>
      <PageHeader title="Student dashboard" description="Your assignments, submissions, and viva progress." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Open assignments</p>
            <p className="mt-2 text-3xl font-semibold">{published.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Submissions</p>
            <p className="mt-2 text-3xl font-semibold">{submissions.data?.length ?? '—'}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Viva sessions</p>
            <p className="mt-2 text-3xl font-semibold">{sessions.data?.length ?? '—'}</p>
          </CardBody>
        </Card>
      </div>

      {(assignments.loading || submissions.loading || sessions.loading) && (
        <div className="mt-6">
          <LoadingPanel />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent viva sessions</h2>
              <Link to="/student/assignments" className="text-xs font-medium text-blue-700 hover:underline">
                Assignments
              </Link>
            </div>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-slate-600">No viva sessions yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentSessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <Link to={`/student/viva/${s.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                        {s.assignment_title || 'Viva session'}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {s.questions_asked}/{s.question_budget} · {formatDate(s.started_at ?? s.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.state === 'COMPLETED' ? 'success' : 'info'}>{s.state}</Badge>
                      {['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state) ? (
                        <Link to={`/student/results/${s.id}`} className="text-xs text-blue-700 hover:underline">
                          Results
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent submissions</h2>
            {recentSubs.length === 0 ? (
              <p className="text-sm text-slate-600">No submissions yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentSubs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to={`/student/submissions/${s.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {s.assignment_title || 'Submission'}
                    </Link>
                    <Badge tone={s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'default'}>
                      {s.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
