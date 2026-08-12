import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { assignmentsApi, submissionsApi, vivaApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { getApiErrorMessage } from '@/lib/api'

export function StudentAssignmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const assignment = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const submissions = useAsync(() => submissionsApi.list({ assignment: id }), [id])
  const sessions = useAsync(() => vivaApi.list({ assignment: id }), [id])
  const [githubUrl, setGithubUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (assignment.loading) return <LoadingPanel />
  if (assignment.error || !assignment.data) {
    return <ErrorState message={assignment.error ?? 'Not found'} onRetry={assignment.reload} />
  }

  const latestSubmission = submissions.data?.[0]

  const upload = async () => {
    if (!file && !githubUrl) {
      setError('Choose a file (PDF/DOCX/PPTX/ZIP) or provide a GitHub URL.')
      return
    }
    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('assignment', id)
      if (githubUrl) form.append('github_url', githubUrl)
      if (file) form.append('file', file)
      await submissionsApi.create(form)
      setMessage('Submission uploaded and queued for processing.')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await submissions.reload()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const startViva = async () => {
    if (!latestSubmission) {
      setError('Upload a submission before starting the viva.')
      return
    }
    if (latestSubmission.status !== 'ready') {
      setError(`Submission status is "${latestSubmission.status}". Wait until processing is ready.`)
      await submissions.reload()
      return
    }
    setStarting(true)
    setError(null)
    setMessage('Preparing viva questions with AI. This can take up to a minute…')
    try {
      const response = await vivaApi.start({
        assignment: id,
        submission: latestSubmission.id,
        mode: 'text',
      })
      const sessionId = response.data?.id ? String(response.data.id) : ''
      if (!sessionId || sessionId === 'undefined') {
        setError('Viva session was created but no session id was returned. Restart backend and try again.')
        return
      }
      if (response.data.state === 'FAILED') {
        setError(response.data.error_message || 'Viva preparation failed.')
        return
      }
      navigate(`/student/viva/${sessionId}`)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setStarting(false)
      setMessage(null)
    }
  }

  return (
    <div>
      <PageHeader title={assignment.data.title} description="Submit work and start your viva when ready." />
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
          <Input
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/org/repo (optional)"
          />
          <Button onClick={upload} loading={uploading} variant="secondary">
            Upload submission
          </Button>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        </CardBody>
      </Card>
      {latestSubmission ? (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
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
                    <Link to={`/student/viva/${s.id}`} className="text-blue-700 hover:underline">
                      Open
                    </Link>
                    {['COMPLETED', 'REVIEW_REQUIRED'].includes(s.state) ? (
                      <Link to={`/student/results/${s.id}`} className="text-blue-700 hover:underline">
                        Results
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
      <Button onClick={startViva} loading={starting} disabled={!latestSubmission}>
        {starting ? 'Preparing viva…' : 'Start viva session'}
      </Button>
    </div>
  )
}
