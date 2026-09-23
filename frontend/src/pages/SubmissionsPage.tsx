import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { assessmentsApi, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

type ReviewFilter = 'all' | 'pending' | 'ready' | 'flagged' | 'mismatch'

export function SubmissionsPage() {
  const [params, setParams] = useSearchParams()
  const assignmentId = params.get('assignment') || undefined
  const reviewParam = (params.get('review') as ReviewFilter | null) || 'all'
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ReviewFilter>(
    ['all', 'pending', 'ready', 'flagged', 'mismatch'].includes(reviewParam) ? reviewParam : 'all',
  )

  const { data, loading, error, reload } = useAsync(
    () => submissionsApi.list(assignmentId ? { assignment: assignmentId } : undefined),
    [assignmentId],
  )
  const assessments = useAsync(() => assessmentsApi.list(), [])

  const assessmentBySubmission = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assessments.data || []) {
      if (a.submission) map.set(a.submission, a.status)
    }
    return map
  }, [assessments.data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data || []).filter((s) => {
      const student = (s.student_name || s.student_email || '').toLowerCase()
      const title = (s.assignment_title || '').toLowerCase()
      if (q && !student.includes(q) && !title.includes(q)) return false
      const reviewStatus = assessmentBySubmission.get(s.id)
      if (filter === 'pending') {
        return reviewStatus === 'pending_review' || reviewStatus === 'draft' || reviewStatus === 'modified'
      }
      if (filter === 'ready') return s.status === 'ready'
      if (filter === 'flagged') return Boolean(s.plagiarism_flagged)
      if (filter === 'mismatch') return Boolean(s.assignment_mismatch)
      return true
    })
  }, [data, query, filter, assessmentBySubmission])

  const setReviewFilter = (next: ReviewFilter) => {
    setFilter(next)
    const p = new URLSearchParams(params)
    if (next === 'all') p.delete('review')
    else p.set('review', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Review"
        description="One row per student (latest submission). Filter to who needs a decision."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All'],
              ['pending', 'Needs review'],
              ['ready', 'Ready for viva'],
              ['flagged', 'Similarity'],
              ['mismatch', 'Unrelated'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setReviewFilter(id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                filter === id
                  ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                  : 'bg-white text-[var(--color-muted)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="w-full max-w-sm">
          <Input
            id="review-search"
            label="Search"
            placeholder="Student or assignment"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {assignmentId ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-muted)]">Filtered to one assignment.</span>
          <Button
            variant="ghost"
            className="px-2 py-1 text-sm"
            onClick={() => {
              const p = new URLSearchParams(params)
              p.delete('assignment')
              setParams(p)
            }}
          >
            Clear assignment filter
          </Button>
        </div>
      ) : null}

      {loading || assessments.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.submissions} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          title="No matching submissions"
          description={
            filter === 'pending'
              ? 'Nothing needs review right now.'
              : 'Submissions appear when students upload work.'
          }
          action={
            <Link to="/assignments">
              <Button variant="secondary">View assignments</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-2">
        {filtered.map((s) => {
          const student = s.student_name || s.student_email || 'Student'
          const reviewStatus = assessmentBySubmission.get(s.id)
          return (
            <Card key={s.id} hover>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <Link
                    to={`/submissions/${s.id}`}
                    className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                  >
                    {student}
                  </Link>
                  <p className="mt-1 truncate text-sm text-[var(--color-muted)]">
                    {s.assignment_title || 'Assignment'}
                    {s.version > 1 ? ` · v${s.version}` : ''}
                    {' · '}
                    {formatDate(s.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {reviewStatus ? <StatusBadge kind="assessment" value={reviewStatus} /> : null}
                  <StatusBadge kind="submission" value={s.status} />
                  {s.plagiarism_flagged ? <Badge tone="warning">Similarity</Badge> : null}
                  {s.assignment_mismatch ? <Badge tone="warning">Unrelated</Badge> : null}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
