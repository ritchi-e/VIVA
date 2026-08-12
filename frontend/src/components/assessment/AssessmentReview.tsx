import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assessmentsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import type { Assessment } from '@/types'
import { formatDate, formatScore } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api'

interface AssessmentReviewProps {
  assessment: Assessment
  onUpdated: (next: Assessment) => void
}

function ListSection({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function AssessmentReview({ assessment, onUpdated }: AssessmentReviewProps) {
  const [notes, setNotes] = useState(assessment.instructor_notes ?? '')
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      assessment.criteria.map((c) => [c.id, c.instructor_score ?? c.ai_score ?? 0]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const finalize = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data } = await assessmentsApi.finalize(assessment.id, { instructor_notes: notes })
      onUpdated(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const finalized = assessment.status === 'finalized'
  const questionReviews = assessment.question_reviews ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Overall assessment"
          description={assessment.disclaimer || 'AI-generated assessment based on the viva session. Instructor review required.'}
          action={<Badge tone={finalized ? 'success' : 'warning'}>{assessment.status.replace(/_/g, ' ')}</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">AI overall</p>
              <p className="text-2xl font-semibold text-slate-900">{formatScore(assessment.ai_overall_score)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Current overall</p>
              <p className="text-2xl font-semibold text-slate-900">{formatScore(assessment.overall_score)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Student</p>
              <p className="text-sm font-medium text-slate-900">{assessment.student_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Assignment</p>
              <p className="text-sm font-medium text-slate-900">{assessment.assignment_title || '—'}</p>
            </div>
          </div>

          {assessment.viva_session ? (
            <p className="text-sm text-slate-600">
              Based on viva session{' '}
              <Link to={`/viva-sessions/${assessment.viva_session}`} className="text-blue-700 hover:underline">
                view dialogue
              </Link>
            </p>
          ) : null}

          {assessment.evidence_summary ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Evidence summary</p>
              <p className="mt-2 text-sm text-slate-700">{assessment.evidence_summary}</p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ListSection title="Strengths" items={assessment.strengths} />
            <ListSection title="Weaknesses" items={assessment.weaknesses} />
            <ListSection title="Areas requiring review" items={assessment.areas_requiring_review} />
            <ListSection title="Unanswered areas" items={assessment.unanswered_areas} />
            <ListSection title="Recommended follow-ups" items={assessment.recommended_followups} />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Per-question review</h2>
        {questionReviews.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-slate-600">
              No viva question answers are linked to this assessment yet.
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {questionReviews.map((review) => (
              <Card key={review.question_id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Q{review.sequence}</Badge>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {review.question_type.replace(/_/g, ' ')}
                    </span>
                    {review.evaluation_overall != null ? (
                      <span className="text-sm font-semibold text-slate-900">
                        Score {formatScore(review.evaluation_overall)} / 10
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{review.question_text}</p>
                    {review.concept ? <p className="mt-1 text-xs text-slate-500">Focus: {review.concept}</p> : null}
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Student answer</p>
                    {review.answer_text ? (
                      <>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{review.answer_text}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Via {review.input_mode === 'voice' ? 'voice' : 'text'}
                          {review.answered_at ? ` · ${formatDate(review.answered_at)}` : ''}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No answer recorded.</p>
                    )}
                  </div>
                  {review.evaluation_explanation ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">AI evaluation: </span>
                      {review.evaluation_explanation}
                    </p>
                  ) : null}
                  {review.evaluation_overall != null ? (
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                      <p>Accuracy: {formatScore(review.conceptual_accuracy)}</p>
                      <p>Evidence: {formatScore(review.evidence_support)}</p>
                      <p>Depth: {formatScore(review.depth)}</p>
                      <p>Relevance: {formatScore(review.relevance)}</p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Rubric criteria</h2>
        <div className="space-y-4">
          {assessment.criteria.map((criterion) => (
            <Card key={criterion.id}>
              <CardHeader title={criterion.name} description={criterion.category} />
              <CardBody className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">AI score</p>
                    <p className="font-medium">{formatScore(criterion.ai_score, criterion.max_score)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="font-medium">{(criterion.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <Input
                      label="Instructor score"
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
                  </div>
                </div>
                {criterion.ai_explanation ? (
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">AI rationale: </span>
                    {criterion.ai_explanation}
                  </p>
                ) : null}
                {criterion.explanation ? (
                  <p className="text-sm text-slate-600">{criterion.explanation}</p>
                ) : null}
                {!finalized ? (
                  <Button variant="secondary" loading={saving} onClick={() => saveCriterion(criterion.id)}>
                    Save score
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader title="Instructor notes" />
        <CardBody className="space-y-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={finalized} />
          {!finalized ? (
            <Button loading={saving} onClick={finalize}>
              Finalize assessment
            </Button>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
