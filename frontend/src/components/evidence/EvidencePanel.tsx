import { useMemo, useState } from 'react'
import { evidenceApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { ErrorState } from '@/components/layout/StateViews'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { QuestionDrillDown } from '@/components/evidence/QuestionDrillDown'
import { cn, formatScore } from '@/lib/utils'
import type { EvidenceQuestionDetail } from '@/types'
import { getApiErrorMessage } from '@/lib/api'

export function EvidencePanel({ submissionId }: { submissionId: string }) {
  const dashboard = useAsync(() => evidenceApi.dashboard(submissionId).then((r) => r.data), [submissionId])
  const coverage = useAsync(() => evidenceApi.coverage(submissionId).then((r) => r.data.coverage), [submissionId])
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EvidenceQuestionDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [flagNote, setFlagNote] = useState('')

  const questions = dashboard.data?.questions ?? []
  const openFlags = dashboard.data?.flags.open ?? 0

  const strengthTone = useMemo(() => {
    const strength = dashboard.data?.evidence_strength
    if (strength === 'strong') return 'success' as const
    if (strength === 'weak') return 'danger' as const
    if (strength === 'moderate') return 'warning' as const
    return 'default' as const
  }, [dashboard.data?.evidence_strength])

  const openQuestion = async (questionId: string) => {
    setSelectedQuestionId(questionId)
    setLoadingDetail(true)
    setDetailError(null)
    try {
      const { data } = await evidenceApi.questionDetail(questionId)
      setDetail(data)
    } catch (err) {
      setDetail(null)
      setDetailError(getApiErrorMessage(err))
    } finally {
      setLoadingDetail(false)
    }
  }

  const createFlag = async () => {
    if (!dashboard.data?.viva_session || !selectedQuestionId || !flagNote.trim()) return
    setLoadingDetail(true)
    setDetailError(null)
    try {
      await evidenceApi.createFlag({
        viva_session: dashboard.data.viva_session.id,
        viva_question: selectedQuestionId,
        flag_type: 'requires_review',
        description: flagNote.trim(),
      })
      setFlagNote('')
      await openQuestion(selectedQuestionId)
      await dashboard.reload()
    } catch (err) {
      setDetailError(getApiErrorMessage(err))
    } finally {
      setLoadingDetail(false)
    }
  }

  if (dashboard.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assessment} />
  if (dashboard.error || !dashboard.data) {
    return <ErrorState message={dashboard.error ?? 'Evidence unavailable'} onRetry={dashboard.reload} />
  }

  const data = dashboard.data

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-[var(--color-muted)]">Strength</p>
            <div className="mt-1">
              <Badge tone={strengthTone}>{data.evidence_strength.replace(/_/g, ' ')}</Badge>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-[var(--color-muted)]">Open flags</p>
            <p className="mt-1 text-xl font-semibold">{openFlags}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-[var(--color-muted)]">Review</p>
            <p className="mt-1 text-sm font-medium">{data.instructor_review_status.replace(/_/g, ' ')}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-[var(--color-muted)]">Topics</p>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">
              {data.topics_assessed.length ? data.topics_assessed.join(', ') : '—'}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardBody className="space-y-2 py-4">
            <p className="text-sm font-semibold">Questions</p>
            {questions.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No viva questions recorded.</p>
            ) : (
              <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {questions.map((q) => (
                  <button
                    key={q.question_id}
                    type="button"
                    onClick={() => openQuestion(q.question_id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition',
                      selectedQuestionId === q.question_id
                        ? 'border-[var(--color-primary)] bg-[var(--color-sidebar-active)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>Q{q.sequence}</Badge>
                      {q.evaluation_overall != null ? (
                        <span className="text-sm font-semibold">{formatScore(q.evaluation_overall)}</span>
                      ) : null}
                      {q.flag_count > 0 ? <Badge tone="warning">{q.flag_count}</Badge> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{q.question_text}</p>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-3">
          {loadingDetail ? <ProgressPanel copy={PLATFORM_PROGRESS.assessment} /> : null}
          {detailError ? <p className="text-sm text-[var(--color-danger)]">{detailError}</p> : null}
          {detail ? (
            <>
              <QuestionDrillDown detail={detail} />
              <Card>
                <CardBody className="space-y-2 py-4">
                  <p className="text-sm font-semibold">Flag for review</p>
                  <textarea
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] p-2 text-sm"
                    rows={2}
                    value={flagNote}
                    onChange={(e) => setFlagNote(e.target.value)}
                    placeholder="Why this answer needs review"
                  />
                  <Button loading={loadingDetail} onClick={createFlag} disabled={!flagNote.trim()}>
                    Create flag
                  </Button>
                </CardBody>
              </Card>
            </>
          ) : !loadingDetail ? (
            <Card>
              <CardBody className="text-sm text-[var(--color-muted)]">
                Select a question to inspect provenance and evidence.
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardBody className="py-4">
          <p className="mb-3 text-sm font-semibold">Coverage</p>
          {coverage.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assessment} /> : null}
          {coverage.error ? <p className="text-sm text-[var(--color-danger)]">{coverage.error}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(coverage.data ?? []).map((row) => (
              <div
                key={`${row.dimension}-${row.category}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
              >
                <p className="truncate text-sm font-medium">{row.dimension}</p>
                <Badge
                  tone={
                    row.coverage === 'strong'
                      ? 'success'
                      : row.coverage === 'moderate'
                        ? 'warning'
                        : row.coverage === 'weak'
                          ? 'danger'
                          : 'default'
                  }
                >
                  {row.coverage.replace(/_/g, ' ')}
                </Badge>
              </div>
            ))}
          </div>
          {!coverage.loading && !(coverage.data?.length) ? (
            <p className="text-sm text-[var(--color-muted)]">No coverage dimensions yet.</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
