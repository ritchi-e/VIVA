import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { cn } from '@/lib/utils'

export function VivaPrepScreen({
  assignmentTitle,
  questionBudget,
  timeLimitSeconds,
  submissionLabel,
  onStart,
  starting,
}: {
  assignmentTitle: string
  questionBudget: number
  timeLimitSeconds?: number | null
  submissionLabel?: string
  onStart: () => void | Promise<void>
  starting?: boolean
}) {
  const [micOk, setMicOk] = useState(false)
  const [camOk, setCamOk] = useState(false)
  const [ackRules, setAckRules] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [checking, setChecking] = useState<'mic' | 'cam' | null>(null)

  const minutes =
    timeLimitSeconds && timeLimitSeconds > 0
      ? Math.max(5, Math.round(timeLimitSeconds / 60))
      : 15

  const checkMic = async () => {
    setChecking('mic')
    setCheckError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicOk(true)
    } catch {
      setMicOk(false)
      setCheckError('Microphone access is required. Allow the browser prompt and try again.')
    } finally {
      setChecking(null)
    }
  }

  const checkCam = async () => {
    setChecking('cam')
    setCheckError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      setCamOk(true)
    } catch {
      setCamOk(false)
      setCheckError('Camera access is required for session monitoring. Allow the browser prompt and try again.')
    } finally {
      setChecking(null)
    }
  }

  const canStart = micOk && camOk && ackRules

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Before you begin
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
          {assignmentTitle || 'Oral assessment'}
        </h1>
        <p className="mt-2 text-base text-[var(--color-muted)]">
          This viva is based on your submitted work. You will be asked questions about your methods,
          decisions, and results. Follow-up questions may appear based on your answers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">Estimated time</p>
          <p className="mt-1 text-lg font-semibold">{minutes} minutes</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">Questions</p>
          <p className="mt-1 text-lg font-semibold">About {questionBudget || 'several'}</p>
        </div>
      </div>

      {submissionLabel ? (
        <Alert tone="info" title="Submission being assessed">
          {submissionLabel}
        </Alert>
      ) : null}

      <Alert tone="warning" title="Stay in this window">
        Leaving or switching away for more than 5 seconds ends the viva. Your previous answers stay
        saved. If the connection drops, reopen this page from your dashboard to continue when the
        session is still active.
      </Alert>

      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white p-4">
        <p className="text-sm font-semibold">Device checks</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" loading={checking === 'mic'} onClick={checkMic}>
            {micOk ? 'Microphone ready' : 'Check microphone'}
          </Button>
          <Button variant="secondary" loading={checking === 'cam'} onClick={checkCam}>
            {camOk ? 'Camera ready' : 'Check camera'}
          </Button>
        </div>
        {checkError ? <p className="text-sm text-[var(--color-danger)]">{checkError}</p> : null}
        <label className="flex items-start gap-2 text-sm text-[var(--color-foreground)]">
          <input
            type="checkbox"
            className="mt-1"
            checked={ackRules}
            onChange={(e) => setAckRules(e.target.checked)}
          />
          <span>
            I understand the camera is required for monitoring, and leaving this window can end the
            session.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          className={cn(!canStart && 'opacity-60')}
          disabled={!canStart}
          loading={starting}
          onClick={() => void onStart()}
        >
          Start viva
        </Button>
      </div>
    </div>
  )
}
