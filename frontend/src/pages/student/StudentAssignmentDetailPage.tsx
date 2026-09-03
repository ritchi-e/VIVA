import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { assignmentsApi, submissionsApi, vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ProgressPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { getApiErrorMessage } from '@/lib/api'
import { formatSubmissionProcessingError } from '@/lib/userErrors'
import { PLATFORM_PROGRESS, SUBMISSION_STAGE_COPY } from '@/lib/progressCopy'

const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/
const ACTIVE_STATUSES = new Set(['uploaded', 'queued', 'processing'])

export function StudentAssignmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const assignment = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const submissions = useAsync(() => submissionsApi.list({ assignment: id }), [id])
  const sessions = useAsync(() => vivaApi.list({ assignment: id }), [id])
  const [githubUrl, setGithubUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const latestSubmission = submissions.data?.[0]
  const processing = Boolean(latestSubmission && ACTIVE_STATUSES.has(latestSubmission.status))

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

  const upload = async () => {
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
      form.append('assignment', id)
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
    <div>
      <PageHeader title={assignment.data.title} description="Submit work, then book a viva slot when processing is complete." />
      <Card className="mb-6">
        <CardBody className="space-y-2 text-sm text-slate-700">
          <p>{assignment.data.description}</p>
          <p className="whitespace-pre-wrap">{assignment.data.instructions}</p>
        </CardBody>
      </Card>
      <Card className="mb-6">
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-slate-900">Submit work</p>
          <Input
            type="file"
            ref={fileRef}
            accept=".pdf,.docx,.pptx,.zip,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {allowGithub ? (
            <Input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
            />
          ) : (
            <p className="text-xs text-slate-500">This assignment does not accept GitHub repositories.</p>
          )}
          <Button onClick={upload} loading={uploading} variant="secondary">
            Upload submission
          </Button>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        </CardBody>
      </Card>
      {latestSubmission ? (
        <Card className="mb-6">
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                Latest submission v{latestSubmission.version} — {latestSubmission.status}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => submissions.reload()}>
                  Refresh status
                </Button>
                <Link to={`/student/submissions/${latestSubmission.id}`}>
                  <Button variant="secondary">View submission</Button>
                </Link>
              </div>
            </div>
            {latestSubmission.status === 'failed' && formatSubmissionProcessingError(latestSubmission.processing_error) ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formatSubmissionProcessingError(latestSubmission.processing_error)}
              </p>
            ) : null}
            {processing ? (
              <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3">
                <p className="font-display text-sm font-semibold text-teal-950">{stageCopy.title}</p>
                <p className="mt-1 text-sm text-teal-900/70">{stageCopy.detail}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
      {(sessions.data?.length ?? 0) > 0 ? (
        <Card className="mb-6">
          <CardBody>
            <p className="mb-3 text-sm font-medium text-slate-900">Your viva sessions</p>
            <ul className="space-y-2 text-sm">
              {sessions.data?.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {s.state} · {s.questions_asked}/{s.question_budget}
                  </span>
                  <div className="flex gap-3">
                    {s.state === 'IN_PROGRESS' ? (
                      <Link to={`/student/viva/${s.id}`} className="text-teal-800 hover:underline">
                        Rejoin
                      </Link>
                    ) : null}
                    {['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state) ? (
                      <Link to={`/student/results/${s.id}`} className="text-teal-800 hover:underline">
                        View analysis
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {latestSubmission?.status === 'ready' ? (
        <Button onClick={() => navigate(`/student/assignments/${id}/book-slot`)}>Book viva slot</Button>
      ) : null}
    </div>
  )
}
