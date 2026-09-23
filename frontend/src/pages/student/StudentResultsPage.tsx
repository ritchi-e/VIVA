import { Link, useParams } from 'react-router-dom'
import { assessmentsApi, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatScore } from '@/lib/utils'
import type { Assessment, Submission } from '@/types'

export function StudentResultsPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    let assessment: Assessment | null = await assessmentsApi.byVivaSession(id)
    if (!assessment) {
      try {
        assessment = (await assessmentsApi.get(id)).data
      } catch {
        assessment = null
      }
    }
    if (!assessment) return { assessment: null, submission: null as Submission | null }
    const submission = (await submissionsApi.get(assessment.submission)).data
    return { assessment, submission }
  }, [id])

  if (loading) return <ProgressPanel copy={PLATFORM_PROGRESS.results} />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const backToAssignment = data?.submission?.assignment
    ? `/student/assignments/${data.submission.assignment}`
    : '/student/dashboard'

  if (!data?.assessment) {
    return (
      <div>
        <PageHeader title="Viva results" description="Your score is still being prepared." />
        <Card>
          <CardBody className="space-y-3 text-sm text-slate-700">
            <p>Your viva is complete, but the score is not ready yet. This usually finishes within a minute.</p>
            <Button variant="secondary" onClick={reload}>
              Refresh
            </Button>
            <Link to={backToAssignment} className="mk-link inline-block">
              Back to assignment
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  const { assessment, submission } = data
  const overall = assessment.overall_score ?? assessment.ai_overall_score
  const githubUrl = submission?.github_url || submission?.repository?.github_url
  const files = submission?.files ?? []

  return (
    <div>
      <PageHeader
        title="Viva results"
        description={assessment.assignment_title || 'Your score and submitted work'}
        actions={
          <Link to={backToAssignment} className="mk-link text-sm">
            Back to assignment
          </Link>
        }
      />

      <Card className="mb-6">
        <CardBody>
          <p className="text-sm text-slate-500">Total score</p>
          <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-slate-900">
            {formatScore(overall)}
          </p>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-slate-900">Submitted work</p>
          {!githubUrl && files.length === 0 ? (
            <p className="text-sm text-slate-600">No file or GitHub URL is attached to this submission.</p>
          ) : null}
          {githubUrl ? (
            <p className="text-sm">
              GitHub:{' '}
              <a href={githubUrl} className="mk-link break-all" target="_blank" rel="noreferrer">
                {githubUrl}
              </a>
            </p>
          ) : null}
          {files.map((file) => (
            <p key={file.id} className="text-sm text-slate-700">
              {file.original_filename || 'Uploaded file'}
            </p>
          ))}
        </CardBody>
      </Card>

      {assessment.weaknesses?.length ? (
        <Card className="mt-6">
          <CardBody>
            <p className="text-sm font-medium text-slate-900">Areas of improvement</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {assessment.weaknesses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
