import { Link } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { Alert } from '@/components/ui/Alert'
import { cn, formatDate } from '@/lib/utils'
import type { UpcomingAssignmentProgress } from '@/types'

function dueLabel(dueAt: string | null) {
  if (!dueAt) return 'No due date'
  const due = new Date(dueAt)
  const now = Date.now()
  const diffMs = due.getTime() - now
  const dayMs = 24 * 60 * 60 * 1000
  if (diffMs < 0) {
    const days = Math.ceil(Math.abs(diffMs) / dayMs)
    return days <= 1 ? 'Due yesterday' : `Overdue by ${days} days`
  }
  const days = Math.ceil(diffMs / dayMs)
  if (days <= 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

function dueTone(dueAt: string | null) {
  if (!dueAt) return 'text-[var(--color-muted)]'
  const diffMs = new Date(dueAt).getTime() - Date.now()
  if (diffMs < 0) return 'text-[var(--color-danger)]'
  if (diffMs < 2 * 24 * 60 * 60 * 1000) return 'text-amber-700'
  return 'text-[var(--color-muted)]'
}

function ProgressStat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--color-foreground)]">
          {value}
          <span className="font-normal text-[var(--color-muted)]"> / {total}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function AssignmentProgressCard({ item }: { item: UpcomingAssignmentProgress }) {
  const assigned = item.students_assigned
  return (
    <Card hover>
      <CardBody className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/assignments/${item.id}`}
              className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
            >
              {item.title}
            </Link>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">
              <Link to={`/courses/${item.course_id}`} className="hover:text-[var(--color-primary)]">
                {item.course_code} — {item.course_title}
              </Link>
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-sm font-semibold', dueTone(item.due_at))}>{dueLabel(item.due_at)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{formatDate(item.due_at)}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ProgressStat label="Submitted" value={item.submissions_count} total={assigned} />
          <ProgressStat label="Viva booked" value={item.booked_slots_count} total={assigned} />
          <div>
            <p className="text-sm text-[var(--color-muted)]">Assigned students</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-foreground)]">{assigned}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() =>
    dashboardApi.metrics().then((r) => r.data),
  )

  const pending = data?.pending_reviews_count ?? 0
  const inProgress = data?.viva_completion?.in_progress ?? 0
  const completed = data?.viva_completion?.completed ?? 0
  const upcoming = data?.upcoming_assignments ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Home"
        description="Organization overview. Open a class from the sidebar for course work."
        actions={
          <Link to="/courses/new">
            <Button variant="secondary">Create course</Button>
          </Link>
        }
      />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          {pending > 0 ? (
            <Alert
              tone="warning"
              title={`${pending} assessment${pending === 1 ? '' : 's'} need review`}
            >
              Open a class from the sidebar, then use the Reviews tab to finalize assessments.
            </Alert>
          ) : (
            <Alert tone="success" title="No assessments waiting">
              When students finish vivas, items needing your decision appear in each class’s Reviews tab.
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-[var(--color-muted)]">Needs review</p>
                <p className="mk-kpi mt-2">{pending}</p>
              </CardBody>
            </Card>
            <Link to="/viva-sessions">
              <Card hover>
                <CardBody>
                  <p className="text-sm font-medium text-[var(--color-muted)]">Vivas in progress</p>
                  <p className="mk-kpi mt-2">{inProgress}</p>
                </CardBody>
              </Card>
            </Link>
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-[var(--color-muted)]">Vivas completed</p>
                <p className="mk-kpi mt-2">{completed}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-[var(--color-muted)]">Students</p>
                <p className="mk-kpi mt-2">{data.students_count ?? 0}</p>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Assignments due soon</h2>
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing due in the next three weeks"
                description="Published assignments with upcoming due dates will show submission and booking progress here."
              />
            ) : (
              <div className="space-y-2">
                {upcoming.map((item) => (
                  <AssignmentProgressCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
