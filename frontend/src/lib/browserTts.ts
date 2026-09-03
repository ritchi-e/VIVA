/** Examiner TTS via Rumik Mulberry (server /speak). Voice is locked for the session. */

import { api } from '@/lib/api'
import { prepareSpeechText } from '@/lib/speechText'

export type ExaminerVoiceChoice = 'siya' | 'noah'

export type ExaminerVoiceOption = {
  id: ExaminerVoiceChoice
  label: string
  description: string
  gender: 'female' | 'male'
}

/** Only these two Rumik Mulberry speakers are offered to students. */
export const EXAMINER_VOICE_OPTIONS: ExaminerVoiceOption[] = [
  {
    id: 'siya',
    label: 'Siya · Female',
    description: 'Calm professional examiner',
    gender: 'female',
  },
  {
    id: 'noah',
    label: 'Noah · Male',
    description: 'Clear professional examiner',
    gender: 'male',
  },
]

const STORAGE_PREFIX = 'aiviva_examiner_voice:'

let lockedSpeaker: ExaminerVoiceChoice | null = null
let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null

function isVoiceChoice(value: string | null | undefined): value is ExaminerVoiceChoice {
  return value === 'siya' || value === 'noah'
}

export function getExaminerVoiceOptions(): ExaminerVoiceOption[] {
  return EXAMINER_VOICE_OPTIONS
}

export function setExaminerVoiceChoice(choice: ExaminerVoiceChoice, sessionId?: string): void {
  lockedSpeaker = choice
  if (sessionId && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, choice)
  }
}

export function getExaminerVoiceChoice(sessionId?: string): ExaminerVoiceChoice | null {
  if (lockedSpeaker) return lockedSpeaker
  if (sessionId && typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${sessionId}`)
    if (isVoiceChoice(stored)) {
      lockedSpeaker = stored
      return stored
    }
  }
  return null
}

/** Clear only when leaving the viva page — not on WS reconnect. */
export function resetExaminerVoice(sessionId?: string): void {
  lockedSpeaker = null
  if (sessionId && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`)
  }
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function stopExaminerSpeech(): void {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
  if (speechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

export async function waitUntilSpeechIdle(
  maxMs = 5000,
  options?: { allowCancel?: boolean },
): Promise<void> {
  const allowCancel = options?.allowCancel ?? true
  const start = Date.now()
  while (activeAudio && !activeAudio.paused && !activeAudio.ended) {
    if (Date.now() - start > maxMs) {
      if (allowCancel) stopExaminerSpeech()
      break
    }
    await new Promise((r) => window.setTimeout(r, 50))
  }
  if (!speechSynthesisSupported()) return
  while (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    if (Date.now() - start > maxMs) {
      if (allowCancel) window.speechSynthesis.cancel()
      break
    }
    await new Promise((r) => window.setTimeout(r, 50))
  }
}

async function playAudioBlob(blob: Blob, existing?: HTMLAudioElement | null): Promise<void> {
  if (!existing) stopExaminerSpeech()
  const objectUrl = URL.createObjectURL(blob)
  activeObjectUrl = objectUrl
  const audio = existing ?? new Audio()
  audio.src = objectUrl
  activeAudio = audio

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      if (activeAudio === audio) activeAudio = null
      if (activeObjectUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl)
        activeObjectUrl = null
      }
      resolve()
    }
    audio.onended = done
    audio.onerror = () => {
      done()
      reject(new Error('Audio playback failed'))
    }
    void audio.play().catch((err) => {
      done()
      reject(err)
    })
  })
}

/** Tiny WAV so browsers treat later TTS playback as a continued user-gesture session. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

async function unlockPlayback(): Promise<HTMLAudioElement> {
  await primeSpeechSynthesis()
  const audio = new Audio(SILENT_WAV)
  audio.volume = 0.01
  try {
    await audio.play()
  } catch {
    /* some browsers still allow later play() after this attempt */
  }
  audio.pause()
  audio.volume = 1
  return audio
}

async function speakViaRumik(
  sessionId: string,
  text: string,
  speaker: ExaminerVoiceChoice,
  options?: { preview?: boolean; audio?: HTMLAudioElement | null },
): Promise<void> {
  const response = await api.post(
    `/viva/sessions/${sessionId}/speak/`,
    { text, speaker, preview: Boolean(options?.preview) },
    {
      responseType: 'blob',
      timeout: 60_000,
    },
  )
  const contentType = String(response.headers['content-type'] || '')
  if (contentType.includes('application/json')) {
    const message = await (response.data as Blob).text()
    let detail = message || 'TTS request failed'
    try {
      const parsed = JSON.parse(message) as { detail?: string; message?: string }
      detail = parsed.detail || parsed.message || detail
    } catch {
      /* keep raw text */
    }
    throw new Error(detail)
  }
  const blob = response.data as Blob
  if (!blob || blob.size < 100) {
    throw new Error('TTS returned empty audio')
  }
  await playAudioBlob(blob, options?.audio)
}

/** Quiet unlock after a user gesture (needed for autoplay policies). */
export async function primeSpeechSynthesis(): Promise<void> {
  try {
    const ctx = new AudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    await ctx.close()
  } catch {
    /* ignore */
  }
}

export async function previewExaminerVoice(
  sessionId: string,
  speaker: ExaminerVoiceChoice,
): Promise<void> {
  stopExaminerSpeech()
  const sample =
    speaker === 'siya'
      ? 'Hello. I will be your examiner today.'
      : 'Hello. I will be your examiner for this viva.'
  const audio = await unlockPlayback()
  await speakViaRumik(sessionId, sample, speaker, { preview: true, audio })
}

export async function speakExaminer(
  text: string,
  options?: { sessionId?: string; speaker?: ExaminerVoiceChoice },
): Promise<void> {
  const cleaned = prepareSpeechText(text)
  if (!cleaned) return

  const sessionId = options?.sessionId
  const speaker =
    options?.speaker ||
    getExaminerVoiceChoice(sessionId) ||
    null

  if (!sessionId) {
    throw new Error('Missing viva session for examiner speech.')
  }
  if (!speaker) {
    throw new Error('Choose an examiner voice before the viva begins.')
  }

  // Always re-assert the lock so reconnects cannot drift back to the default.
  setExaminerVoiceChoice(speaker, sessionId)

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await speakViaRumik(sessionId, cleaned, speaker)
      return
    } catch (err) {
      lastError = err
      await new Promise((r) => window.setTimeout(r, 400))
    }
  }

  // Do NOT fall back to browser TTS — that changes gender mid-viva.
  throw lastError instanceof Error
    ? lastError
    : new Error('Examiner voice failed. Please try again.')
}
