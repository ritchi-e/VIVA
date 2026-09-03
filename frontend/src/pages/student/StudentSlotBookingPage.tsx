import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { slotsApi, getApiErrorMessage } from '@/lib/api'
import type { SlotWindow, SlotBooking } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function groupByDate(slots: SlotWindow[]): Map<string, SlotWindow[]> {
  const map = new Map<string, SlotWindow[]>()
  for (const slot of slots) {
    const dateKey = new Date(slot.slot_start).toDateString()
    const list = map.get(dateKey) ?? []
    list.push(slot)
    map.set(dateKey, list)
  }
  return map
}

export function StudentSlotBookingPage() {
  const { id: assignmentId = '' } = useParams()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<SlotWindow[]>([])
  const [myBookings, setMyBookings] = useState<SlotBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [slotsData, bookingsData] = await Promise.all([slotsApi.available(), slotsApi.my()])
      setSlots(slotsData)
      setMyBookings(bookingsData)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activeBooking = myBookings.find(
    (b) => b.assignment === assignmentId && (b.status === 'booked' || b.status === 'started'),
  )

  const handleBook = async (slotStart: string) => {
    setError(null)
    setSuccess(null)
    setBooking(true)
    try {
      await slotsApi.book(assignmentId, slotStart)
      setSuccess('Slot booked successfully!')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBooking(false)
    }
  }

  const handleCancel = async (bookingId: string) => {
    setError(null)
    setSuccess(null)
    try {
      await slotsApi.cancel(bookingId)
      setSuccess('Booking cancelled.')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  if (loading) return <ProgressPanel copy={{ title: 'Loading slots', detail: 'Finding available times...' }} />

  const grouped = groupByDate(slots)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader title="Book Viva Slot" description="Choose an available time slot for your viva examination" />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {activeBooking && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Your booked slot</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatDate(activeBooking.slot_start)} at {formatTime(activeBooking.slot_start)} &ndash;{' '}
                  {formatTime(activeBooking.slot_end)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Status: <span className="font-medium capitalize">{activeBooking.status}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {activeBooking.status === 'booked' && (
                  <Button variant="danger" onClick={() => handleCancel(activeBooking.id)}>
                    Cancel
                  </Button>
                )}
                {(() => {
                  const now = new Date()
                  const startsAt = new Date(activeBooking.slot_start)
                  const endsAt = new Date(activeBooking.slot_end)
                  const canJoin = now >= startsAt && now <= endsAt
                  if (!canJoin) return null
                  if (activeBooking.viva_session_id) {
                    return (
                      <Button onClick={() => navigate(`/student/viva/${activeBooking.viva_session_id}`)}>
                        Join viva
                      </Button>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-slate-200 bg-white" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-slate-100 bg-slate-100" /> Filled
        </span>
        {activeBooking && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-teal-500 bg-teal-50" /> Your slot
          </span>
        )}
      </div>

      {Array.from(grouped.entries()).map(([dateKey, daySlots]) => (
        <div key={dateKey}>
          <h3 className="mb-3 text-sm font-semibold text-slate-600">{formatDate(daySlots[0].slot_start)}</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {daySlots.map((slot) => {
              const full = slot.available <= 0
              const isBooked = activeBooking?.slot_start === slot.slot_start
              return (
                <button
                  key={slot.slot_start}
                  disabled={full || !!activeBooking || booking}
                  onClick={() => handleBook(slot.slot_start)}
                  className={`rounded-xl border px-3 py-3 text-center text-sm transition ${
                    isBooked
                      ? 'border-teal-500 bg-teal-50 font-semibold text-teal-700'
                      : full
                        ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400'
                        : activeBooking
                          ? 'cursor-not-allowed border-slate-200 bg-white text-slate-500'
                          : 'cursor-pointer border-slate-200 bg-white text-slate-800 hover:border-teal-400 hover:bg-teal-50'
                  }`}
                >
                  <div className="font-medium">{formatTime(slot.slot_start)}</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {slots.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-center text-sm text-slate-500">No slots available at the moment.</p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
