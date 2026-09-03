import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  assignmentsApi,
  assessmentsApi,
  submissionsApi,
  vivaApi,
  slotsApi,
  getApiErrorMessage,
  type SlotBooking,
} from '@/lib/api'
import { formatVivaErrorMessage } from '@/lib/userErrors'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PreparingVivaOverlay } from '@/components/viva/PreparingVivaOverlay'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { formatDate, formatScore } from '@/lib/utils'

function slotTimeLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StudentDashboardPage() {
  const navigate = useNavigate()
  const assignments = useAsync(() => assignmentsApi.list())
  const submissions = useAsync(() => submissionsApi.list())
  const sessions = useAsync(() => vivaApi.list())
  const bookings = useAsync(() => slotsApi.my())
  const assessments = useAsync(() => assessmentsApi.list())
  const [startingViva, setStartingViva] = useState(false)
  const [vivaError, setVivaError] = useState<string | null>(null)

  const startVivaFromBooking = async (b: SlotBooking) => {
    setStartingViva(true)
    setVivaError(null)
    try {
      const response = await vivaApi.start({
        assignment: b.assignment,
        submission: b.submission,
        mode: 'text',
      })
      const sessionId = response.data?.id ? String(response.data.id) : ''
      if (!sessionId || sessionId === 'undefined') {
        setVivaError('Could not start the viva. Please try again.')
        return
      }
      if (response.data.state === 'FAILED') {
        setVivaError(formatVivaErrorMessage(response.data.error_message))
        return
      }
      navigate(`/student/viva/${sessionId}`)
    } catch (err) {
      setVivaError(getApiErrorMessage(err))
    } finally {
      setStartingViva(false)
    }
  }

  const published = (assignments.data || []).filter((a) => a.status === 'published')
  const recentSessions = (sessions.data || []).slice(0, 5)
  const recentSubs = (submissions.data || []).slice(0, 5)
  const completedAssessments = (assessments.data || []).filter(
    (a) => a.overall_score != null || a.ai_overall_score != null,
  )
  const scoreValues = completedAssessments
    .map((a) => a.overall_score ?? a.ai_overall_score)
    .filter((n): n is number => n != null)
  const averageScore = scoreValues.length
    ? scoreValues.reduce((sum, n) => sum + n, 0) / scoreValues.length
    : null
  const completedVivas = (sessions.data || []).filter((s) =>
    ['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state),
  ).length

  return (
    <div>
      {startingViva && <PreparingVivaOverlay />}
      <PageHeader
        title="Student dashboard"
        description="Your assignments, submissions, and viva progress."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card hover>
          <CardBody>
            <p className="text-sm font-medium text-[var(--color-muted)]">Open assignments</p>
            <p className="mk-kpi mt-2">{published.length}</p>
          </CardBody>
        </Card>
        <Card hover>
          <CardBody>
            <p className="text-sm font-medium text-[var(--color-muted)]">Submissions</p>
            <p className="mk-kpi mt-2">{submissions.data?.length ?? '—'}</p>
          </CardBody>
        </Card>
        <Card hover>
          <CardBody>
            <p className="text-sm font-medium text-[var(--color-muted)]">Vivas completed</p>
            <p className="mk-kpi mt-2">{sessions.data ? completedVivas : '—'}</p>
          </CardBody>
        </Card>
        <Card hover>
          <CardBody>
            <p className="text-sm font-medium text-[var(--color-muted)]">Average score</p>
            <p className="mk-kpi mt-2">
              {averageScore == null ? '—' : formatScore(averageScore)}
            </p>
          </CardBody>
        </Card>
      </div>

      {vivaError && (
        <div className="mt-4 rounded-[var(--radius-control)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {vivaError}
        </div>
      )}

      {(assignments.loading || submissions.loading || sessions.loading) && (
        <div className="mt-5">
          <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} />
        </div>
      )}

      {(bookings.data ?? []).filter((b) => b.status === 'booked' || b.status === 'started').length >
        0 && (
        <Card className="mt-5">
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--color-foreground)]">
              Upcoming booked slots
            </h2>
            <ul className="space-y-2">
              {bookings.data!
                .filter((b) => b.status === 'booked' || b.status === 'started')
                .map((b) => {
                  const startsAt = new Date(b.slot_start)
                  const endsAt = new Date(b.slot_end)
                  const now = new Date()
                  const expired = now > endsAt
                  const canJoin = !expired && (b.status === 'started' || startsAt <= now)
                  const sessionState = b.viva_session_state || null
                  const sessionFailed = sessionState === 'FAILED'
                  const sessionDone =
                    sessionState === 'COMPLETED' || sessionState === 'REVIEW_REQUIRED'
                  const joinableSession =
                    Boolean(b.viva_session_id) &&
                    !sessionFailed &&
                    !sessionDone &&
                    (!sessionState ||
                      ['READY', 'IN_PROGRESS', 'PREPARING', 'CREATED'].includes(sessionState))
                  return (
                    <li
                      key={b.id}
                      className={`flex flex-col gap-3 rounded-[var(--radius-control)] border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                        expired
                          ? 'border-red-100 bg-red-50/50'
                          : 'border-[var(--color-border)] bg-[var(--color-sidebar-active)]/40'
                      }`}
                    >
                      <div>
                        <p className="text-base font-semibold text-[var(--color-foreground)]">
                          {b.assignment_title}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                          {slotTimeLabel(b.slot_start)} — {slotTimeLabel(b.slot_end)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {expired ? (
                          <span className="text-sm font-medium text-red-600">Slot expired</span>
                        ) : sessionDone ? (
                          <span className="text-sm font-medium text-emerald-700">Completed</span>
                        ) : sessionFailed && canJoin && b.viva_session_id ? (
                          <Button
                            className="px-3 py-2 text-sm"
                            onClick={() => navigate(`/student/viva/${b.viva_session_id}`)}
                          >
                            Retry viva prep
                          </Button>
                        ) : canJoin && joinableSession ? (
                          <Button
                            className="px-3 py-2 text-sm"
                            onClick={() => navigate(`/student/viva/${b.viva_session_id}`)}
                          >
                            Join viva
                          </Button>
                        ) : canJoin ? (
                          <Button
                            className="px-3 py-2 text-sm"
                            loading={startingViva}
                            onClick={() => startVivaFromBooking(b)}
                          >
                            Start viva
                          </Button>
                        ) : (
                          <span className="text-sm text-[var(--color-muted)]">
                            Starts{' '}
                            {startsAt.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">
                Recent viva sessions
              </h2>
              <Link to="/student/assignments" className="mk-link text-sm">
                Assignments
              </Link>
            </div>
            {recentSessions.length === 0 ? (
              <p className="text-base text-[var(--color-muted)]">
                No viva sessions yet. Book a slot after your submission is ready.
              </p>
            ) : (
              <ul className="space-y-3">
                {recentSessions.map((s) => {
                  const done = ['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state)
                  const href = done
                    ? `/student/results/${s.id}`
                    : `/student/assignments/${s.assignment}`
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <Link
                          to={href}
                          className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                        >
                          {s.assignment_title || 'Viva session'}
                        </Link>
                        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                          {s.questions_asked}/{s.question_budget} ·{' '}
                          {formatDate(s.started_at ?? s.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={s.state === 'COMPLETED' ? 'success' : 'info'}>{s.state}</Badge>
                        {done ? (
                          <Link to={`/student/results/${s.id}`} className="mk-link text-sm">
                            Analysis
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--color-foreground)]">
              Recent submissions
            </h2>
            {recentSubs.length === 0 ? (
              <p className="text-base text-[var(--color-muted)]">No submissions yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentSubs.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3 last:border-0 last:pb-0"
                  >
                    <Link
                      to={`/student/submissions/${s.id}`}
                      className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                    >
                      {s.assignment_title || 'Submission'}
                    </Link>
                    <Badge
                      tone={
                        s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'default'
                      }
                    >
                      {s.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {completedAssessments.length > 0 ? (
        <Card className="mt-5">
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--color-foreground)]">
              Your performance
            </h2>
            <ul className="space-y-3">
              {completedAssessments.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3 last:border-0 last:pb-0"
                >
                  <div>
                    <Link
                      to={`/student/results/${a.viva_session}`}
                      className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                    >
                      {a.assignment_title || 'Viva analysis'}
                    </Link>
                    <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                      {a.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="font-display text-xl font-semibold tabular-nums text-[var(--color-primary)]">
                    {formatScore(a.overall_score ?? a.ai_overall_score)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
