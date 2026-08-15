import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

const TEAL = '#0f766e'
const CYAN = '#0891b2'
const AMBER = '#d97706'
const SLATE = '#64748b'
const STATUS_COLORS = [TEAL, CYAN, AMBER, SLATE, '#0e7490']

export function ReportsPage() {
  const { data, loading, error, reload } = useAsync(() =>
    reportsApi.summary().then((r) => r.data as DashboardMetrics),
  )

  const completionPie = data
    ? [
        { name: 'Completed', value: data.viva_completion.completed },
        { name: 'In progress', value: data.viva_completion.in_progress },
        { name: 'Failed', value: data.viva_completion.failed },
        { name: 'Integrity stops', value: data.viva_completion.integrity_terminated ?? data.integrity_terminations ?? 0 },
      ].filter((row) => row.value > 0)
    : []

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
                <p className="text-sm text-slate-500">Average assessment score</p>
                <p className="mt-2 text-2xl font-semibold">
                  {data.average_assessment != null ? `${data.average_assessment}%` : '—'}
                </p>
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
                <p className="text-sm text-slate-500">Integrity stops</p>
                <p className="mt-2 text-2xl font-semibold">{data.integrity_terminations ?? 0}</p>
                <Link to="/viva-sessions" className="mt-2 inline-block text-xs text-teal-800 hover:underline">
                  View sessions
                </Link>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Completions over time</h2>
                {(data.sessions_by_day ?? []).length === 0 ? (
                  <p className="mt-8 text-sm text-slate-500">No completed sessions in the last 30 days.</p>
                ) : (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.sessions_by_day}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="completed" stroke={TEAL} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="failed" stroke={AMBER} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Sessions by assignment</h2>
                {(data.by_assignment ?? []).length === 0 ? (
                  <p className="mt-8 text-sm text-slate-500">No viva sessions yet.</p>
                ) : (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(data.by_assignment ?? []).map((row) => ({
                          ...row,
                          name:
                            row.assignment_title.length > 18
                              ? `${row.assignment_title.slice(0, 18)}…`
                              : row.assignment_title,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completed" fill={TEAL} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="failed" fill={AMBER} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Viva outcomes</h2>
                {completionPie.length === 0 ? (
                  <p className="mt-8 text-sm text-slate-500">No sessions recorded yet.</p>
                ) : (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={completionPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                          {completionPie.map((entry, index) => (
                            <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Score distribution</h2>
                {(data.score_buckets ?? []).every((row) => row.count === 0) ? (
                  <p className="mt-8 text-sm text-slate-500">No scored assessments yet.</p>
                ) : (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.score_buckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill={CYAN} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {(data.criterion_averages ?? []).length > 0 ? (
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-slate-900">Rubric criterion averages</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.criterion_averages} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="average" fill={TEAL} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          ) : null}

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
                            <Badge
                              tone={
                                session.integrity_terminated
                                  ? 'warning'
                                  : session.state === 'COMPLETED'
                                    ? 'success'
                                    : session.state === 'FAILED'
                                      ? 'danger'
                                      : 'info'
                              }
                            >
                              {session.integrity_terminated ? 'Integrity stop' : session.state}
                            </Badge>
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
