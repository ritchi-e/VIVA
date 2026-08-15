/** Deepgram Nova-3 STT via server /transcribe (project keyterms applied server-side). */

import { api } from '@/lib/api'

export function micCaptureSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

function pickRecorderMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export async function transcribeSessionAudio(sessionId: string, blob: Blob): Promise<string> {
  const form = new FormData()
  const type = (blob.type || 'audio/webm').split(';')[0]
  const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'
  form.append('audio', blob, `answer.${ext}`)

  const { data } = await api.post<{ text?: string }>(
    `/viva/sessions/${sessionId}/transcribe/`,
    form,
    {
      // Let the browser set multipart boundary (override default JSON content-type).
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
      transformRequest: [
        (body, headers) => {
          if (body instanceof FormData && headers) {
            delete (headers as Record<string, unknown>)['Content-Type']
          }
          return body
        },
      ],
    },
  )
  return (data.text || '').trim()
}

export type VoiceSession = {
  stop: () => Promise<Blob | null>
  destroy: () => void
  /** Milliseconds since the last frame that was classified as speech. */
  silenceMs: () => number
  /** True once any speech has been detected in this take. */
  hasSpeech: () => boolean
}

const SAMPLE_MS = 50
/** Ambient level is measured before any speech can be credited. */
const CALIBRATION_MS = 400
/** Ambient estimate bounds; keeps a noisy room from disabling detection. */
const FLOOR_MIN = 0.004
const FLOOR_MAX = 0.04
/** How long the trailing edge of a word may hold the answer open. */
const HANGOVER_MS = 400

/**
 * Record microphone audio until stop().
 *
 * Voice activity uses time-domain RMS against a calibrated ambient floor with
 * hysteresis. A fixed spectral threshold does not survive autoGainControl,
 * which lifts room noise until every frame reads as speech and the answer only
 * ends on the hard timeout.
 */
export async function startVoiceSession(
  onActivity: (active: boolean, level: number) => void,
): Promise<VoiceSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  const audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => undefined)
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0
  source.connect(analyser)

  const mimeType = pickRecorderMimeType()
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const samples = new Uint8Array(analyser.fftSize)
  const startedAt = Date.now()

  let noiseFloor = 0.01
  let calibrationMin = Number.POSITIVE_INFINITY
  let calibrated = false
  let speaking = false
  let sawSpeech = false
  let lastVoiceAt = startedAt
  let lastLoudAt = 0

  const readRms = () => {
    analyser.getByteTimeDomainData(samples)
    let sumSquares = 0
    for (let i = 0; i < samples.length; i++) {
      const v = (samples[i] - 128) / 128
      sumSquares += v * v
    }
    return Math.sqrt(sumSquares / samples.length)
  }

  const tick = () => {
    const rms = readRms()
    const now = Date.now()

    if (!calibrated) {
      calibrationMin = Math.min(calibrationMin, rms)
      if (now - startedAt < CALIBRATION_MS) return
      noiseFloor = Math.min(Math.max(calibrationMin, FLOOR_MIN), FLOOR_MAX)
      calibrated = true
      lastVoiceAt = now
      return
    }

    const speechOn = Math.max(noiseFloor * 3, 0.02)
    const speechOff = Math.max(noiseFloor * 1.8, 0.012)

    if (rms >= speechOn) {
      speaking = true
      sawSpeech = true
      lastLoudAt = now
      lastVoiceAt = now
    } else if (speaking && rms >= speechOff && now - lastLoudAt <= HANGOVER_MS) {
      // Trailing edge of a word: hold the answer open through short dips.
      lastVoiceAt = now
    } else {
      speaking = false
      noiseFloor = Math.min(Math.max(noiseFloor * 0.9 + rms * 0.1, FLOOR_MIN), FLOOR_MAX)
    }

    onActivity(speaking, rms)
  }

  // An interval keeps sampling when the tab is throttled; rAF stops entirely.
  const meter = window.setInterval(tick, SAMPLE_MS)

  recorder.start(250)

  let stopPromise: Promise<Blob | null> | null = null

  const destroy = () => {
    window.clearInterval(meter)
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop())
    void audioCtx.close().catch(() => undefined)
  }

  const stop = () => {
    if (stopPromise) return stopPromise
    stopPromise = new Promise((resolve) => {
      const finish = () => {
        window.clearInterval(meter)
        stream.getTracks().forEach((t) => t.stop())
        void audioCtx.close().catch(() => undefined)
        const type = recorder.mimeType || mimeType || 'audio/webm'
        if (!chunks.length) {
          resolve(null)
          return
        }
        resolve(new Blob(chunks, { type }))
      }
      if (recorder.state === 'inactive') {
        finish()
        return
      }
      recorder.onstop = finish
      try {
        recorder.stop()
      } catch {
        finish()
      }
    })
    return stopPromise
  }

  return {
    stop,
    destroy,
    silenceMs: () => Date.now() - lastVoiceAt,
    hasSpeech: () => sawSpeech,
  }
}
