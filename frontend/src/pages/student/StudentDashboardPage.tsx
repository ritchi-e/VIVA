import { useMemo, useState } from 'react'
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
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PreparingVivaOverlay } from '@/components/viva/PreparingVivaOverlay'
import { StudentAssessmentCard } from '@/components/student/StudentAssessmentCard'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/layout/StateViews'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { formatDate, formatScore } from '@/lib/utils'
import type { Submission } from '@/types'

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
        mode: 'voice',
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

  const published = useMemo(
    () => (assignments.data || []).filter((a) => a.status === 'published'),
    [assignments.data],
  )
  const subsByAssignment = useMemo(() => {
    const map = new Map<string, Submission>()
    for (const s of submissions.data || []) {
      const prev = map.get(s.assignment)
      if (!prev || (s.version ?? 0) > (prev.version ?? 0)) map.set(s.assignment, s)
    }
    return map
  }, [submissions.data])

  const actionCards = useMemo(() => {
    return published.map((a) => {
      const sub = subsByAssignment.get(a.id)
      const booking = (bookings.data || []).find(
        (b) => b.assignment === a.id && (b.status === 'booked' || b.status === 'started'),
      )
      const session = (sessions.data || []).find((s) => s.assignment === a.id)
      const done = session && ['COMPLETED', 'REVIEW_REQUIRED'].includes(session.state)

      if (done && session) {
        return {
          key: a.id,
          title: a.title,
          dueAt: a.due_at,
          statusLabel: 'Viva completed',
          statusKind: 'viva' as const,
          statusValue: session.state,
          primaryLabel: 'View results',
          primaryTo: `/student/results/${session.id}`,
          secondaryLabel: 'Assignment',
          secondaryTo: `/student/assignments/${a.id}`,
        }
      }

      if (booking) {
        const startsAt = new Date(booking.slot_start)
        const endsAt = new Date(booking.slot_end)
        const now = new Date()
        const expired = now > endsAt
        const canJoin = !expired && (booking.status === 'started' || startsAt <= now)
        const sessionState = booking.viva_session_state || null
        const sessionFailed = sessionState === 'FAILED'
        const joinableSession =
          Boolean(booking.viva_session_id) &&
          !sessionFailed &&
          (!sessionState ||
            ['READY', 'IN_PROGRESS', 'PREPARING', 'CREATED'].includes(sessionState))

        if (expired) {
          return {
            key: a.id,
            title: a.title,
            dueAt: a.due_at,
            statusLabel: 'Slot expired — book another time',
            statusKind: 'booking' as const,
            statusValue: 'no_show',
            primaryLabel: 'Book viva slot',
            primaryTo: `/student/assignments/${a.id}/book-slot`,
          }
        }
        if (canJoin && joinableSession && booking.viva_session_id) {
          return {
            key: a.id,
            title: a.title,
            dueAt: a.due_at,
            statusLabel: `Slot open · ${slotTimeLabel(booking.slot_start)}`,
            statusKind: 'booking' as const,
            statusValue: booking.status,
            primaryLabel: sessionFailed ? 'Retry viva prep' : 'Join viva',
            primaryTo: `/student/viva/${booking.viva_session_id}`,
          }
        }
        if (canJoin) {
          return {
            key: a.id,
            title: a.title,
            dueAt: a.due_at,
            statusLabel: `Slot open · ${slotTimeLabel(booking.slot_start)}`,
            statusKind: 'booking' as const,
            statusValue: booking.status,
            primaryLabel: 'Start viva',
            onPrimary: () => void startVivaFromBooking(booking),
            primaryLoading: startingViva,
          }
        }
        return {
          key: a.id,
          title: a.title,
          dueAt: a.due_at,
          statusLabel: `Booked for ${slotTimeLabel(booking.slot_start)}`,
          statusKind: 'booking' as const,
          statusValue: booking.status,
          primaryLabel: 'View booking',
          primaryTo: `/student/assignments/${a.id}/book-slot`,
        }
      }

      if (sub?.status === 'ready') {
        return {
          key: a.id,
          title: a.title,
          dueAt: a.due_at,
          statusLabel: 'Submission ready — book your viva',
          statusKind: 'submission' as const,
          statusValue: sub.status,
          primaryLabel: 'Book viva slot',
          primaryTo: `/student/assignments/${a.id}/book-slot`,
          secondaryLabel: 'View submission',
          secondaryTo: `/student/submissions/${sub.id}`,
        }
      }

      if (sub && ['uploaded', 'queued', 'processing'].includes(sub.status)) {
        return {
          key: a.id,
          title: a.title,
          dueAt: a.due_at,
          statusLabel: 'Preparing your submission for the viva',
          statusKind: 'submission' as const,
          statusValue: sub.status,
          primaryLabel: 'Check status',
          primaryTo: `/student/assignments/${a.id}`,
        }
      }

      if (sub?.status === 'failed') {
        return {
          key: a.id,
          title: a.title,
          dueAt: a.due_at,
          statusLabel: 'Submission needs a fix — reopen the assignment',
          statusKind: 'submission' as const,
          statusValue: sub.status,
          primaryLabel: 'Fix submission',
          primaryTo: `/student/assignments/${a.id}`,
        }
      }

      return {
        key: a.id,
        title: a.title,
        dueAt: a.due_at,
        statusLabel: 'Not started — submit your work first',
        statusKind: 'assignment' as const,
        statusValue: a.status,
        primaryLabel: 'Open assessment',
        primaryTo: `/student/assignments/${a.id}`,
      }
    })
  }, [published, subsByAssignment, bookings.data, sessions.data, startingViva])

  const completedAssessments = (assessments.data || []).filter(
    (a) => a.overall_score != null || a.ai_overall_score != null,
  )

  const loading = assignments.loading || submissions.loading || sessions.loading || bookings.loading

  return (
    <div className="space-y-5">
      {startingViva && <PreparingVivaOverlay />}
      <PageHeader
        title="Your assessments"
        description="Do the next step for each viva. Estimated viva time is usually 10–15 minutes."
      />

      {vivaError ? (
        <Alert tone="danger" title="Could not start viva">
          {vivaError}
        </Alert>
      ) : null}

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}

      {!loading && actionCards.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="When your instructor publishes an assignment, it will appear here."
          action={
            <Link to="/student/assignments">
              <Button variant="secondary">Browse assignments</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-3">
        {actionCards.map((card) => (
          <StudentAssessmentCard
            key={card.key}
            title={card.title}
            dueAt={card.dueAt}
            statusLabel={card.statusLabel}
            statusKind={card.statusKind}
            statusValue={card.statusValue}
            primaryLabel={card.primaryLabel}
            primaryTo={card.primaryTo}
            onPrimary={card.onPrimary}
            primaryLoading={card.primaryLoading}
            secondaryLabel={card.secondaryLabel}
            secondaryTo={card.secondaryTo}
          />
        ))}
      </div>

      {completedAssessments.length > 0 ? (
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Recent results</h2>
              <Link to="/student/results" className="mk-link text-sm">
                All results
              </Link>
            </div>
            <ul className="space-y-3">
              {completedAssessments.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                  <div>
                    <Link
                      to={`/student/results/${a.viva_session}`}
                      className="text-base font-semibold hover:text-[var(--color-primary)]"
                    >
                      {a.assignment_title || 'Result'}
                    </Link>
                    <p className="text-sm text-[var(--color-muted)]">
                      <StatusBadge kind="assessment" value={a.status} />
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

      <p className="text-xs text-[var(--color-muted)]">
        Tip: after you submit, wait until the status is “Ready for viva”, then book a slot.
        {submissions.data?.[0]?.created_at
          ? ` Latest upload ${formatDate(submissions.data[0].created_at)}.`
          : ''}
      </p>
    </div>
  )
}
