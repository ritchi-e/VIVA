import { Link, useParams } from 'react-router-dom'
import { assignmentsApi, slotsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'

function slotDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function slotTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function AssignmentBookedSlotsPage() {
  const { id = '' } = useParams()
  const assignment = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const bookings = useAsync(() => slotsApi.forAssignment(id), [id])

  if (assignment.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  if (assignment.error || !assignment.data) {
    return <ErrorState message={assignment.error ?? 'Not found'} onRetry={assignment.reload} />
  }

  const rows = bookings.data ?? []

  return (
    <div>
      <PageHeader
        title="Booked slots"
        description={assignment.data.title}
        actions={
          <Link to={`/assignments/${id}`}>
            <Button variant="secondary">Back to assignment</Button>
          </Link>
        }
      />
      <Card>
        <CardBody className="p-0">
          {bookings.loading ? (
            <div className="p-6">
              <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
            </div>
          ) : null}
          {bookings.error ? <p className="p-6 text-base text-red-600">{bookings.error}</p> : null}
          {!bookings.loading && !bookings.error && rows.length === 0 ? (
            <p className="p-6 text-base text-slate-600">No students have booked a slot yet.</p>
          ) : null}
          {!bookings.loading && !bookings.error && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-base font-semibold text-slate-700">Student</th>
                    <th className="px-6 py-4 text-base font-semibold text-slate-700">Date</th>
                    <th className="px-6 py-4 text-base font-semibold text-slate-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4 text-base font-medium text-slate-900">
                        {b.student_name || b.student_email || 'Student'}
                      </td>
                      <td className="px-6 py-4 text-base text-slate-800">{slotDate(b.slot_start)}</td>
                      <td className="px-6 py-4 text-base text-slate-800">
                        {slotTime(b.slot_start)} – {slotTime(b.slot_end)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
