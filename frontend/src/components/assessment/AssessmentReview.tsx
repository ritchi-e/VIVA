import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assessmentsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import type { Assessment } from '@/types'
import { cn, formatDate, formatScore } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api'
import { Alert } from '@/components/ui/Alert'

interface AssessmentReviewProps {
  assessment: Assessment
  onUpdated: (next: Assessment) => void
  compact?: boolean
}

function ChipList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="text-xs font-medium text-[var(--color-muted)]">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-foreground)]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AssessmentReview({ assessment, onUpdated, compact = false }: AssessmentReviewProps) {
  const [notes, setNotes] = useState(assessment.instructor_notes ?? '')
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      assessment.criteria.map((c) => [c.id, c.instructor_score ?? c.ai_score ?? 0]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(
    assessment.question_reviews?.[0]?.question_id ?? null,
  )

  const saveCriterion = async (criterionId: string) => {
    setSaving(true)
    setError(null)
    try {
      await assessmentsApi.updateCriterion(assessment.id, criterionId, {
        instructor_score: scores[criterionId],
      })
      const refreshed = await assessmentsApi.get(assessment.id)
      onUpdated(refreshed.data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const reviewQuestion = async (
    questionId: string,
    action: 'agree' | 'override' | 'insufficient_evidence' | 'note',
  ) => {
    setSaving(true)
    setError(null)
    try {
      const { data } = await assessmentsApi.reviewQuestion(assessment.id, {
        viva_question_id: questionId,
        action,
        reason:
          action === 'agree'
            ? 'Instructor agrees with AI evaluation'
            : action === 'insufficient_evidence'
              ? 'Instructor marked insufficient evidence'
              : 'Instructor review note',
      })
      onUpdated(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const finalize = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data } = await assessmentsApi.finalize(assessment.id, { instructor_notes: notes })
      onUpdated(data)
      setSuccess('Assessment finalized. The student can see the final result.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const finalized = assessment.status === 'finalized'
  const questionReviews = assessment.question_reviews ?? []

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <Card>
        <CardBody className="space-y-3 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">Decision</p>
              <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-muted)]">
                AI suggests a score. You remain the academic authority — accept, adjust, or mark
                insufficient evidence before finalizing.
              </p>
            </div>
            <Badge tone={finalized ? 'success' : 'warning'}>{assessment.status.replace(/_/g, ' ')}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
              <p className="text-xs font-medium text-[var(--color-muted)]">AI assessment</p>
              <p className="mt-1 text-2xl font-semibold">{formatScore(assessment.ai_overall_score)}</p>
              <Badge className="mt-2">Suggested</Badge>
            </div>
            <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-sidebar-active)] px-3 py-3">
              <p className="text-xs font-medium text-[var(--color-muted)]">Instructor decision</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-primary)]">
                {formatScore(assessment.overall_score)}
              </p>
              <Badge tone={finalized ? 'success' : 'warning'} className="mt-2">
                {finalized ? 'Final' : 'Not finalized'}
              </Badge>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3">
              <p className="text-xs font-medium text-[var(--color-muted)]">Context</p>
              <p className="mt-1 truncate text-sm font-medium">
                {assessment.student_name || '—'}
              </p>
              <p className="truncate text-sm text-[var(--color-muted)]">
                {assessment.assignment_title || '—'}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {assessment.viva_session ? (
                  <Link to={`/viva-sessions/${assessment.viva_session}`} className="mk-link">
                    Open viva dialogue
                  </Link>
                ) : null}
                {assessment.submission ? (
                  <Link to={`/submissions/${assessment.submission}?tab=evidence`} className="mk-link">
                    View evidence
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {assessment.evidence_summary ? (
            <p className="text-sm text-[var(--color-foreground)]">
              <span className="font-medium">Evidence: </span>
              {assessment.evidence_summary}
            </p>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <ChipList title="Strengths" items={assessment.strengths} />
            <ChipList title="Weaknesses" items={assessment.weaknesses} />
            <ChipList title="Needs review" items={assessment.areas_requiring_review} />
            <ChipList title="Unanswered" items={assessment.unanswered_areas} />
          </div>

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          {success ? <Alert tone="success" title={success} /> : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardBody className="space-y-2 py-4">
            <p className="text-sm font-semibold">Per-question</p>
            {questionReviews.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No linked viva answers yet.</p>
            ) : (
              <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                {questionReviews.map((review) => {
                  const open = openQuestionId === review.question_id
                  return (
                    <div
                      key={review.question_id}
                      className="rounded-xl border border-[var(--color-border)] bg-white"
                    >
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                        onClick={() => setOpenQuestionId(open ? null : review.question_id)}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>Q{review.sequence}</Badge>
                            {review.evaluation_overall != null ? (
                              <span className="text-sm font-semibold">
                                {formatScore(review.evaluation_overall)}/10
                              </span>
                            ) : null}
                            {review.confidence ? (
                              <Badge tone="warning">{review.confidence.replace(/_/g, ' ')}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm">{review.question_text}</p>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--color-muted)]">{open ? 'Hide' : 'Show'}</span>
                      </button>
                      {open ? (
                        <div className="space-y-2 border-t border-[var(--color-border)] px-3 py-3">
                          <div className="rounded-lg bg-[var(--color-surface)] p-2.5">
                            <p className="text-xs font-medium text-[var(--color-muted)]">Student answer</p>
                            {review.answer_text ? (
                              <p className="mt-1 whitespace-pre-wrap text-sm">{review.answer_text}</p>
                            ) : (
                              <p className="mt-1 text-sm text-[var(--color-muted)]">No answer recorded.</p>
                            )}
                            {review.answered_at ? (
                              <p className="mt-1 text-xs text-[var(--color-muted)]">
                                {review.input_mode === 'voice' ? 'Voice' : 'Text'} · {formatDate(review.answered_at)}
                              </p>
                            ) : null}
                          </div>
                          {review.evaluation_explanation ? (
                            <p className="text-sm">
                              <span className="font-medium">AI: </span>
                              {review.evaluation_explanation}
                            </p>
                          ) : null}
                          {!finalized ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                loading={saving}
                                onClick={() => reviewQuestion(review.question_id, 'agree')}
                              >
                                Agree
                              </Button>
                              <Button
                                variant="secondary"
                                loading={saving}
                                onClick={() => reviewQuestion(review.question_id, 'insufficient_evidence')}
                              >
                                Insufficient evidence
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 py-4">
              <p className="text-sm font-semibold">Rubric</p>
              <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                {assessment.criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="rounded-xl border border-[var(--color-border)] px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{criterion.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{criterion.category}</p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <div>
                        <p className="text-xs text-[var(--color-muted)]">AI</p>
                        <p className="text-sm font-semibold">
                          {formatScore(criterion.ai_score, criterion.max_score)}
                        </p>
                      </div>
                      <Input
                        label="Your score"
                        type="number"
                        min={0}
                        max={criterion.max_score}
                        step={0.5}
                        disabled={finalized}
                        value={scores[criterion.id]}
                        onChange={(e) =>
                          setScores((prev) => ({ ...prev, [criterion.id]: Number(e.target.value) }))
                        }
                      />
                      {!finalized ? (
                        <Button variant="secondary" loading={saving} onClick={() => saveCriterion(criterion.id)}>
                          Save
                        </Button>
                      ) : null}
                    </div>
                    {criterion.ai_explanation ? (
                      <p className="mt-2 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {criterion.ai_explanation}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 py-4">
              <p className="text-sm font-semibold">Finalize</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={finalized}
                placeholder="Instructor notes"
              />
              {!finalized ? (
                <Button loading={saving} onClick={finalize}>
                  Finalize assessment
                </Button>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
