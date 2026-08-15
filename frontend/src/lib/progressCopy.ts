/** Meaningful, professional status copy for AI / viva wait states. */

export type ProgressTone = 'neutral' | 'active' | 'success' | 'warn' | 'danger'

export type ProgressCopy = {
  title: string
  detail?: string
  rotating?: string[]
}

export const PLATFORM_PROGRESS = {
  session: {
    title: 'Confirming your session',
    detail: 'Making sure you are signed in securely.',
  },
  dashboard: {
    title: 'Opening your workspace',
    detail: 'Pulling courses, assignments, and recent activity.',
  },
  courses: {
    title: 'Loading courses',
    detail: 'Fetching the courses available in this organization.',
  },
  assignments: {
    title: 'Loading assignments',
    detail: 'Gathering briefs, deadlines, and submission status.',
  },
  submissions: {
    title: 'Loading submissions',
    detail: 'Reviewing uploaded work and processing status.',
  },
  vivaList: {
    title: 'Loading viva sessions',
    detail: 'Collecting oral assessment activity for this organization.',
  },
  students: {
    title: 'Loading students',
    detail: 'Assembling the roster for this organization.',
  },
  assessment: {
    title: 'Preparing assessment review',
    detail: 'Gathering evidence, scores, and examiner notes.',
  },
  results: {
    title: 'Preparing your results',
    detail: 'Compiling feedback from your completed viva.',
  },
  questions: {
    title: 'Loading viva questions',
    detail: 'Retrieving the questions asked in this session.',
  },
  signingIn: {
    title: 'Signing you in',
    detail: 'Verifying your credentials…',
  },
  preparingViva: {
    title: 'Preparing your viva',
    detail: 'Reviewing your submission and shaping grounded questions. This usually takes under a minute.',
  },
  finishingViva: {
    title: 'Closing your viva',
    detail: 'Saving your answers and submitting them for review.',
  },
  ingestingRepo: {
    title: 'Reading your repository',
    detail: 'Indexing source files and preparing grounded viva evidence. This does not run your code.',
  },
} as const satisfies Record<string, ProgressCopy>

export const SUBMISSION_STAGE_COPY: Record<string, ProgressCopy> = {
  queued: {
    title: 'Queued for review',
    detail: 'Your submission is next in line.',
  },
  fetching_repository: {
    title: 'Fetching the repository',
    detail: 'Downloading a public snapshot and pinning the commit.',
  },
  indexing_files: {
    title: 'Indexing project files',
    detail: 'Selecting source, docs, and configuration while skipping vendor and binary files.',
  },
  analyzing_structure: {
    title: 'Mapping the project',
    detail: 'Identifying functions, classes, and how files relate.',
  },
  embedding_evidence: {
    title: 'Preparing viva evidence',
    detail: 'Turning your implementation into searchable excerpts for the examiner.',
  },
  building_question_context: {
    title: 'Shaping question context',
    detail: 'Building a project summary the viva can cite.',
  },
  complete: {
    title: 'Submission ready',
    detail: 'Your work is ready for a viva grounded in the submitted implementation.',
  },
  failed: {
    title: 'Processing did not finish',
    detail: 'Check the error details and try submitting again.',
  },
}

export const VIVA_PHASE_COPY: Record<
  string,
  { title: string; detail: string; rotating?: string[] }
> = {
  connecting: {
    title: 'Opening a secure room',
    detail: 'Connecting you to the examiner session.',
  },
  preparing: {
    title: 'Settling into the viva',
    detail: 'Your examiner is reviewing your submission.',
  },
  speaking: {
    title: 'Your examiner is speaking',
    detail: 'Listen carefully — the question is based on your own work.',
  },
  listening: {
    title: 'We are listening',
    detail: 'Speak clearly. A short pause will end your answer.',
  },
  processing: {
    title: 'Considering your answer',
    detail: 'One moment.',
  },
  complete: {
    title: 'Viva complete',
    detail: 'Your answers are saved. An assessment draft will be prepared for your instructor.',
  },
  terminated: {
    title: 'Session ended',
    detail: 'This viva was stopped because the exam window was left. Your instructor has been notified.',
  },
  error: {
    title: 'Something interrupted the viva',
    detail: 'You can retry, or finish and submit what you have completed so far.',
  },
}

export function progressLabel(key: keyof typeof PLATFORM_PROGRESS, fallbackTitle?: string): string {
  return PLATFORM_PROGRESS[key]?.title ?? fallbackTitle ?? 'Working…'
}
