import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { ErrorState } from '@/components/layout/StateViews'
import { VivaInterface } from '@/components/viva/VivaInterface'
import { PreparingVivaOverlay } from '@/components/viva/PreparingVivaOverlay'
import { formatVivaErrorMessage } from '@/lib/userErrors'

export function StudentVivaPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(
    () => {
      if (!id || id === 'undefined') {
        return Promise.reject(new Error('Missing viva session. Return to the dashboard and join from your booked slot.'))
      }
      return vivaApi.get(id).then((r) => r.data)
    },
    [id],
  )
  const questions = useAsync(
    () => {
      if (!id || id === 'undefined') return Promise.resolve([])
      return vivaApi.questions(id)
    },
    [id],
  )

  // Start AI question planning as soon as the page loads (before the student clicks Begin).
  useEffect(() => {
    if (!id || id === 'undefined' || !data) return
    if (!['CREATED', 'PREPARING'].includes(data.state)) return
    void vivaApi.prepare(id).then(() => reload()).catch(() => {
      void reload()
    })
  }, [id, data?.state])

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-[radial-gradient(ellipse_at_top,_#0f2f2c_0%,_#071018_45%,_#05080c_100%)]">
        <PreparingVivaOverlay />
      </div>
    )
  }
  if (error || !data) return <ErrorState message={error ?? 'Session not found'} onRetry={reload} />

  if (data.state === 'FAILED') {
    return (
      <ErrorState
        message={formatVivaErrorMessage(data.error_message)}
        onRetry={() => {
          void vivaApi.prepare(id).then(() => reload()).catch(() => reload())
        }}
      />
    )
  }

  if (['COMPLETED', 'REVIEW_REQUIRED'].includes(data.state)) {
    return (
      <VivaInterface sessionId={id} questionBudget={data.question_budget} initialComplete />
    )
  }

  const openQuestion =
    questions.data?.find((q) => !q.student_answer) ?? questions.data?.[questions.data.length - 1]

  return (
    <VivaInterface
      sessionId={id}
      questionBudget={data.question_budget}
      initialQuestionId={openQuestion?.id}
      initialQuestionText={openQuestion?.question_text}
      initialExcerpt={openQuestion?.excerpt ?? null}
      initialSequence={openQuestion?.sequence}
    />
  )
}
