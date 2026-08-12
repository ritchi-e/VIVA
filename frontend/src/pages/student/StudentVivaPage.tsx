import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { LoadingPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { VivaInterface } from '@/components/viva/VivaInterface'

export function StudentVivaPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(
    () => {
      if (!id || id === 'undefined') {
        return Promise.reject(new Error('Missing viva session id. Start the viva again from your assignment.'))
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
    void vivaApi.prepare(id).catch(() => {
      /* VivaInterface / websocket will surface errors */
    })
  }, [id, data?.state])

  if (loading) return <LoadingPanel />
  if (error || !data) return <ErrorState message={error ?? 'Session not found'} onRetry={reload} />

  if (data.state === 'FAILED') {
    return (
      <ErrorState
        message={data.error_message || 'This viva session failed while preparing questions.'}
        onRetry={reload}
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
