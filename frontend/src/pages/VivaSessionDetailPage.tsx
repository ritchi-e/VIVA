import { Link, useParams } from 'react-router-dom'
import { vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate, formatScore } from '@/lib/utils'

export function VivaSessionDetailPage() {
  const { id = '' } = useParams()
  const session = useAsync(() => vivaApi.get(id).then((r) => r.data), [id])
  const questions = useAsync(() => vivaApi.questions(id), [id])

  if (session.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.vivaList} />
  if (session.error || !session.data) {
    return <ErrorState message={session.error ?? 'Session not found'} onRetry={session.reload} />
  }

  const s = session.data

  return (
    <div>
      <PageHeader
        title={s.assignment_title || 'Viva session'}
        description={`${s.student_name || s.student_email} · ${s.state} · ${s.mode}`}
        actions={
          <Link to={`/submissions/${s.submission}`} className="text-sm text-blue-700 hover:underline">
            View submission
          </Link>
        }
      />
      <Card className="mb-6">
        <CardBody className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <p>
            Student:{' '}
            <Link to={`/students/${s.student}`} className="text-blue-700 hover:underline">
              {s.student_name || s.student_email}
            </Link>
          </p>
          <p>
            Assignment:{' '}
            <Link to={`/assignments/${s.assignment}`} className="text-blue-700 hover:underline">
              {s.assignment_title || s.assignment}
            </Link>
          </p>
          <p>Started: {formatDate(s.started_at)}</p>
          <p>Completed: {formatDate(s.completed_at)}</p>
          <p>
            Progress: {s.questions_asked}/{s.question_budget} questions
          </p>
          <p>Time limit: {Math.round(s.time_limit_seconds / 60)} min</p>
          <p>
            State: <Badge>{s.state}</Badge>
            {s.integrity_terminated ? (
              <Badge tone="warning" className="ml-2">
                Integrity stop
              </Badge>
            ) : null}
          </p>
          {s.error_message ? <p className="text-red-600 sm:col-span-2">{s.error_message}</p> : null}
        </CardBody>
      </Card>

      {s.integrity_terminated ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/80">
          <CardBody>
            <h2 className="text-sm font-semibold text-amber-950">Stopped: left exam window</h2>
            <p className="mt-2 text-sm text-amber-900/80">
              This viva ended because of an integrity event
              {s.integrity_termination?.reason ? ` (${s.integrity_termination.reason.replace(/_/g, ' ')})` : ''}.
              Answers given before the stop are kept. No automatic assessment was generated.
            </p>
            {s.integrity_events && s.integrity_events.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-900/70">
                {s.integrity_events.map((event) => (
                  <li key={event.id}>
                    {event.event_type.replace(/_/g, ' ')}
                    {event.created_at ? ` · ${formatDate(event.created_at)}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {s.proctor_frames && s.proctor_frames.length > 0 ? (
        <Card className="mb-6">
          <CardBody>
            <h2 className="text-sm font-semibold text-slate-900">Monitoring snapshots</h2>
            <p className="mt-1 text-xs text-slate-500">
              Still frames captured during live monitoring for integrity review.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {s.proctor_frames.map((frame) =>
                frame.url ? (
                  <a key={frame.id} href={frame.url} target="_blank" rel="noreferrer">
                    <img
                      src={frame.url}
                      alt="Monitoring snapshot"
                      className="h-28 w-full rounded-lg object-cover"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">{formatDate(frame.captured_at)}</p>
                  </a>
                ) : null,
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold">Viva dialogue</h2>
      {questions.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.questions} /> : null}
      {questions.error ? <ErrorState message={questions.error} onRetry={questions.reload} /> : null}
      <div className="space-y-4">
        {questions.data?.map((q) => {
          const answer = q.student_answer
          const evaluation = answer?.evaluation
          return (
            <Card key={q.id}>
              <CardBody className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Q{q.sequence}</Badge>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {q.question_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(q.asked_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{q.question_text}</p>
                  {q.concept ? <p className="mt-1 text-xs text-slate-500">Focus: {q.concept}</p> : null}
                  {q.source_ref ? (
                    <p className="mt-1 text-xs text-slate-500">Cited file: {q.source_ref}</p>
                  ) : null}
                  {q.excerpt?.quote ? (
                    <blockquote className="mt-2 border-l-2 border-teal-200 pl-3 text-sm text-slate-600">
                      {q.excerpt.quote}
                    </blockquote>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Student answer</p>
                  {answer?.text ? (
                    <>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{answer.text}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Via {answer.input_mode === 'voice' ? 'voice' : 'text'} · {formatDate(answer.submitted_at)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No answer recorded for this question.</p>
                  )}
                </div>

                {evaluation ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-blue-700">AI evaluation</p>
                      <p className="text-sm font-semibold text-blue-900">
                        Overall {formatScore(evaluation.overall)} / 10
                      </p>
                    </div>
                    {evaluation.explanation ? (
                      <p className="mt-2 text-sm text-slate-700">{evaluation.explanation}</p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                      <p>Accuracy: {formatScore(evaluation.conceptual_accuracy)}</p>
                      <p>Evidence: {formatScore(evaluation.evidence_support)}</p>
                      <p>Depth: {formatScore(evaluation.depth)}</p>
                      <p>Relevance: {formatScore(evaluation.relevance)}</p>
                    </div>
                    {evaluation.requires_follow_up ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">Follow-up was requested</p>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
