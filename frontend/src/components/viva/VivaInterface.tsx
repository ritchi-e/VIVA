import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, getApiErrorMessage, getOrganizationId, getStoredTokens, getVivaWebSocketUrl, vivaApi } from '@/lib/api'
import { formatVivaErrorMessage } from '@/lib/userErrors'
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
import {
  micCaptureSupported,
  startVoiceSession,
  transcribeSessionAudio,
  type VoiceSession,
} from '@/lib/deepgramStt'
import {
  INTEGRITY_GRACE_MS,
  PROCTOR_FRAME_INTERVAL_MS,
  reportIntegrityEvent,
  startCameraMonitor,
  uploadProctorFrame,
  type CameraMonitor,
} from '@/lib/proctoring'
import { enterFullscreen, exitFullscreen } from '@/lib/fullscreen'
import type { VivaExcerpt, VivaWsMessage } from '@/types'
import { VivaOrb, phaseCopy, useRotatingDetail, type VivaPhase } from '@/components/viva/VivaOrb'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { cn } from '@/lib/utils'

const SILENCE_MS = 2500
const MAX_LISTEN_MS = 40_000
const POST_SPEECH_DELAY_MS = 150
const MIN_LISTEN_MS = 3000
/** Close the turn early when the student never starts answering. */
const NO_SPEECH_MS = 20_000

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
  const [awaySeconds, setAwaySeconds] = useState<number | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<ExaminerVoiceChoice>('siya')
  const [previewingVoice, setPreviewingVoice] = useState<ExaminerVoiceChoice | null>(null)
  const selectedVoiceRef = useRef<ExaminerVoiceChoice>('siya')

  const containerRef = useRef<HTMLDivElement>(null)

  const questionIdRef = useRef<string | null>(initialQuestionId ?? null)
  const questionTextRef = useRef(initialQuestionText ?? '')
  const phaseRef = useRef(phase)
  const wsRef = useRef<WebSocket | null>(null)
  const voiceSessionRef = useRef<VoiceSession | null>(null)
  const finishingListenRef = useRef(false)
  const reconnectTimer = useRef<number | null>(null)
  const shouldReconnect = useRef(true)
  const completeRef = useRef(initialComplete)
  const lastHandledQuestionRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const listenTimersRef = useRef<{ silence?: number; max?: number }>({})
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
  const cameraRef = useRef<CameraMonitor | null>(null)
  const frameTimerRef = useRef<number | null>(null)
  const graceTimerRef = useRef<number | null>(null)
  const graceTickRef = useRef<number | null>(null)
  const monitorEnabledRef = useRef(false)
  const watchFullscreenRef = useRef(false)
  const terminatingRef = useRef(false)

  phaseRef.current = phase
  audioStartedRef.current = audioStarted

  const micSupported = useMemo(() => micCaptureSupported(), [])

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
    finishingListenRef.current = true
    const session = voiceSessionRef.current
    voiceSessionRef.current = null
    session?.destroy()
  }, [clearListenTimers])

  const stopMonitoring = useCallback(() => {
    monitorEnabledRef.current = false
    setAwaySeconds(null)
    if (graceTimerRef.current) {
      window.clearTimeout(graceTimerRef.current)
      graceTimerRef.current = null
    }
    if (graceTickRef.current) {
      window.clearInterval(graceTickRef.current)
      graceTickRef.current = null
    }
    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current)
      frameTimerRef.current = null
    }
    cameraRef.current?.stop()
    cameraRef.current = null
  }, [])

  const terminateIntegrity = useCallback(
    async (eventType: 'grace_expired' | 'camera_denied', metadata?: Record<string, unknown>) => {
      if (terminatingRef.current || completeRef.current) return
      terminatingRef.current = true
      completeRef.current = true
      shouldReconnect.current = false
      stopListening()
      stopAudio()
      stopMonitoring()
      try {
        await reportIntegrityEvent(sessionId, eventType, metadata)
      } catch {
        /* session may already be failed */
      }
      intentionalCloseRef.current = true
      wsRef.current?.close()
      setPhase('terminated')
      void exitFullscreen()
    },
    [sessionId, stopAudio, stopListening, stopMonitoring],
  )

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
        setError(getApiErrorMessage(err, 'viva.answer'))
        setPhase('error')
      }
    },
    [sessionId, stopAudio, stopListening],
  )

  const finishListening = useCallback(async () => {
    if (phaseRef.current !== 'listening' || finishingListenRef.current) return
    const elapsed = Date.now() - listenStartedAtRef.current
    if (!hadSpeechRef.current && elapsed < MIN_LISTEN_MS) return

    finishingListenRef.current = true
    clearListenTimers()
    setPhase('processing')
    setLiveTranscript('Transcribing your answer…')

    const session = voiceSessionRef.current
    voiceSessionRef.current = null

    try {
      const blob = session ? await session.stop() : null
      if (!blob || blob.size < 256) {
        await submitAnswer('')
        return
      }
      const text = await transcribeSessionAudio(sessionId, blob)
      setLiveTranscript(text)
      await submitAnswer(text)
    } catch (err) {
      session?.destroy()
      submittingRef.current = false
      setError(getApiErrorMessage(err, 'viva.stt'))
      setPhase('error')
    }
  }, [clearListenTimers, sessionId, submitAnswer])

  const startListening = useCallback(async () => {
    if (!micSupported || completeRef.current) {
      setError('Microphone access is required for this viva. Allow mic permissions and try again.')
      setPhase('error')
      return
    }

    await new Promise((r) => window.setTimeout(r, POST_SPEECH_DELAY_MS))

    finishingListenRef.current = false
    hadSpeechRef.current = false
    listenStartedAtRef.current = Date.now()
    setLiveTranscript('Listening…')
    setPhase('listening')

    try {
      const session = await startVoiceSession((active) => {
        if (!active || finishingListenRef.current) return
        hadSpeechRef.current = true
        setLiveTranscript((prev) => (prev ? prev : 'Listening…'))
      })
      voiceSessionRef.current = session

      listenTimersRef.current.silence = window.setInterval(() => {
        const active = voiceSessionRef.current
        if (!active || finishingListenRef.current) return
        if (active.hasSpeech()) {
          if (active.silenceMs() >= SILENCE_MS) void finishListening()
          return
        }
        if (Date.now() - listenStartedAtRef.current >= NO_SPEECH_MS) void finishListening()
      }, 200)

      listenTimersRef.current.max = window.setTimeout(() => {
        void finishListening()
      }, MAX_LISTEN_MS)
    } catch {
      setError('Could not start microphone. Check browser permissions.')
      setPhase('error')
    }
  }, [finishListening, micSupported])

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
        const speaker = selectedVoiceRef.current
        await speakExaminer(q.text, { sessionId, speaker })
        if (completeRef.current) return
        await startListening()
      } catch (err) {
        setError(getApiErrorMessage(err, 'viva.tts'))
        setPhase('error')
      } finally {
        if (flow.id === q.id) flow.inFlight = false
      }
    },
    [sessionId, startListening, stopListening, ttsSupported],
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
    selectedVoiceRef.current = selectedVoice
    setExaminerVoiceChoice(selectedVoice, sessionId)
    const fullscreenOk = await enterFullscreen(containerRef.current ?? document.documentElement)
    watchFullscreenRef.current = fullscreenOk
    try {
      await primeSpeechSynthesis()
    } catch {
      /* continue even if prime fails */
    }

    try {
      const camera = await startCameraMonitor()
      cameraRef.current = camera
      frameTimerRef.current = window.setInterval(() => {
        const monitor = cameraRef.current
        if (!monitor || completeRef.current) return
        void monitor.captureJpeg().then((blob) => {
          if (!blob || blob.size < 400) return
          void uploadProctorFrame(sessionId, blob).catch(() => undefined)
        })
      }, PROCTOR_FRAME_INTERVAL_MS)
      window.setTimeout(() => {
        const monitor = cameraRef.current
        if (!monitor) return
        void monitor.captureJpeg().then((blob) => {
          if (!blob || blob.size < 400) return
          void uploadProctorFrame(sessionId, blob).catch(() => undefined)
        })
      }, 1500)
    } catch {
      await terminateIntegrity('camera_denied')
      setError('Camera access is required. Allow the camera and restart the viva.')
      return
    }

    monitorEnabledRef.current = true
    setAudioStarted(true)

    const pending = pendingQuestionRef.current
    if (pending) {
      pendingQuestionRef.current = null
      await handleNewQuestion(pending)
    } else if (phaseRef.current === 'connecting' || phaseRef.current === 'preparing') {
      setPhase(connected ? 'preparing' : 'connecting')
    }
  }, [connected, handleNewQuestion, selectedVoice, sessionId, terminateIntegrity])

  useEffect(() => {
    const isAway = () => {
      if (document.hidden) return true
      if (watchFullscreenRef.current && !document.fullscreenElement) return true
      return false
    }

    const clearGrace = () => {
      if (graceTimerRef.current) {
        window.clearTimeout(graceTimerRef.current)
        graceTimerRef.current = null
      }
      if (graceTickRef.current) {
        window.clearInterval(graceTickRef.current)
        graceTickRef.current = null
      }
      setAwaySeconds(null)
    }

    const onLeave = () => {
      if (!monitorEnabledRef.current || completeRef.current || terminatingRef.current) return
      if (graceTimerRef.current) return
      void reportIntegrityEvent(sessionId, document.hidden ? 'tab_hidden' : 'fullscreen_left').catch(
        () => undefined,
      )
      const started = Date.now()
      setAwaySeconds(Math.ceil(INTEGRITY_GRACE_MS / 1000))
      graceTickRef.current = window.setInterval(() => {
        const left = Math.max(0, Math.ceil((INTEGRITY_GRACE_MS - (Date.now() - started)) / 1000))
        setAwaySeconds(left)
      }, 200)
      graceTimerRef.current = window.setTimeout(() => {
        void terminateIntegrity('grace_expired', { hidden_ms: Date.now() - started })
      }, INTEGRITY_GRACE_MS)
    }

    const onReturn = () => {
      if (!monitorEnabledRef.current || completeRef.current) return
      if (!graceTimerRef.current) return
      clearGrace()
      void reportIntegrityEvent(sessionId, 'tab_returned').catch(() => undefined)
    }

    const onChange = () => {
      if (isAway()) onLeave()
      else onReturn()
    }

    document.addEventListener('visibilitychange', onChange)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('visibilitychange', onChange)
      document.removeEventListener('fullscreenchange', onChange)
      clearGrace()
    }
  }, [sessionId, terminateIntegrity])

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
    finishingListenRef.current = true
    clearListenTimers()
    stopAudio()
    stopMonitoring()
    await waitUntilSpeechIdle()

    let pendingText = ''
    const voice = voiceSessionRef.current
    voiceSessionRef.current = null
    if (voice) {
      try {
        const blob = await voice.stop()
        if (blob && blob.size >= 256) {
          pendingText = await transcribeSessionAudio(sessionId, blob)
        }
      } catch {
        voice.destroy()
      }
    } else if (
      liveTranscript &&
      !liveTranscript.startsWith('Listening') &&
      !liveTranscript.startsWith('Transcribing')
    ) {
      pendingText = liveTranscript.trim()
    }

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
      setError(getApiErrorMessage(err, 'viva.finish'))
      setPhase('error')
    } finally {
      setFinishing(false)
    }
  }, [clearListenTimers, finishing, liveTranscript, sessionId, stopAudio, stopMonitoring])

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
          setError(formatVivaErrorMessage(msg.message))
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
      stopMonitoring()
      // Do not resetExaminerVoice() here — this effect also re-runs on reconnect
      // dependency churn and would drop the locked Noah/Siya mid-viva.
      void exitFullscreen()
    }
  }, [sessionId, connect, queueQuestion, stopListening, stopAudio, stopMonitoring, initialComplete])

  useEffect(() => {
    return () => {
      resetExaminerVoice(sessionId)
    }
  }, [sessionId])

  const progress =
    questionsAsked != null && questionBudget > 0
      ? Math.min(100, Math.round((questionsAsked / questionBudget) * 100))
      : sequence != null && questionBudget > 0
        ? Math.min(100, Math.round((sequence / questionBudget) * 100))
        : 0

  const showBeginButton =
    !initialComplete && !audioStarted && phase !== 'complete' && phase !== 'terminated'
  const immersive = !initialComplete
  const blockCopy = immersive && phase !== 'complete'
  const activePhase = showBeginButton ? 'connecting' : phase
  const copy = finishing ? PLATFORM_PROGRESS.finishingViva : phaseCopy(activePhase)
  const rotating = useRotatingDetail(
    finishing || showBeginButton ? undefined : phaseCopy(phase).rotating,
  )
  const statusTitle = finishing
    ? PLATFORM_PROGRESS.finishingViva.title
    : showBeginButton
      ? 'Ready when you are'
      : copy.title
  const statusDetail = finishing
    ? PLATFORM_PROGRESS.finishingViva.detail
    : showBeginButton
      ? 'Choose a voice, then begin. This viva is live-monitored. Stay in this window; leaving for more than 5 seconds ends the session and notifies your instructor. Camera access is required.'
      : rotating ?? copy.detail

  const preventCopy = useCallback((event: ClipboardEvent | MouseEvent | DragEvent) => {
    if (!blockCopy) return
    event.preventDefault()
    event.stopPropagation()
  }, [blockCopy])

  return (
    <div
      ref={containerRef}
      onCopy={preventCopy}
      onCut={preventCopy}
      onContextMenu={preventCopy}
      onDragStart={preventCopy}
      className={cn(
        'relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_#0f2f2c_0%,_#071018_45%,_#05080c_100%)] text-white',
        immersive
          ? 'fixed inset-0 z-[200] min-h-dvh w-full'
          : 'min-h-[calc(100vh-8rem)] rounded-3xl shadow-2xl',
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-400/8 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col items-center px-4 py-8 sm:px-8">
        {awaySeconds != null && phase !== 'terminated' ? (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 px-6">
            <div className="max-w-md rounded-3xl border border-amber-200/30 bg-[#1a140c] p-8 text-center shadow-2xl">
              <p className="font-display text-2xl font-semibold text-amber-50">Return to the viva</p>
              <p className="mt-3 text-sm leading-relaxed text-amber-100/70">
                Stay in this window. If you do not return in {awaySeconds} second
                {awaySeconds === 1 ? '' : 's'}, the session ends and your instructor is notified.
              </p>
              <p className="mt-5 font-display text-5xl font-semibold tabular-nums text-amber-200">
                {awaySeconds}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mb-8 flex w-full max-w-xl items-center justify-between">
          <p className="font-display text-sm font-semibold tracking-tight text-white/80">Mokhik</p>
          {audioStarted && !showBeginButton && phase !== 'complete' && phase !== 'terminated' ? (
            <button
              type="button"
              disabled={finishing}
              onClick={() => void finishViva()}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/75 backdrop-blur transition hover:bg-white/10 disabled:opacity-50"
            >
              {finishing ? 'Closing session…' : 'End viva'}
            </button>
          ) : (
            <span className="text-xs text-white/40">Oral assessment</span>
          )}
        </div>

        <div className="mb-2 flex w-full max-w-xl items-end justify-between text-xs text-white/45">
          <span>
            Question {sequence ?? '—'} of {questionBudget}
          </span>
          <span>{progress}%</span>
        </div>

        <div className="mb-8 w-full max-w-xl">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <VivaOrb phase={activePhase} />

        <div className="mt-7 max-w-lg text-center animate-viva-fade-up" key={statusTitle}>
          <p className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {statusTitle}
          </p>
          {statusDetail ? (
            <p className="mt-2 text-sm leading-relaxed text-white/55 transition-opacity duration-500">
              {statusDetail}
            </p>
          ) : null}
        </div>

        {showBeginButton ? (
          <div className="mt-10 flex w-full max-w-lg flex-col items-stretch gap-5 animate-viva-fade-up">
            <div>
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Examiner voice
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXAMINER_VOICE_OPTIONS.map((option) => {
                  const active = selectedVoice === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedVoice(option.id)
                        selectedVoiceRef.current = option.id
                      }}
                      className={cn(
                        'rounded-2xl border px-4 py-3.5 text-left transition',
                        active
                          ? 'border-teal-400/50 bg-teal-500/15 shadow-[0_0_24px_rgba(45,212,191,0.12)]'
                          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                      )}
                    >
                      <p className="text-sm font-semibold text-white">{option.label}</p>
                      <p className="mt-0.5 text-xs text-white/45">{option.description}</p>
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
                className="mt-3 w-full rounded-full border border-white/12 bg-white/[0.04] py-2.5 text-xs font-medium text-white/65 hover:bg-white/[0.08] disabled:opacity-50"
              >
                {previewingVoice === selectedVoice ? 'Playing a short sample…' : 'Preview voice'}
              </button>
            </div>
            <div className="rounded-2xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-left text-xs leading-relaxed text-amber-50/85">
              This viva is live-monitored. Stay in this window. If you leave for more than 5 seconds,
              the session ends and your instructor is notified. Camera access is required.
            </div>
            <button
              type="button"
              onClick={() => void beginSession()}
              className="rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 px-8 py-3.5 font-display text-sm font-semibold text-white shadow-[0_12px_40px_rgba(20,184,166,0.35)] transition hover:brightness-110"
            >
              Begin viva
            </button>
          </div>
        ) : null}

        {phase === 'listening' && liveTranscript ? (
          <p className="mt-4 max-w-md text-center text-sm italic text-teal-100/70">{liveTranscript}</p>
        ) : null}

        {excerpt?.quote && phase !== 'complete' ? (
          <div
            className="mt-8 w-full max-w-xl select-none rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
            onCopy={preventCopy}
            onCut={preventCopy}
            onContextMenu={preventCopy}
            onDragStart={preventCopy}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-200/50">
              From your submission{excerpt.source_ref ? ` · ${excerpt.source_ref}` : ''}
            </p>
            <pre
              className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80 select-none"
              style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
              onCopy={preventCopy}
              onCut={preventCopy}
              onContextMenu={preventCopy}
              onDragStart={preventCopy}
            >
              {excerpt.quote}
            </pre>
          </div>
        ) : null}

        {phase === 'complete' ? (
          <div className="mt-8 max-w-md text-center animate-viva-fade-up">
            <p className="text-sm leading-relaxed text-white/60">
              Your answers are saved. An assessment draft will be prepared for your instructor.
            </p>
            <Link
              to={`/student/results/${sessionId}`}
              className="mt-5 inline-block rounded-full border border-teal-400/30 bg-teal-500/15 px-6 py-2.5 text-sm font-semibold text-teal-50 backdrop-blur hover:bg-teal-500/25"
            >
              View results
            </Link>
          </div>
        ) : null}

        {phase === 'terminated' ? (
          <div className="mt-8 max-w-md text-center animate-viva-fade-up">
            <p className="text-sm leading-relaxed text-amber-100/80">
              The viva was stopped because you left the exam window. Your instructor has received a
              report. You cannot continue this session.
            </p>
            <Link
              to="/student/dashboard"
              className="mt-5 inline-block rounded-full border border-white/15 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/15"
            >
              Back to dashboard
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 max-w-md text-center text-sm text-rose-300">{error}</p>
        ) : null}

        {!micSupported && phase !== 'complete' ? (
          <p className="mt-4 max-w-md text-center text-xs text-amber-100/70">
            Microphone access is required. Use Chrome or Edge and allow the mic when prompted.
          </p>
        ) : null}

        {!ttsSupported && phase !== 'complete' ? (
          <p className="mt-4 max-w-md text-center text-xs text-amber-100/70">
            Voice playback is not available in this browser.
          </p>
        ) : null}
      </div>
    </div>
  )
}
