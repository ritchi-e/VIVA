import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getOrganizationId, getStoredTokens, getVivaWebSocketUrl, vivaApi } from '@/lib/api'
import axios from 'axios'
import {
  EXAMINER_VOICE_OPTIONS,
  previewExaminerVoice,
  primeSpeechSynthesis,
  resetExaminerVoice,
  setExaminerVoiceChoice,
  speakExaminer,
  stopExaminerSpeech,
  waitUntilSpeechIdle,
  type ExaminerVoiceChoice,
} from '@/lib/browserTts'
import { enterFullscreen, exitFullscreen } from '@/lib/fullscreen'
import type { VivaExcerpt, VivaWsMessage } from '@/types'
import { VivaOrb, phaseLabel, type VivaPhase } from '@/components/viva/VivaOrb'
import { cn } from '@/lib/utils'

const SILENCE_MS = 2500
const MAX_LISTEN_MS = 40_000
const POST_SPEECH_DELAY_MS = 150
const MIN_LISTEN_MS = 3000

interface VivaInterfaceProps {
  sessionId: string
  questionBudget: number
  initialQuestionId?: string
  initialQuestionText?: string
  initialExcerpt?: VivaExcerpt | null
  initialSequence?: number
  initialComplete?: boolean
}

type AnswerResultMsg = {
  type: 'answer_result'
  next_question_id?: string | null
  next_question_text?: string | null
  next_question_sequence?: number | null
  next_question_excerpt?: VivaExcerpt | null
  session_state?: string
  questions_asked?: number
  question_budget?: number
}

type PendingQuestion = {
  id: string
  text: string
  seq?: number | null
  excerpt?: VivaExcerpt | null
}

export function VivaInterface({
  sessionId,
  questionBudget,
  initialQuestionId,
  initialQuestionText,
  initialExcerpt,
  initialSequence,
  initialComplete = false,
}: VivaInterfaceProps) {
  const [phase, setPhase] = useState<VivaPhase>(
    initialComplete ? 'complete' : 'connecting',
  )
  const [excerpt, setExcerpt] = useState<VivaExcerpt | null>(initialExcerpt ?? null)
  const [sequence, setSequence] = useState<number | null>(initialSequence ?? null)
  const [questionsAsked, setQuestionsAsked] = useState<number | null>(null)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [audioStarted, setAudioStarted] = useState(initialComplete)
  const [finishing, setFinishing] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<ExaminerVoiceChoice>('siya')
  const [previewingVoice, setPreviewingVoice] = useState<ExaminerVoiceChoice | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const questionIdRef = useRef<string | null>(initialQuestionId ?? null)
  const questionTextRef = useRef(initialQuestionText ?? '')
  const phaseRef = useRef(phase)
  const wsRef = useRef<WebSocket | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const shouldReconnect = useRef(true)
  const completeRef = useRef(initialComplete)
  const lastHandledQuestionRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const listenTimersRef = useRef<{ silence?: number; max?: number }>({})
  const transcriptPartsRef = useRef<string[]>([])
  const lastSpeechAtRef = useRef(0)
  const hadSpeechRef = useRef(false)
  const pendingQuestionRef = useRef<PendingQuestion | null>(
    initialQuestionId && initialQuestionText
      ? {
          id: initialQuestionId,
          text: initialQuestionText,
          seq: initialSequence,
          excerpt: initialExcerpt,
        }
      : null,
  )
  const audioStartedRef = useRef(initialComplete)
  const intentionalCloseRef = useRef(false)
  const questionFlowRef = useRef<{ id: string | null; inFlight: boolean }>({ id: null, inFlight: false })
  const listenStartedAtRef = useRef(0)

  phaseRef.current = phase
  audioStartedRef.current = audioStarted

  const speechSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    [],
  )

  const ttsSupported = true

  const stopAudio = useCallback(() => {
    stopExaminerSpeech()
  }, [])

  const clearListenTimers = useCallback(() => {
    if (listenTimersRef.current.silence) window.clearInterval(listenTimersRef.current.silence)
    if (listenTimersRef.current.max) window.clearTimeout(listenTimersRef.current.max)
    listenTimersRef.current = {}
  }, [])

  const stopListening = useCallback(() => {
    clearListenTimers()
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    recognitionRef.current = null
  }, [clearListenTimers])

  const submitAnswer = useCallback(
    async (text: string) => {
      if (submittingRef.current || completeRef.current || !questionIdRef.current) return
      submittingRef.current = true
      stopListening()
      stopAudio()
      await waitUntilSpeechIdle(3000, { allowCancel: true })
      setPhase('processing')
      setLiveTranscript('')

      const payload = {
        action: 'answer',
        type: 'answer',
        text: text.trim() || '[No audible response]',
        input_mode: 'voice',
        question_id: questionIdRef.current,
        organization_id: getOrganizationId(),
      }

      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload))
        } else {
          const { data } = await api.post(`/viva/sessions/${sessionId}/answer/`, {
            question_id: questionIdRef.current,
            text: payload.text,
            input_mode: 'voice',
          })
          handleAnswerResultRef.current(data as AnswerResultMsg)
        }
      } catch (err) {
        submittingRef.current = false
        setError(err instanceof Error ? err.message : 'Failed to submit answer')
        setPhase('error')
      }
    },
    [sessionId, stopAudio, stopListening],
  )

  const finishListening = useCallback(() => {
    if (phaseRef.current !== 'listening') return
    const text = transcriptPartsRef.current.join(' ').trim()
    const elapsed = Date.now() - listenStartedAtRef.current
    if (!text && elapsed < MIN_LISTEN_MS) return
    stopListening()
    void submitAnswer(text)
  }, [stopListening, submitAnswer])

  const startListening = useCallback(async () => {
    if (!speechSupported || completeRef.current) {
      setError('Speech recognition is not available in this browser.')
      setPhase('error')
      return
    }

    await new Promise((r) => window.setTimeout(r, POST_SPEECH_DELAY_MS))

    transcriptPartsRef.current = []
    hadSpeechRef.current = false
    lastSpeechAtRef.current = Date.now()
    listenStartedAtRef.current = Date.now()
    setLiveTranscript('')
    setPhase('listening')

    try {
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognitionCtor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const part = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            transcriptPartsRef.current.push(part)
            hadSpeechRef.current = true
            lastSpeechAtRef.current = Date.now()
          } else {
            interim += part
          }
        }
        const combined = [...transcriptPartsRef.current, interim].join(' ').trim()
        setLiveTranscript(combined)
      }

      recognition.onerror = () => {
        if (Date.now() - listenStartedAtRef.current < MIN_LISTEN_MS) return
        finishListening()
      }

      recognition.onend = () => {
        if (phaseRef.current !== 'listening') return
        const elapsed = Date.now() - listenStartedAtRef.current
        if (!hadSpeechRef.current && elapsed < MIN_LISTEN_MS) {
          try {
            recognition.start()
          } catch {
            /* recognition may already be running */
          }
          return
        }
        finishListening()
      }

      recognitionRef.current = recognition
      recognition.start()

      listenTimersRef.current.silence = window.setInterval(() => {
        if (!hadSpeechRef.current) return
        if (Date.now() - lastSpeechAtRef.current >= SILENCE_MS) {
          finishListening()
        }
      }, 250)

      listenTimersRef.current.max = window.setTimeout(() => {
        finishListening()
      }, MAX_LISTEN_MS)
    } catch {
      setError('Could not start microphone. Check browser permissions.')
      setPhase('error')
    }
  }, [finishListening, speechSupported])

  const handleNewQuestion = useCallback(
    async (q: PendingQuestion) => {
      if (completeRef.current) return

      const flow = questionFlowRef.current
      if (flow.inFlight && flow.id === q.id) return
      if (
        flow.id === q.id &&
        (phaseRef.current === 'speaking' ||
          phaseRef.current === 'listening' ||
          phaseRef.current === 'processing')
      ) {
        return
      }

      flow.inFlight = true
      flow.id = q.id
      lastHandledQuestionRef.current = q.id
      submittingRef.current = false
      stopListening()

      questionIdRef.current = q.id
      questionTextRef.current = q.text
      setExcerpt(q.excerpt?.quote ? q.excerpt : null)
      if (q.seq != null) setSequence(q.seq)
      setError(null)
      setPhase('speaking')

      if (!ttsSupported) {
        flow.inFlight = false
        setError('Text-to-speech is not available.')
        setPhase('error')
        return
      }

      try {
        await speakExaminer(q.text, { sessionId, speaker: selectedVoice })
        if (completeRef.current) return
        await startListening()
      } finally {
        if (flow.id === q.id) flow.inFlight = false
      }
    },
    [selectedVoice, sessionId, startListening, stopListening, ttsSupported],
  )

  const queueQuestion = useCallback(
    (q: PendingQuestion) => {
      pendingQuestionRef.current = q
      if (audioStartedRef.current && !completeRef.current) {
        void handleNewQuestion(q)
      }
    },
    [handleNewQuestion],
  )

  const beginSession = useCallback(async () => {
    if (!selectedVoice) {
      setError('Choose an examiner voice before starting.')
      return
    }

    setError(null)
    setExaminerVoiceChoice(selectedVoice)
    void enterFullscreen(containerRef.current ?? document.documentElement)
    try {
      await primeSpeechSynthesis()
    } catch {
      /* continue even if prime fails */
    }
    setAudioStarted(true)

    const pending = pendingQuestionRef.current
    if (pending) {
      pendingQuestionRef.current = null
      await handleNewQuestion(pending)
    } else if (phaseRef.current === 'connecting' || phaseRef.current === 'preparing') {
      setPhase(connected ? 'preparing' : 'connecting')
    }
  }, [connected, handleNewQuestion, selectedVoice])

  const finishViva = useCallback(async () => {
    if (completeRef.current || finishing) return
    if (
      !window.confirm(
        'Finish the viva now? Any answer you are currently giving will be saved, then your session will be submitted for evaluation.',
      )
    ) {
      return
    }

    setFinishing(true)
    shouldReconnect.current = false
    stopListening()
    stopAudio()
    await waitUntilSpeechIdle()

    const pendingText = [...transcriptPartsRef.current, liveTranscript].join(' ').trim()
    const questionId = questionIdRef.current

    try {
      await vivaApi.finish(
        sessionId,
        questionId && pendingText ? { question_id: questionId, text: pendingText } : undefined,
      )
      shouldReconnect.current = false
      intentionalCloseRef.current = true
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      wsRef.current?.close()
      wsRef.current = null
      completeRef.current = true
      setConnected(false)
      setPhase('complete')
      setLiveTranscript('')
      await exitFullscreen()
    } catch (err) {
      shouldReconnect.current = true
      const message =
        axios.isAxiosError(err) && err.response?.status === 404
          ? 'Finish viva is unavailable — restart the backend (docker compose restart backend) and try again.'
          : err instanceof Error
            ? err.message
            : 'Failed to finish viva'
      setError(message)
      setPhase('error')
    } finally {
      setFinishing(false)
    }
  }, [finishing, liveTranscript, sessionId, stopAudio, stopListening])

  const handleAnswerResultRef = useRef<(data: AnswerResultMsg) => void>(() => undefined)

  handleAnswerResultRef.current = (data: AnswerResultMsg) => {
    submittingRef.current = false
    if (data.questions_asked != null) setQuestionsAsked(data.questions_asked)

    const wsOpen = wsRef.current?.readyState === WebSocket.OPEN
    if (data.next_question_id && data.next_question_text && !wsOpen) {
      queueQuestion({
        id: data.next_question_id,
        text: data.next_question_text,
        seq: data.next_question_sequence,
        excerpt: data.next_question_excerpt ?? null,
      })
      return
    }

    if (['COMPLETED', 'REVIEW_REQUIRED'].includes(data.session_state || '')) {
      if (phaseRef.current === 'listening' || phaseRef.current === 'speaking') return
      completeRef.current = true
      setPhase('complete')
      setConnected(false)
      stopListening()
      stopAudio()
      void exitFullscreen()
    }
  }

  const connect = useCallback(() => {
    const tokens = getStoredTokens()
    if (!tokens?.access) {
      setError('Missing access token. Please sign in again.')
      setPhase('error')
      return
    }

    setPhase((p) => (p === 'complete' ? p : p === 'speaking' || p === 'listening' ? p : 'connecting'))
    const ws = new WebSocket(getVivaWebSocketUrl(sessionId, tokens.access))
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (initialQuestionId && initialQuestionText && !audioStartedRef.current) {
        pendingQuestionRef.current = {
          id: initialQuestionId,
          text: initialQuestionText,
          seq: initialSequence,
          excerpt: initialExcerpt,
        }
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as VivaWsMessage & { message?: string }
        if (msg.type === 'question' && msg.question_id && msg.text) {
          queueQuestion({
            id: msg.question_id,
            text: msg.text,
            seq: msg.sequence,
            excerpt: msg.excerpt ?? null,
          })
        } else if (msg.type === 'processing') {
          if (phaseRef.current === 'listening') {
            setPhase('processing')
          }
        } else if (msg.type === 'answer_result') {
          handleAnswerResultRef.current(msg as AnswerResultMsg)
        } else if (msg.type === 'complete') {
          if (phaseRef.current === 'listening' || phaseRef.current === 'speaking') return
          completeRef.current = true
          setPhase('complete')
          setConnected(false)
          intentionalCloseRef.current = true
          stopListening()
          stopAudio()
          void exitFullscreen()
        } else if (msg.type === 'error') {
          setError(msg.message)
          setPhase('error')
          submittingRef.current = false
        } else if ((msg as { type: string }).type === 'status') {
          if (!audioStartedRef.current) setPhase('preparing')
        }
      } catch {
        setError('Received an unreadable message from the viva server.')
        setPhase('error')
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (intentionalCloseRef.current || completeRef.current) return
      if (shouldReconnect.current) {
        reconnectTimer.current = window.setTimeout(connect, 2500)
      }
    }

    ws.onerror = () => {
      if (intentionalCloseRef.current || completeRef.current) return
      setConnected(false)
    }
  }, [
    sessionId,
    initialQuestionId,
    initialQuestionText,
    initialSequence,
    initialExcerpt,
    queueQuestion,
    stopAudio,
    stopListening,
  ])

  useEffect(() => {
    if (initialComplete) return undefined
    shouldReconnect.current = true
    connect()

    const poll = window.setInterval(() => {
      if (completeRef.current || !audioStarted) return
      if (phaseRef.current === 'speaking' || phaseRef.current === 'listening') return
      if (phaseRef.current !== 'processing' && phaseRef.current !== 'connecting' && phaseRef.current !== 'preparing') {
        return
      }
      void vivaApi.questions(sessionId).then((list) => {
        const open = list.find((q) => !q.student_answer)
        if (open && open.id !== lastHandledQuestionRef.current) {
          queueQuestion({
            id: open.id,
            text: open.question_text,
            seq: open.sequence,
            excerpt: open.excerpt ?? null,
          })
        }
      })
    }, 4000)

    return () => {
      shouldReconnect.current = false
      window.clearInterval(poll)
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      stopListening()
      stopAudio()
      stopExaminerSpeech()
      resetExaminerVoice()
      void exitFullscreen()
    }
  }, [sessionId, connect, queueQuestion, stopListening, stopAudio, initialComplete])

  const progress =
    questionsAsked != null && questionBudget > 0
      ? Math.min(100, Math.round((questionsAsked / questionBudget) * 100))
      : sequence != null && questionBudget > 0
        ? Math.min(100, Math.round((sequence / questionBudget) * 100))
        : 0

  const showBeginButton = !initialComplete && !audioStarted && phase !== 'complete'
  const immersive = !initialComplete

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white',
        immersive
          ? 'fixed inset-0 z-[200] min-h-dvh w-full'
          : 'min-h-[calc(100vh-8rem)] rounded-3xl shadow-2xl',
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col items-center px-4 py-8 sm:px-8">
        {audioStarted && !showBeginButton && phase !== 'complete' ? (
          <button
            type="button"
            disabled={finishing}
            onClick={() => void finishViva()}
            className="absolute right-4 top-4 z-20 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
          >
            {finishing ? 'Finishing…' : 'Finish viva'}
          </button>
        ) : null}

        <div className="mb-2 w-full max-w-xl text-xs text-white/50">
          <span>
            Question {sequence ?? '—'} of {questionBudget}
          </span>
        </div>

        <div className="mb-6 w-full max-w-xl">
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <VivaOrb phase={showBeginButton ? 'connecting' : phase} />

        <p className="mt-6 text-center text-lg font-medium tracking-tight text-white/90">
          {finishing
            ? 'Submitting your viva…'
            : showBeginButton
              ? 'Tap below to begin — the viva will open fullscreen'
              : phaseLabel(phase)}
        </p>

        {showBeginButton ? (
          <div className="mt-8 flex w-full max-w-lg flex-col items-stretch gap-4">
            <div>
              <p className="mb-3 text-center text-sm text-white/60">Choose examiner voice</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXAMINER_VOICE_OPTIONS.map((option) => {
                  const active = selectedVoice === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedVoice(option.id)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition',
                        active
                          ? 'border-cyan-400/60 bg-cyan-500/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10',
                      )}
                    >
                      <p className="text-sm font-medium text-white">{option.label}</p>
                      <p className="mt-0.5 text-xs text-white/50">{option.description}</p>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                disabled={previewingVoice != null}
                onClick={() => {
                  setPreviewingVoice(selectedVoice)
                  void previewExaminerVoice(sessionId, selectedVoice).finally(() =>
                    setPreviewingVoice(null),
                  )
                }}
                className="mt-3 w-full rounded-full border border-white/15 bg-white/5 py-2 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                {previewingVoice === selectedVoice ? 'Playing preview…' : 'Preview voice'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void beginSession()}
              className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              Begin viva
            </button>
          </div>
        ) : null}

        {phase === 'listening' && liveTranscript ? (
          <p className="mt-3 max-w-md text-center text-sm text-white/60 italic">{liveTranscript}</p>
        ) : null}

        {excerpt?.quote && phase !== 'complete' ? (
          <div className="mt-8 w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">
              From your submission{excerpt.source_ref ? ` · ${excerpt.source_ref}` : ''}
            </p>
            <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-white/85">
              {excerpt.quote}
            </pre>
          </div>
        ) : null}

        {phase === 'complete' ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-white/70">
              Your answers are being evaluated. Your instructor will review the assessment.
            </p>
            <Link
              to={`/student/results/${sessionId}`}
              className="mt-4 inline-block rounded-full bg-white/10 px-6 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
            >
              View results →
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 max-w-md text-center text-sm text-red-300">{error}</p>
        ) : null}

        {!speechSupported && phase !== 'complete' ? (
          <p className="mt-4 max-w-md text-center text-xs text-amber-200/80">
            This viva requires Chrome or Edge with speech recognition enabled.
          </p>
        ) : null}

        {!ttsSupported && phase !== 'complete' ? (
          <p className="mt-4 max-w-md text-center text-xs text-amber-200/80">
            Text-to-speech is not available in this browser.
          </p>
        ) : null}
      </div>
    </div>
  )
}
