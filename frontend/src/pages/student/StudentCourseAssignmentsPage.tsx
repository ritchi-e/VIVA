import { Link, useParams } from 'react-router-dom'
import { assignmentsApi, submissionsApi, vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'
import { useMemo } from 'react'

export function StudentCourseAssignmentsPage() {
  const { courseId = '' } = useParams()
  const assignments = useAsync(() => assignmentsApi.list({ course: courseId }), [courseId])
  const submissions = useAsync(() => submissionsApi.list(), [courseId])
  const sessions = useAsync(() => vivaApi.list(), [courseId])

  const published = useMemo(
    () => (assignments.data || []).filter((a) => a.status === 'published'),
    [assignments.data],
  )

  const statusByAssignment = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of submissions.data || []) {
      if (!published.some((a) => a.id === s.assignment)) continue
      const prev = map.get(s.assignment)
      if (!prev) map.set(s.assignment, s.status)
    }
    for (const session of sessions.data || []) {
      if (!published.some((a) => a.id === session.assignment)) continue
      if (['COMPLETED', 'REVIEW_REQUIRED'].includes(session.state)) {
        map.set(session.assignment, 'results_ready')
      } else if (session.state === 'IN_PROGRESS') {
        map.set(session.assignment, 'viva_in_progress')
      }
    }
    return map
  }, [published, submissions.data, sessions.data])

  const loading = assignments.loading || submissions.loading
  const error = assignments.error

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">
        Open an assignment to read instructions, submit work, and see your results after the viva.
      </p>

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {error ? <ErrorState message={error} onRetry={assignments.reload} /> : null}
      {!loading && !error && published.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When your instructor publishes work for this class, it will appear here."
        />
      ) : null}

      <div className="space-y-2">
        {published.map((assignment) => {
          const status = statusByAssignment.get(assignment.id)
          let badge = 'Open'
          let tone: 'default' | 'success' | 'warning' | 'danger' = 'default'
          if (status === 'results_ready') {
            badge = 'Results ready'
            tone = 'success'
          } else if (status === 'viva_in_progress') {
            badge = 'Viva in progress'
            tone = 'warning'
          } else if (status === 'ready') {
            badge = 'Ready to book'
            tone = 'success'
          } else if (status === 'failed') {
            badge = 'Needs fix'
            tone = 'danger'
          } else if (status && ['uploaded', 'queued', 'processing'].includes(status)) {
            badge = 'Processing'
            tone = 'warning'
          } else if (status) {
            badge = 'Submitted'
            tone = 'default'
          }

          return (
            <Card key={assignment.id} hover>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <Link
                    to={`/student/courses/${courseId}/assignments/${assignment.id}`}
                    className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                  >
                    {assignment.title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    Due {formatDate(assignment.due_at)}
                    {(() => {
                      const pts = Number(
                        (assignment.viva_config as { total_points?: number } | undefined)?.total_points,
                      )
                      return Number.isFinite(pts) && pts > 0 ? ` · ${pts} points` : ''
                    })()}
                  </p>
                </div>
                <Badge tone={tone}>{badge}</Badge>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
