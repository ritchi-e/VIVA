import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { assignmentsApi, coursesApi, getApiErrorMessage } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'

export function CourseDetailPage() {
  const { id = '' } = useParams()
  const course = useAsync(() => coursesApi.get(id).then((r) => r.data), [id])
  const assignments = useAsync(() => assignmentsApi.list({ course: id }), [id])
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [busy, setBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const joinLink = useMemo(() => {
    if (!course.data?.join_code) return ''
    return `${window.location.origin}/join/${course.data.join_code}`
  }, [course.data?.join_code])

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
      await coursesApi.regenerateJoinCode(id)
      await course.reload()
    } catch (err) {
      setShareError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (course.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.courses} />
  if (course.error || !course.data) {
    return <ErrorState message={course.error ?? 'Course not found'} onRetry={course.reload} />
  }

  const c = course.data

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${c.code} — ${c.title}`}
        description={c.description || c.term || 'Course details'}
        actions={
          <Link to={`/assignments/new?course=${id}`}>
            <Button>Create assignment</Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="space-y-3 !py-4">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
              Invite students
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">
              Share the code or link — students join like in Google Classroom.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Class code
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.18em] text-[var(--color-foreground)]">
                {c.join_code}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 !px-3 !py-1.5 text-sm"
                onClick={() => copyText('code', c.join_code)}
              >
                {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </Button>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Invite link
              </p>
              <p className="mt-1 break-all text-sm font-medium text-[var(--color-foreground)]">{joinLink}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="!px-3 !py-1.5 text-sm"
                  onClick={() => copyText('link', joinLink)}
                >
                  {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="!px-3 !py-1.5 text-sm"
                  loading={busy}
                  onClick={regenerate}
                >
                  <RefreshCw className="h-4 w-4" />
                  New code
                </Button>
              </div>
            </div>
          </div>

          {shareError ? <Alert tone="danger">{shareError}</Alert> : null}
        </CardBody>
      </Card>

      <h2 className="font-display text-lg font-semibold">Assignments</h2>
      {assignments.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {assignments.error ? <ErrorState message={assignments.error} onRetry={assignments.reload} /> : null}
      {!assignments.loading && (assignments.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Create an assignment for this course, then publish it when ready."
          action={
            <Link to={`/assignments/new?course=${id}`}>
              <Button>Create assignment</Button>
            </Link>
          }
        />
      ) : null}
      <div className="space-y-2">
        {assignments.data?.map((a) => (
          <Card key={a.id} hover>
            <CardBody className="flex items-center justify-between gap-3 py-4">
              <Link to={`/assignments/${a.id}`} className="text-base font-semibold hover:text-[var(--color-primary)]">
                {a.title}
              </Link>
              <StatusBadge kind="assignment" value={a.status} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
