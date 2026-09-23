import { useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { assignmentsApi, coursesApi, getApiErrorMessage, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import type { Course } from '@/types'

type CourseOutlet = { course: Course; reloadCourse: () => void }

export function CourseDashboardPage() {
  const { courseId = '' } = useParams()
  const { course, reloadCourse } = useOutletContext<CourseOutlet>()
  const assignments = useAsync(() => assignmentsApi.list({ course: courseId }), [courseId])
  const enrollments = useAsync(() => coursesApi.enrollments(courseId), [courseId])
  const submissions = useAsync(() => submissionsApi.list({ course: courseId }), [courseId])

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

  const publishedCount = useMemo(
    () => (assignments.data || []).filter((a) => a.status === 'published').length,
    [assignments.data],
  )

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

  const loading = assignments.loading || enrollments.loading || submissions.loading
  const error = assignments.error || enrollments.error || submissions.error
  const recent = (submissions.data || []).slice(0, 8)

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

        <section
          aria-label="Course workspace"
          className="min-h-[280px] rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/30"
        />

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
                    <li key={s.id} className="space-y-1 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
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
