/** Live-monitoring helpers for student vivas (camera stream + JPEG snapshots). */

import { api } from '@/lib/api'

export const INTEGRITY_GRACE_MS = 5000
export const PROCTOR_FRAME_INTERVAL_MS = 20_000

export async function reportIntegrityEvent(
  sessionId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
) {
  return api.post(`/viva/sessions/${sessionId}/integrity/`, {
    event_type: eventType,
    client_ts: new Date().toISOString(),
    metadata: metadata ?? {},
  })
}

export async function uploadProctorFrame(sessionId: string, blob: Blob) {
  const form = new FormData()
  form.append('frame', blob, 'monitor.jpg')
  await api.post(`/viva/sessions/${sessionId}/proctor-frames/`, form, {
    timeout: 30_000,
    transformRequest: [
      (body, headers) => {
        if (body instanceof FormData && headers) {
          delete (headers as Record<string, unknown>)['Content-Type']
        }
        return body
      },
    ],
  })
}

export type CameraMonitor = {
  stream: MediaStream
  video: HTMLVideoElement
  captureJpeg: () => Promise<Blob | null>
  stop: () => void
}

export async function startCameraMonitor(): Promise<CameraMonitor> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.srcObject = stream
  await video.play().catch(() => undefined)
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve()
      window.setTimeout(() => resolve(), 1500)
    })
  }

  const captureJpeg = async () => {
    if (video.videoWidth < 8 || video.videoHeight < 8) return null
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(640, video.videoWidth)
    canvas.height = Math.min(480, video.videoHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.55)
    })
  }

  const stop = () => {
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }

  return { stream, video, captureJpeg, stop }
}
