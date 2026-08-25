import { Link, useParams } from 'react-router-dom'
import { assignmentsApi, submissionsApi, slotsApi, type SlotBooking } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

function slotStatusTone(status: string): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  const s = status.toLowerCase()
  if (s === 'started') return 'success'
  if (s === 'booked') return 'info'
  if (s === 'completed') return 'default'
  if (s === 'cancelled') return 'default'
  if (s === 'no_show') return 'danger'
  return 'default'
}

function groupBookingsBySlot(bookings: SlotBooking[]) {
  const map = new Map<string, SlotBooking[]>()
  for (const booking of bookings) {
    const key = booking.slot_start
    const list = map.get(key) ?? []
    list.push(booking)
    map.set(key, list)
  }
  return Array.from(map.entries())
}

export function AssignmentDetailPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const submissions = useAsync(() => submissionsApi.list({ assignment: id }), [id])
  const bookings = useAsync(() => slotsApi.forAssignment(id), [id])

  if (loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title={data.title}
        description={`Due ${formatDate(data.due_at)} · ${data.status}`}
        actions={
          <>
            <Link to={`/assignments/${id}/rubric`}>
              <Button variant="secondary">Rubric</Button>
            </Link>
            <Link to={`/assignments/${id}/settings`}>
              <Button variant="secondary">Settings</Button>
            </Link>
            <Link to={`/submissions?assignment=${id}`}>
              <Button variant="secondary">All submissions</Button>
            </Link>
          </>
        }
      />
      <Card className="mb-6">
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>{data.description || 'No description.'}</p>
          <p className="whitespace-pre-wrap">{data.instructions || 'No instructions.'}</p>
          <p className="text-xs text-slate-500">
            Allowed:{' '}
            {[
              data.allow_pdf && 'PDF',
              data.allow_docx && 'DOCX',
              data.allow_pptx && 'PPTX',
              data.allow_zip && 'ZIP',
              data.allow_github && 'GitHub',
            ]
              .filter(Boolean)
              .join(', ') || 'None'}
          </p>
        </CardBody>
      </Card>
      <Card className="mb-6">
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Booked viva slots</h2>
            {bookings.data ? (
              <p className="text-xs text-slate-500">
                {bookings.data.filter((b) => b.status === 'booked' || b.status === 'started').length} active
              </p>
            ) : null}
          </div>
          {bookings.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
          {bookings.error ? <p className="text-sm text-red-600">{bookings.error}</p> : null}
          {!bookings.loading && !bookings.error && (bookings.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-600">No students have booked a slot for this assignment yet.</p>
          ) : (
            <div className="space-y-4">
              {groupBookingsBySlot(bookings.data || []).map(([slotStart, slotBookings]) => (
                <div key={slotStart}>
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    {formatDate(slotStart)} — {formatDate(slotBookings[0].slot_end)}
                  </p>
                  <ul className="space-y-2">
                    {slotBookings.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{b.student_name || b.student_email || 'Student'}</p>
                          {b.student_email && b.student_name ? (
                            <p className="text-xs text-slate-500">{b.student_email}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={slotStatusTone(b.status)}>{b.status.replace('_', ' ')}</Badge>
                          {b.viva_session_id ? (
                            <Link to={`/viva-sessions/${b.viva_session_id}`} className="text-xs text-blue-700 hover:underline">
                              Session
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent submissions</h2>
          {submissions.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.submissions} /> : null}
          {!submissions.loading && (submissions.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-600">No submissions yet.</p>
          ) : (
            <ul className="space-y-3">
              {(submissions.data || []).slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link to={`/submissions/${s.id}`} className="font-medium text-blue-700 hover:underline">
                    {s.student_name || s.student_email || 'Student'}
                  </Link>
                  <Badge tone={s.status === 'ready' ? 'success' : 'default'}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
