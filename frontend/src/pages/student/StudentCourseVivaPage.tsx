import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  assignmentsApi,
  getApiErrorMessage,
  slotsApi,
  vivaApi,
  type SlotBooking,
} from '@/lib/api'
import { formatVivaErrorMessage } from '@/lib/userErrors'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PreparingVivaOverlay } from '@/components/viva/PreparingVivaOverlay'
import { StudentAssessmentCard } from '@/components/student/StudentAssessmentCard'
import { Alert } from '@/components/ui/Alert'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'

function slotTimeLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StudentCourseVivaPage() {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const assignments = useAsync(() => assignmentsApi.list({ course: courseId }), [courseId])
  const bookings = useAsync(() => slotsApi.my(), [courseId])
  const sessions = useAsync(() => vivaApi.list(), [courseId])
  const [startingViva, setStartingViva] = useState(false)
  const [vivaError, setVivaError] = useState<string | null>(null)

  const assignmentIds = useMemo(
    () => new Set((assignments.data || []).filter((a) => a.status === 'published').map((a) => a.id)),
    [assignments.data],
  )

  const titleById = useMemo(() => {
    const map = new Map<string, { title: string; dueAt: string | null }>()
    for (const a of assignments.data || []) {
      map.set(a.id, { title: a.title, dueAt: a.due_at })
    }
    return map
  }, [assignments.data])

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

  const cards = useMemo(() => {
    const courseBookings = (bookings.data || []).filter(
      (b) =>
        assignmentIds.has(b.assignment) &&
        (b.status === 'booked' || b.status === 'started'),
    )

    return courseBookings.map((booking) => {
      const meta = titleById.get(booking.assignment)
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

      const session = (sessions.data || []).find((s) => s.assignment === booking.assignment)
      const done = session && ['COMPLETED', 'REVIEW_REQUIRED'].includes(session.state)

      if (done && session) {
        return {
          key: booking.id,
          title: meta?.title || 'Assignment',
          dueAt: meta?.dueAt,
          statusLabel: 'Viva completed',
          statusKind: 'viva' as const,
          statusValue: session.state,
          primaryLabel: 'View results',
          primaryTo: `/student/courses/${courseId}/assignments/${booking.assignment}`,
        }
      }

      if (expired) {
        return {
          key: booking.id,
          title: meta?.title || 'Assignment',
          dueAt: meta?.dueAt,
          statusLabel: 'Slot expired — book another time',
          statusKind: 'booking' as const,
          statusValue: 'no_show',
          primaryLabel: 'Book viva slot',
          primaryTo: `/student/assignments/${booking.assignment}/book-slot`,
        }
      }

      if (canJoin && joinableSession && booking.viva_session_id) {
        return {
          key: booking.id,
          title: meta?.title || 'Assignment',
          dueAt: meta?.dueAt,
          statusLabel: `Slot open · ${slotTimeLabel(booking.slot_start)}`,
          statusKind: 'booking' as const,
          statusValue: booking.status,
          primaryLabel: 'Join viva',
          primaryTo: `/student/viva/${booking.viva_session_id}`,
        }
      }

      if (canJoin) {
        return {
          key: booking.id,
          title: meta?.title || 'Assignment',
          dueAt: meta?.dueAt,
          statusLabel: `Slot open · ${slotTimeLabel(booking.slot_start)}`,
          statusKind: 'booking' as const,
          statusValue: booking.status,
          primaryLabel: 'Start viva',
          onPrimary: () => void startVivaFromBooking(booking),
          primaryLoading: startingViva,
        }
      }

      return {
        key: booking.id,
        title: meta?.title || 'Assignment',
        dueAt: meta?.dueAt,
        statusLabel: `Booked for ${slotTimeLabel(booking.slot_start)}`,
        statusKind: 'booking' as const,
        statusValue: booking.status,
        primaryLabel: 'View booking',
        primaryTo: `/student/assignments/${booking.assignment}/book-slot`,
      }
    })
  }, [bookings.data, assignmentIds, titleById, sessions.data, courseId, startingViva])

  const loading = assignments.loading || bookings.loading
  const error = assignments.error || bookings.error

  return (
    <div className="space-y-4">
      {startingViva ? <PreparingVivaOverlay /> : null}
      <p className="text-sm text-[var(--color-muted)]">
        After you book a slot, start or join your viva from here when the window opens.
      </p>

      {vivaError ? (
        <Alert tone="danger" title="Could not start viva">
          {vivaError}
        </Alert>
      ) : null}

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void assignments.reload()
            void bookings.reload()
          }}
        />
      ) : null}

      {!loading && !error && cards.length === 0 ? (
        <EmptyState
          title="No viva bookings yet"
          description="Submit an assignment, then book a viva slot. Active bookings for this class show up here."
          action={
            <Link to={`/student/courses/${courseId}`}>
              <Button variant="secondary">View assignments</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-3">
        {cards.map((card) => (
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
          />
        ))}
      </div>

      {(sessions.data || []).some(
        (s) => assignmentIds.has(s.assignment) && s.state === 'IN_PROGRESS',
      ) ? (
        <Card>
          <CardBody className="text-sm text-[var(--color-muted)]">
            You have a viva in progress. Use Join viva above if your slot is still open.
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
