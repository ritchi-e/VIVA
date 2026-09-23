import { useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { Check, Copy, RefreshCw } from 'lucide-react'
import {
  assignmentsApi,
  coursesApi,
  dashboardApi,
  getApiErrorMessage,
  slotsApi,
  submissionsApi,
} from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { formatDate, formatScore } from '@/lib/utils'
import type { Assignment, Course, Submission } from '@/types'

type CourseOutlet = { course: Course; reloadCourse: () => void }

function ProgressStat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--color-foreground)]">
          {value}
          <span className="font-normal text-[var(--color-muted)]"> / {total}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function uniqueStudentsByAssignment(submissions: Submission[] | undefined) {
  const map = new Map<string, Set<string>>()
  for (const s of submissions || []) {
    const set = map.get(s.assignment) ?? new Set<string>()
    set.add(s.student)
    map.set(s.assignment, set)
  }
  return map
}

export function CourseDashboardPage() {
  const { courseId = '' } = useParams()
  const { course, reloadCourse } = useOutletContext<CourseOutlet>()
  const assignments = useAsync(() => assignmentsApi.list({ course: courseId }), [courseId])
  const enrollments = useAsync(() => coursesApi.enrollments(courseId), [courseId])
  const submissions = useAsync(() => submissionsApi.list({ course: courseId }), [courseId])
  const metrics = useAsync(
    () => dashboardApi.metrics({ course: courseId }).then((r) => r.data),
    [courseId],
  )

  const published = useMemo(
    () => (assignments.data || []).filter((a) => a.status === 'published'),
    [assignments.data],
  )

  const bookings = useAsync(async () => {
    if (published.length === 0) return {} as Record<string, number>
    const entries = await Promise.all(
      published.map(async (a) => {
        const list = await slotsApi.forAssignment(a.id)
        const active = list.filter((b) => b.status === 'booked' || b.status === 'started').length
        return [a.id, active] as const
      }),
    )
    return Object.fromEntries(entries)
  }, [published.map((a) => a.id).join(',')])

  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [busy, setBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const joinLink = useMemo(
    () => (course.join_code ? `${window.location.origin}/join/${course.join_code}` : ''),
    [course.join_code],
  )

  const studentCount = useMemo(
    () => (enrollments.data || []).filter((e) => e.role === 'student').length,
    [enrollments.data],
  )

  const publishedCount = useMemo(() => published.length, [published])

  const submittedByAssignment = useMemo(
    () => uniqueStudentsByAssignment(submissions.data ?? undefined),
    [submissions.data],
  )

  const uniqueSubmitters = useMemo(() => {
    const students = new Set<string>()
    for (const s of submissions.data || []) students.add(s.student)
    return students.size
  }, [submissions.data])

  const submissionRatePct =
    studentCount > 0 ? Math.min(100, Math.round((uniqueSubmitters / studentCount) * 100)) : 0

  const vivaDone = metrics.data?.viva_completion?.completed ?? 0
  const vivaInProgress = metrics.data?.viva_completion?.in_progress ?? 0
  const pendingReview = metrics.data?.pending_reviews_count ?? 0
  const avgScore = metrics.data?.average_assessment

  const vivaByAssignment = useMemo(() => {
    const map = new Map<string, { completed: number; total: number; failed: number }>()
    for (const row of metrics.data?.by_assignment || []) {
      map.set(row.assignment_id, {
        completed: row.completed,
        total: row.total,
        failed: row.failed,
      })
    }
    return map
  }, [metrics.data?.by_assignment])

  const copyText = async (kind: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setShareError('Could not copy. Select the text manually.')
    }
  }

  const regenerate = async () => {
    setBusy(true)
    setShareError(null)
    try {
      await coursesApi.regenerateJoinCode(courseId)
      reloadCourse()
    } catch (err) {
      setShareError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const loading =
    assignments.loading || enrollments.loading || submissions.loading || metrics.loading
  const error = assignments.error || enrollments.error || submissions.error || metrics.error
  const recent = (submissions.data || []).slice(0, 8)

  const assignmentRows = published.slice().sort((a, b) => {
    const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
    const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
    return da - db
  })

  return (
    <div className="space-y-4">
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.courses} /> : null}
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void assignments.reload()
            void enrollments.reload()
            void submissions.reload()
            void metrics.reload()
            void bookings.reload()
          }}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Students</p>
            <p className="mk-kpi mt-1">{studentCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Published assignments</p>
            <p className="mk-kpi mt-1">{publishedCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Submissions</p>
            <p className="mk-kpi mt-1">{submissions.data?.length ?? 0}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(240px,300px)]">
        <aside className="space-y-3">
          <Card>
            <CardBody className="space-y-3 !py-4">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
                  Invite students
                </h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  Share the class code or link.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Class code
                </p>
                <p className="mt-1 break-all font-mono text-xl font-bold tracking-[0.14em]">
                  {course.join_code}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full !px-3 !py-1.5 text-sm"
                  onClick={() => copyText('code', course.join_code)}
                >
                  {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'code' ? 'Copied' : 'Copy code'}
                </Button>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Invite link
                </p>
                <p className="mt-1 break-all text-xs font-medium leading-relaxed">{joinLink}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full !px-3 !py-1.5 text-sm"
                    onClick={() => copyText('link', joinLink)}
                  >
                    {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'link' ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full !px-3 !py-1.5 text-sm"
                    loading={busy}
                    onClick={regenerate}
                  >
                    <RefreshCw className="h-4 w-4" />
                    New code
                  </Button>
                </div>
              </div>

              {shareError ? <Alert tone="danger">{shareError}</Alert> : null}
            </CardBody>
          </Card>
        </aside>

        <section aria-label="Course performance" className="min-w-0 space-y-3">
          <Card>
            <CardBody className="space-y-4 !py-4">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
                  Course pulse
                </h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  How this class is progressing across assignments and vivas.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Avg score
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--color-primary)]">
                    {avgScore != null ? formatScore(avgScore) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Needs review
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">{pendingReview}</p>
                  {pendingReview > 0 ? (
                    <Link to={`/courses/${courseId}/reviews`} className="mk-link mt-1 inline-block text-xs">
                      Open reviews
                    </Link>
                  ) : null}
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Vivas
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-foreground)]">
                    <span className="font-display text-2xl font-bold tabular-nums">{vivaDone}</span>
                    <span className="text-[var(--color-muted)]"> done</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {vivaInProgress} in progress
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Submission rate
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                    {studentCount > 0 ? `${submissionRatePct}%` : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {uniqueSubmitters} of {studentCount} students
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 !py-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
                    Assignment progress
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                    Submitted and viva bookings vs enrolled students.
                  </p>
                </div>
                <Link to={`/courses/${courseId}/assignments`} className="mk-link shrink-0 text-sm">
                  All
                </Link>
              </div>

              {assignmentRows.length === 0 ? (
                <EmptyState
                  title="No published assignments"
                  description="Publish an assignment to track submissions and viva progress here."
                  action={
                    <Link to={`/assignments/new?course=${courseId}`}>
                      <Button>Create assignment</Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {assignmentRows.map((a: Assignment) => {
                    const submitted = submittedByAssignment.get(a.id)?.size ?? 0
                    const booked = bookings.data?.[a.id] ?? 0
                    const viva = vivaByAssignment.get(a.id)
                    return (
                      <li
                        key={a.id}
                        className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to={`/assignments/${a.id}`}
                              className="text-sm font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                            >
                              {a.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                              Due {formatDate(a.due_at)}
                              {viva ? ` · ${viva.completed}/${viva.total} vivas done` : ''}
                            </p>
                          </div>
                          <Link
                            to={`/courses/${courseId}/reviews`}
                            className="mk-link shrink-0 text-xs"
                          >
                            Reviews
                          </Link>
                        </div>
                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                          <ProgressStat label="Submitted" value={submitted} total={studentCount} />
                          <ProgressStat
                            label="Viva booked"
                            value={bookings.loading ? 0 : booked}
                            total={studentCount}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </section>

        <aside className="space-y-3">
          <Card>
            <CardBody className="!py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold">Recent submissions</h2>
                <Link to={`/courses/${courseId}/reviews`} className="mk-link text-sm">
                  All
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No submissions yet for this course.</p>
              ) : (
                <ul className="space-y-3">
                  {recent.map((s) => (
                    <li
                      key={s.id}
                      className="space-y-1 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
                    >
                      <Link
                        to={`/submissions/${s.id}`}
                        className="block text-sm font-semibold hover:text-[var(--color-primary)]"
                      >
                        {s.student_name || s.student_email || 'Student'}
                      </Link>
                      <p className="truncate text-xs text-[var(--color-muted)]">{s.assignment_title}</p>
                      <StatusBadge kind="submission" value={s.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  )
}
