import axios from 'axios'

type ErrorCategory = 'api' | 'submission' | 'viva' | 'repository'

/** Log the raw technical message for developers; never show this to users. */
export function logTechnicalError(context: string, raw: unknown): void {
  if (raw == null || raw === '') return
  console.error(`[${context}]`, raw)
}

/** Exact backend → user-facing message (case-sensitive match). */
const EXACT: Record<string, string> = {
  // GitHub URL validation
  'Provide a public GitHub repository URL.': 'Enter a public GitHub repository URL.',
  'GitHub URL contains invalid whitespace.': 'Remove spaces from the GitHub URL.',
  'Use an https://github.com/{owner}/{repo} URL.': 'Use a link like https://github.com/owner/repo',
  'GitHub URLs must use https.': 'GitHub links must start with https://',
  'Only public github.com repositories are supported.': 'Only public GitHub repositories are supported.',
  'Repository URLs must not include credentials.': 'Remove your username or password from the GitHub URL.',
  'Remove query parameters and fragments from the GitHub URL.':
    'Use the plain repository link without extra ? or # parts.',
  'GitHub URLs must use the default HTTPS port.': 'Use a standard https://github.com/... link.',
  'URL must be https://github.com/{owner}/{repo}.': 'Use a link like https://github.com/owner/repo',
  'That GitHub path is not a repository.': 'That link does not point to a GitHub repository.',
  'Repository owner or name is invalid.': 'The repository name in the URL looks invalid.',
  'Unsupported GitHub URL path. Use the repository root or a /tree/{ref} link.':
    'Use the main repository link, not a subfolder or file page.',

  // GitHub fetch
  'Repository was not found or is not public.':
    'Repository not found. Make sure it is public and the URL is correct.',
  'GitHub rate-limited the request. Try again shortly.':
    'GitHub is busy right now. Please wait a minute and try again.',
  'Private repositories are not supported yet.': 'Only public GitHub repositories are supported.',
  'Could not resolve the repository commit. Check the branch or tag.':
    'We could not find the latest code for that repository. Check the URL and try again.',
  'GitHub did not return a valid commit SHA.':
    'We could not read the latest code from that repository. Please try again.',
  'Repository archive was not found.': 'We could not download a snapshot of that repository.',
  'Downloaded repository archive was empty.':
    'The repository download was empty. Check that the repo has files and try again.',
  'Refusing to follow a redirect off GitHub.':
    'We could not safely download that repository. Check the URL and try again.',

  // Submission validation & pipeline
  'Provide a file upload and/or a GitHub URL.': 'Upload a file or paste a GitHub repository link.',
  'Submission must include at least one file or a GitHub URL':
    'Upload a file or paste a GitHub repository link.',
  'PDF uploads not allowed for this assignment': 'This assignment does not accept PDF files.',
  'DOCX uploads not allowed for this assignment': 'This assignment does not accept Word documents.',
  'PPTX uploads not allowed for this assignment': 'This assignment does not accept PowerPoint files.',
  'ZIP uploads not allowed for this assignment': 'This assignment does not accept ZIP files.',
  'GitHub submissions not allowed for this assignment':
    'This assignment does not accept GitHub repositories.',
  'Assignment not found in this organization.': 'This assignment could not be found.',
  'A submission with this version already exists. Refresh and try again.':
    'You already submitted this version. Refresh the page and try again.',
  'File upload to storage failed. Check MinIO is running and try again.':
    'We could not save your file. Please try uploading again.',
  'Could not fetch the repository. Check the URL and try again.':
    'We could not fetch your GitHub repository. Check the URL and try again.',

  // Viva
  'Timed out while preparing viva questions':
    'Preparing your viva took too long. Please try again.',
  'Submission is not ready for viva':
    'Your submission is still being processed. Wait until it is ready, then try again.',
  'No question plan':
    'We could not prepare viva questions for this submission. Please contact your instructor.',
  'Your booked slot has expired. Please book a new slot.':
    'Your booked time slot has passed. Book a new slot to take the viva.',
  'Viva stopped: camera access is required for live monitoring.':
    'The viva ended because the camera was not available.',
  'Viva stopped: student left the exam window for more than 5 seconds.':
    'The viva ended because the exam window was left for too long.',
  'Could not load the first viva question. Please retry.':
    'We could not load the first question. Please go back and start the viva again.',

  // Slot booking
  'Slot is in the past or too soon to book.': 'That time slot is no longer available. Choose a later slot.',
  'This slot is full. Please choose another.': 'That slot is full. Please pick another time.',
  'You already have an active booking for this assignment.':
    'You already have a viva slot booked for this assignment.',
  'You need a processed submission before booking a viva slot.':
    'Wait until your submission finishes processing, then book a slot.',
  'Only booked slots can be cancelled.': 'This slot can no longer be cancelled.',
  'Cannot cancel a slot that has already started.': 'This slot has already started and cannot be cancelled.',
  'Booking not found.': 'That booking could not be found.',

  // Auth
  'Email already registered': 'An account with this email already exists.',
  'No active account found with the given credentials': 'Incorrect email or password.',
}

const PATTERN_RULES: { test: RegExp; message: string }[] = [
  {
    test: /Repository archive exceeds the \d+ byte limit/i,
    message:
      'This GitHub repository is too large to process (maximum 40 MB). Try a smaller repo or upload a ZIP instead.',
  },
  {
    test: /Repository archive is not a valid zip snapshot/i,
    message: 'We could not read the repository download. Please try again.',
  },
  {
    test: /Each file must be under \d+ bytes/i,
    message: 'One of your files is too large. Each file must be under 25 MB.',
  },
  {
    test: /GitHub could not be reached \(\d+\)/i,
    message: 'We could not reach GitHub. Please try again in a few minutes.',
  },
  {
    test: /Could not download the repository snapshot \(\d+\)/i,
    message: 'We could not download your repository from GitHub. Please try again.',
  },
  {
    test: /NUL \(0x00\)|cannot contain NUL/i,
    message:
      'This file could not be processed because it contains unreadable data. Try a different PDF export or a cleaner GitHub repo.',
  },
  {
    test: /Invalid object|PdfReadError|EOF marker|Stream has ended/i,
    message: 'This PDF looks damaged or unsupported. Export it again as a standard PDF and resubmit.',
  },
  {
    test: /No readable text was found in this PDF/i,
    message: 'No readable text was found in this PDF. If it is a scan, export a text PDF and try again.',
  },
  {
    test: /password-protected/i,
    message: 'This PDF is password-protected and cannot be processed.',
  },
  {
    test: /does not look like a valid PDF/i,
    message: 'That file does not look like a valid PDF. Please upload a PDF and try again.',
  },
  {
    test: /NoSuchKey|InvalidObjectName|InvalidObjectState/i,
    message: 'We could not load the uploaded file from storage. Please try submitting again.',
  },
  {
    test: /could not load the uploaded file/i,
    message: 'We could not load the uploaded file. Please try submitting again.',
  },
  {
    test: /Object storage upload failed/i,
    message: 'We could not save your file. Please try uploading again.',
  },
  {
    test: /slot_start must be aligned/i,
    message: 'That time slot is invalid. Refresh the page and choose again.',
  },
  {
    test: /Cannot start viva in state/i,
    message: 'The viva is not ready to start yet. Refresh the page and try again.',
  },
  {
    test: /Cannot finish viva in state/i,
    message: 'The viva could not be finished in its current state. Refresh and try again.',
  },
  {
    test: /Viva stopped for integrity: grace_expired/i,
    message: 'The viva ended because the exam window was left for too long.',
  },
  {
    test: /Viva stopped for integrity: camera_denied/i,
    message: 'The viva ended because the camera was not available.',
  },
  {
    test: /Viva stopped for integrity: tab_hidden/i,
    message: 'The viva ended because you switched away from the exam window.',
  },
  {
    test: /Viva stopped for integrity: fullscreen_left/i,
    message: 'The viva ended because full-screen mode was exited.',
  },
  {
    test: /Viva stopped for integrity:/i,
    message: 'The viva ended because of an exam integrity rule.',
  },
  {
    test: /No JSON object found|Model returned empty|structured output/i,
    message: 'We had trouble preparing your viva questions. Please try again.',
  },
  {
    test: /insufficient_balance|prepaid balance|Rumik TTS failed \(402\)/i,
    message: 'Examiner voice is temporarily unavailable. You can continue the viva in text, or try preview again later.',
  },
  {
    test: /Examiner voice is temporarily unavailable/i,
    message: 'Examiner voice is temporarily unavailable. You can continue the viva in text, or try preview again later.',
  },
  {
    test: /\[object Blob\]/i,
    message: 'Voice playback failed. You can continue the viva without preview.',
  },
  {
    test: /Deepgram|Rumik TTS|transcription failed|STT/i,
    message: 'Voice features are temporarily unavailable. Try again or use text mode.',
  },
  {
    test: /audio file is too large/i,
    message: 'Your recording was too long. Try a shorter answer.',
  },
  {
    test: /Too many snapshots|Snapshot limit/i,
    message: 'Too many camera snapshots were sent. The viva will continue normally.',
  },
  {
    test: /DEEPGRAM_API_KEY|RUMIK_API_KEY|not configured/i,
    message: 'Voice features are not set up on this server. Use text mode or contact support.',
  },
]

const TECHNICAL_HINT =
  /traceback|exception|error:\s*\w+|ECONNREFUSED|ENOTFOUND|axios|minio|socket hang up|internal server error|502 bad gateway|503 service|504 gateway|undefined is not|cannot read propert|network error|timeout of \d+ms|fetch failed|<!doctype html/i

const DEFAULT_BY_CATEGORY: Record<ErrorCategory, string> = {
  api: 'Something went wrong. Please try again.',
  submission: 'We could not process your submission. Please try again or contact your instructor.',
  viva: 'Something went wrong with your viva. Please try again.',
  repository: 'We could not load the GitHub repository. Check the URL and try again.',
}

function normalizeRaw(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    return ''
  }
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeRaw(item)).filter(Boolean).join(' ')
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail.trim()
    if (Array.isArray(obj.detail)) return normalizeRaw(obj.detail)
    if (typeof obj.error === 'string') return obj.error.trim()
    if (typeof obj.message === 'string') return obj.message.trim()
    if (Array.isArray(obj.non_field_errors)) return normalizeRaw(obj.non_field_errors)
    const fieldMessages = Object.entries(obj)
      .filter(([key]) => !['detail', 'message', 'non_field_errors', 'error', 'code'].includes(key))
      .flatMap(([, value]) => {
        const text = normalizeRaw(value)
        return text ? [text] : []
      })
    if (fieldMessages.length) return fieldMessages.join(' ')
  }
  const asString = String(raw).trim()
  if (asString === '[object Blob]') return ''
  return asString
}

function looksTechnical(message: string): boolean {
  if (!message) return false
  if (TECHNICAL_HINT.test(message)) return true
  if (/^\w+(Error|Exception):/.test(message)) return true
  if (message.length > 280) return true
  if (/\(\d{3}\)/.test(message) && !EXACT[message]) return true
  return false
}

export function toUserMessage(
  raw: unknown,
  category: ErrorCategory = 'api',
  context?: string,
): string {
  const text = normalizeRaw(raw)
  if (!text) return DEFAULT_BY_CATEGORY[category]

  if (EXACT[text]) {
    return EXACT[text]
  }

  for (const rule of PATTERN_RULES) {
    if (rule.test.test(text)) {
      if (context && text !== rule.message) logTechnicalError(context, text)
      return rule.message
    }
  }

  if (looksTechnical(text)) {
    if (context) logTechnicalError(context, text)
    return DEFAULT_BY_CATEGORY[category]
  }

  // Already plain language from the backend — safe to show.
  return text
}

export function formatSubmissionProcessingError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return toUserMessage(raw, 'submission', 'submission.processing')
}

export function formatVivaErrorMessage(raw: string | null | undefined): string {
  if (!raw?.trim()) return DEFAULT_BY_CATEGORY.viva
  return toUserMessage(raw, 'viva', 'viva.error')
}

export function formatRepositoryError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return toUserMessage(raw, 'repository', 'repository.error')
}

function statusFallback(status: number | undefined): string | null {
  if (!status) return null
  if (status === 401) return 'Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested item was not found.'
  if (status === 409) return 'This action conflicts with the current state. Refresh and try again.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'The server is temporarily unavailable. Please try again.'
  return null
}

export function getApiErrorMessage(error: unknown, context = 'api'): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const raw = normalizeRaw(error.response?.data) || error.message
    const mapped = toUserMessage(raw, 'api', context)
    if (mapped !== DEFAULT_BY_CATEGORY.api) return mapped
    const fallback = statusFallback(status)
    if (fallback) {
      if (raw && raw !== fallback) logTechnicalError(context, raw)
      return fallback
    }
    if (raw && raw !== DEFAULT_BY_CATEGORY.api) {
      return toUserMessage(raw, 'api', context)
    }
    logTechnicalError(context, { status, raw: error.response?.data ?? error.message })
    return DEFAULT_BY_CATEGORY.api
  }

  if (error instanceof Error) {
    const mapped = toUserMessage(error.message, 'api', context)
    return mapped
  }

  return DEFAULT_BY_CATEGORY.api
}
