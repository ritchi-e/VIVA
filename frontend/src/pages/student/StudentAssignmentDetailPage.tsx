import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, FileText, FolderGit2, Presentation, X } from 'lucide-react'
import {
  assignmentsApi,
  assessmentsApi,
  getApiErrorMessage,
  slotsApi,
  submissionsApi,
  vivaApi,
} from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ProgressPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { formatSubmissionProcessingError } from '@/lib/userErrors'
import { PLATFORM_PROGRESS, SUBMISSION_STAGE_COPY } from '@/lib/progressCopy'
import { InstructionsHtml } from '@/components/ui/RichTextInstructions'
import { SubmissionWorkViewer } from '@/components/submissions/SubmissionWorkViewer'
import { formatScore } from '@/lib/utils'
import type { Submission, SubmissionFile } from '@/types'

const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/
const ACTIVE_STATUSES = new Set(['uploaded', 'queued', 'processing'])

function isPdf(file: SubmissionFile) {
  const name = (file.original_filename || '').toLowerCase()
  return file.file_type === 'pdf' || name.endsWith('.pdf') || file.content_type.includes('pdf')
}

function isOfficeDoc(file: SubmissionFile) {
  const name = (file.original_filename || '').toLowerCase()
  return (
    file.file_type === 'docx' ||
    file.file_type === 'pptx' ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx')
  )
}

function fileKind(file: SubmissionFile): 'pdf' | 'doc' | 'ppt' | 'other' {
  const name = (file.original_filename || '').toLowerCase()
  if (isPdf(file)) return 'pdf'
  if (name.endsWith('.ppt') || name.endsWith('.pptx') || file.file_type === 'pptx') return 'ppt'
  if (isOfficeDoc(file)) return 'doc'
  return 'other'
}

function PdfThumb({ submissionId, file }: { submissionId: string; file: SubmissionFile }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    submissionsApi
      .fileContent(submissionId, file.id)
      .then((r) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(r.data)
        setUrl(objectUrl)
      })
      .catch(() => {
        /* tile still works without thumb */
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [submissionId, file.id])

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <FileText className="h-8 w-8 text-slate-400" />
      </div>
    )
  }

  return (
    <iframe
      title={file.original_filename}
      src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
      className="pointer-events-none h-[140%] w-full origin-top scale-[0.72] border-0 bg-white"
      tabIndex={-1}
    />
  )
}

function SubmissionPreviewTiles({
  submission,
  onOpen,
}: {
  submission: Submission
  onOpen: () => void
}) {
  const files = submission.files || []
  const githubUrl = submission.github_url || submission.repository?.github_url

  if (!files.length && !githubUrl) {
    return <p className="text-sm text-[var(--color-muted)]">No file or GitHub URL on this submission.</p>
  }

  return (
    <div className="flex flex-wrap gap-3">
      {githubUrl ? (
        <button
          type="button"
          onClick={onOpen}
          className="group flex w-[160px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white text-left shadow-sm transition hover:border-[var(--color-primary)] hover:shadow-md"
        >
          <div className="flex h-24 items-center justify-center bg-slate-50">
            <FolderGit2 className="h-8 w-8 text-[var(--color-primary)]" />
          </div>
          <div className="space-y-0.5 border-t border-[var(--color-border)] px-2.5 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              GitHub
            </p>
            <p className="truncate text-xs font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)]">
              {githubUrl.replace(/^https:\/\/github\.com\//, '')}
            </p>
          </div>
        </button>
      ) : null}

      {files.map((file) => {
        const kind = fileKind(file)
        return (
          <button
            key={file.id}
            type="button"
            onClick={onOpen}
            className="group flex w-[160px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white text-left shadow-sm transition hover:border-[var(--color-primary)] hover:shadow-md"
          >
            <div className="relative h-24 overflow-hidden bg-slate-50">
              {kind === 'pdf' ? (
                <PdfThumb submissionId={submission.id} file={file} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  {kind === 'ppt' ? (
                    <Presentation className="h-8 w-8 text-orange-500" />
                  ) : (
                    <FileText className="h-8 w-8 text-sky-600" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {kind === 'ppt' ? 'PPT' : kind === 'doc' ? 'DOC' : 'FILE'}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-0.5 border-t border-[var(--color-border)] px-2.5 py-2">
              <p className="truncate text-xs font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)]">
                {file.original_filename || 'Uploaded file'}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SubmissionViewerModal({
  submission,
  onClose,
}: {
  submission: Submission
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const githubOnly =
    (submission.github_url || submission.repository?.github_url) && !(submission.files?.length)
  const githubUrl = submission.github_url || submission.repository?.github_url

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-viewer-title"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <h2 id="submission-viewer-title" className="font-display text-lg font-bold">
            {githubOnly ? 'GitHub submission' : 'Your submission'}
          </h2>
          <div className="flex items-center gap-2">
            {githubOnly && githubUrl ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-sidebar-active)]"
              >
                Open on GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <SubmissionWorkViewer submission={submission} compact />
        </div>
      </div>
    </div>
  )
}

export function StudentAssignmentDetailPage() {
  const { id = '', assignmentId = '', courseId = '' } = useParams()
  const resolvedId = assignmentId || id
  const navigate = useNavigate()
  const assignment = useAsync(() => assignmentsApi.get(resolvedId).then((r) => r.data), [resolvedId])
  const submissions = useAsync(() => submissionsApi.list({ assignment: resolvedId }), [resolvedId])
  const sessions = useAsync(() => vivaApi.list({ assignment: resolvedId }), [resolvedId])
  const bookings = useAsync(() => slotsApi.my(), [resolvedId])
  const [githubUrl, setGithubUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const latestSubmission = submissions.data?.[0]
  const processing = Boolean(latestSubmission && ACTIVE_STATUSES.has(latestSubmission.status))
  const completedSession = (sessions.data || []).find((s) =>
    ['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state),
  )
  const activeBooking = useMemo(
    () =>
      (bookings.data || []).find(
        (b) =>
          b.assignment === resolvedId &&
          (b.status === 'booked' || b.status === 'started'),
      ),
    [bookings.data, resolvedId],
  )

  const results = useAsync(async () => {
    if (!completedSession) return null
    return assessmentsApi.byVivaSession(completedSession.id)
  }, [completedSession?.id])

  const submissionDetail = useAsync(async () => {
    if (!latestSubmission?.id) return null as Submission | null
    return (await submissionsApi.get(latestSubmission.id)).data
  }, [latestSubmission?.id, latestSubmission?.status, latestSubmission?.version])

  const lockedSubmission = Boolean(activeBooking || completedSession)
  const canUpload = !lockedSubmission
  /** Separate upload/status block — hide once results exist (work lives under Results). */
  const showSubmissionSection = !completedSession

  const backTo =
    courseId || assignment.data?.course
      ? `/student/courses/${courseId || assignment.data?.course}`
      : '/student/dashboard'

  useEffect(() => {
    if (!latestSubmission || !processing) return
    const timer = window.setInterval(() => {
      void submissions.reload()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [latestSubmission?.id, latestSubmission?.status, processing, submissions.reload])

  if (assignment.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  if (assignment.error || !assignment.data) {
    return <ErrorState message={assignment.error ?? 'Not found'} onRetry={assignment.reload} />
  }

  const allowGithub = assignment.data.allow_github
  const stageCopy =
    SUBMISSION_STAGE_COPY[latestSubmission?.processing_stage || ''] || PLATFORM_PROGRESS.ingestingRepo
  const assessment = results.data
  const overall = assessment?.overall_score ?? assessment?.ai_overall_score
  const previewSubmission = submissionDetail.data || latestSubmission

  const upload = async () => {
    if (!canUpload) return
    if (!file && !githubUrl) {
      setError('Choose a file (PDF/DOCX/PPTX/ZIP) or provide a GitHub URL.')
      return
    }
    if (githubUrl && !allowGithub) {
      setError('GitHub submissions are not enabled for this assignment.')
      return
    }
    if (githubUrl && !GITHUB_URL_RE.test(githubUrl.trim().replace(/\.git$/, ''))) {
      setError('Use a public https://github.com/{owner}/{repo} URL.')
      return
    }
    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('assignment', resolvedId)
      if (githubUrl) form.append('github_url', githubUrl.trim())
      if (file) form.append('file', file)
      await submissionsApi.create(form)
      setMessage('Submission received. We are preparing viva evidence from your work.')
      setFile(null)
      setGithubUrl('')
      if (fileRef.current) fileRef.current.value = ''
      await submissions.reload()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {viewerOpen && previewSubmission ? (
        <SubmissionViewerModal
          submission={
            submissionDetail.data || {
              ...previewSubmission,
              files: previewSubmission.files || [],
            }
          }
          onClose={() => setViewerOpen(false)}
        />
      ) : null}

      <PageHeader
        title={assignment.data.title}
        description="Read the brief, submit once, then book your viva."
        actions={
          <Link to={backTo} className="mk-link text-sm">
            Back to class
          </Link>
        }
      />

      <section aria-labelledby="instructions-heading">
        <Card>
          <CardBody className="space-y-3 !py-5">
            <h2
              id="instructions-heading"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]"
            >
              Instructions
            </h2>
            <div className="text-sm text-slate-700">
              <InstructionsHtml html={assignment.data.instructions} />
            </div>
          </CardBody>
        </Card>
      </section>

      {showSubmissionSection ? (
        <section aria-labelledby="submission-heading">
          <Card>
            <CardBody className="space-y-4 !py-5">
              <h2
                id="submission-heading"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]"
              >
                Submission
              </h2>

              {canUpload ? (
                <div className="space-y-3">
                  <Input
                    id="submission-file"
                    label="Upload file"
                    type="file"
                    ref={fileRef}
                    accept=".pdf,.docx,.pptx,.zip,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {allowGithub ? (
                    <Input
                      id="github-url"
                      label="GitHub repository (optional)"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                    />
                  ) : (
                    <p className="text-xs text-slate-500">
                      This assignment does not accept GitHub repositories.
                    </p>
                  )}
                  <Button onClick={upload} loading={uploading} variant="secondary">
                    {latestSubmission ? 'Replace submission' : 'Upload submission'}
                  </Button>
                  {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                </div>
              ) : null}

              {latestSubmission ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-700">
                      Submitted · v{latestSubmission.version} ·{' '}
                      <span className="font-semibold capitalize">{latestSubmission.status}</span>
                    </p>
                    {processing ? (
                      <Button variant="ghost" onClick={() => void submissions.reload()}>
                        Refresh status
                      </Button>
                    ) : null}
                  </div>

                  {submissionDetail.loading ? (
                    <p className="text-sm text-[var(--color-muted)]">Loading preview…</p>
                  ) : null}
                  {previewSubmission && (submissionDetail.data || latestSubmission.files?.length || latestSubmission.github_url) ? (
                    <SubmissionPreviewTiles
                      submission={
                        submissionDetail.data || {
                          ...latestSubmission,
                          files: latestSubmission.files || [],
                        }
                      }
                      onOpen={() => setViewerOpen(true)}
                    />
                  ) : null}

                  {latestSubmission.status === 'failed' &&
                  formatSubmissionProcessingError(latestSubmission.processing_error) ? (
                    <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formatSubmissionProcessingError(latestSubmission.processing_error)}
                    </p>
                  ) : null}
                  {processing ? (
                    <div className="rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-2">
                      <p className="font-display text-sm font-semibold text-teal-950">{stageCopy.title}</p>
                      <p className="mt-1 text-sm text-teal-900/70">{stageCopy.detail}</p>
                    </div>
                  ) : null}
                  {activeBooking ? (
                    <p className="text-sm text-[var(--color-muted)]">
                      Viva booked — start it from the class{' '}
                      <Link
                        to={`/student/courses/${courseId || assignment.data.course}/viva`}
                        className="font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        Viva
                      </Link>{' '}
                      tab when your slot opens.
                    </p>
                  ) : null}
                </div>
              ) : !canUpload ? (
                <p className="text-sm text-[var(--color-muted)]">No submission on file.</p>
              ) : null}

              {latestSubmission?.status === 'ready' && !lockedSubmission ? (
                <Button onClick={() => navigate(`/student/assignments/${resolvedId}/book-slot`)}>
                  Book viva slot
                </Button>
              ) : null}
            </CardBody>
          </Card>
        </section>
      ) : null}

      {completedSession ? (
        <section aria-labelledby="results-heading">
          <Card className="overflow-hidden border-[var(--color-primary)]/25 bg-gradient-to-br from-[var(--color-sidebar-active)]/80 to-white">
            <CardBody className="space-y-5 !py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p
                    id="results-heading"
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]"
                  >
                    Results
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-[var(--color-foreground)]">
                    Your viva is complete
                  </p>
                  {!assessment ? (
                    <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                      Score is still being prepared — refresh in a moment.
                    </p>
                  ) : null}
                </div>
                {overall != null ? (
                  <div className="rounded-2xl bg-white px-5 py-3 text-center shadow-sm ring-1 ring-[var(--color-border)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Total score
                    </p>
                    <p className="font-display text-3xl font-bold tabular-nums text-[var(--color-primary)]">
                      {formatScore(overall)}
                    </p>
                  </div>
                ) : null}
              </div>

              {!assessment ? (
                <Button variant="secondary" onClick={() => void results.reload()}>
                  Refresh results
                </Button>
              ) : (
                <>
                  {previewSubmission ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">Submission</p>
                      <SubmissionPreviewTiles
                        submission={
                          submissionDetail.data || {
                            ...previewSubmission,
                            files: previewSubmission.files || [],
                          }
                        }
                        onOpen={() => setViewerOpen(true)}
                      />
                    </div>
                  ) : null}

                  {assessment.strengths?.length ? (
                    <div className="rounded-xl border border-[var(--color-border)] bg-white/90 px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">Strengths</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                        {assessment.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {assessment.weaknesses?.length ? (
                    <div className="rounded-xl border border-[var(--color-border)] bg-white/90 px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">
                        Areas of improvement
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                        {assessment.weaknesses.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
