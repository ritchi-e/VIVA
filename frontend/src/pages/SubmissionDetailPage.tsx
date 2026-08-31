import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assessmentsApi, submissionsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { AssessmentReview } from '@/components/assessment/AssessmentReview'
import { RepositorySummary } from '@/components/submissions/RepositorySummary'
import { AssignmentMismatchBanner } from '@/components/submissions/AssignmentMismatchBanner'
import { SubmissionWorkViewer } from '@/components/submissions/SubmissionWorkViewer'
import type { Assessment } from '@/types'
import { formatSubmissionProcessingError } from '@/lib/userErrors'
import { formatDate } from '@/lib/utils'

export function SubmissionDetailPage() {
  const { id = '' } = useParams()
  const submission = useAsync(() => submissionsApi.get(id).then((r) => r.data), [id])
  const assessmentQuery = useAsync(() => assessmentsApi.bySubmission(id), [id])
  const [assessment, setAssessment] = useState<Assessment | null>(null)

  useEffect(() => {
    if (assessmentQuery.data) setAssessment(assessmentQuery.data)
  }, [assessmentQuery.data])

  if (submission.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.submissions} />
  if (submission.error || !submission.data) {
    return <ErrorState message={submission.error ?? 'Submission not found'} onRetry={submission.reload} />
  }

  const activeAssessment = assessment ?? assessmentQuery.data

  return (
    <div>
      <PageHeader
        title="Submission review"
        description={`${submission.data.assignment_title || 'Submission'} · ${submission.data.student_name || submission.data.student_email || 'Student'} · v${submission.data.version}`}
        actions={
          <Link to={`/assignments/${submission.data.assignment}`} className="text-sm text-blue-700 hover:underline">
            View assignment
          </Link>
        }
      />
      {submission.data.assignment_mismatch ? (
        <div className="mb-6">
          <AssignmentMismatchBanner
            mismatch={submission.data.assignment_mismatch}
            reason={submission.data.assignment_mismatch_reason}
          />
        </div>
      ) : null}
      <Card className="mb-6">
        <CardBody className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <p>
            Student:{' '}
            <Link to={`/students/${submission.data.student}`} className="text-blue-700 hover:underline">
              {submission.data.student_name || submission.data.student_email}
            </Link>
          </p>
          <p>Uploaded: {formatDate(submission.data.created_at)}</p>
          <p>
            Status: <Badge>{submission.data.status}</Badge>
          </p>
          {formatSubmissionProcessingError(submission.data.processing_error) ? (
            <p className="text-red-600 sm:col-span-2">
              {formatSubmissionProcessingError(submission.data.processing_error)}
            </p>
          ) : null}
        </CardBody>
      </Card>
      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Submitted work</h2>
          <SubmissionWorkViewer submission={submission.data} />
        </CardBody>
      </Card>
      {submission.data.repository ? (
        <Card className="mb-6">
          <CardBody>
            <RepositorySummary submission={submission.data} />
          </CardBody>
        </Card>
      ) : null}

      {assessmentQuery.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assessment} /> : null}
      {activeAssessment ? (
        <AssessmentReview assessment={activeAssessment} onUpdated={setAssessment} />
      ) : !assessmentQuery.loading ? (
        <Card>
          <CardBody className="text-sm text-slate-600">
            No AI assessment is available for this submission yet. It will appear after the viva session completes.
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
