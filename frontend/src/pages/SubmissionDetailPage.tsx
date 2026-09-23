import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
import { PlagiarismReportPanel } from '@/components/submissions/PlagiarismReportPanel'
import { SubmissionWorkViewer } from '@/components/submissions/SubmissionWorkViewer'
import { EvidencePanel } from '@/components/evidence/EvidencePanel'
import type { Assessment } from '@/types'
import { formatSubmissionProcessingError } from '@/lib/userErrors'
import { Tabs } from '@/components/ui/Tabs'
import { formatDate } from '@/lib/utils'

export function SubmissionDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as 'assessment' | 'work' | 'evidence' | 'similarity' | null
  const initialTab =
    tabParam && ['assessment', 'work', 'evidence', 'similarity'].includes(tabParam)
      ? tabParam
      : 'assessment'
  const [tab, setTab] = useState<'assessment' | 'work' | 'evidence' | 'similarity'>(initialTab)

  const submission = useAsync(() => submissionsApi.get(id).then((r) => r.data), [id])
  const assessmentQuery = useAsync(() => assessmentsApi.bySubmission(id), [id])
  const [assessment, setAssessment] = useState<Assessment | null>(null)

  useEffect(() => {
    if (assessmentQuery.data) setAssessment(assessmentQuery.data)
  }, [assessmentQuery.data])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  const selectTab = (next: 'assessment' | 'work' | 'evidence' | 'similarity') => {
    setTab(next)
    const nextParams = new URLSearchParams(params)
    if (next === 'assessment') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const studentLabel = useMemo(() => {
    if (!submission.data) return 'Student'
    return submission.data.student_name || submission.data.student_email || 'Student'
  }, [submission.data])

  if (submission.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.submissions} />
  if (submission.error || !submission.data) {
    return <ErrorState message={submission.error ?? 'Submission not found'} onRetry={submission.reload} />
  }

  const s = submission.data
  const activeAssessment = assessment ?? assessmentQuery.data
  const processingError = formatSubmissionProcessingError(s.processing_error)

  return (
    <div className="space-y-4">
      <PageHeader
        title={studentLabel}
        description={`${s.assignment_title || 'Assignment'}${s.version > 1 ? ` · v${s.version}` : ''} · ${formatDate(s.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'info'}>
              {s.status}
            </Badge>
            {activeAssessment ? (
              <Badge tone={activeAssessment.status === 'finalized' ? 'success' : 'warning'}>
                {activeAssessment.status.replace(/_/g, ' ')}
              </Badge>
            ) : null}
            <Link to={`/assignments/${s.assignment}`} className="mk-link text-sm">
              Assignment
            </Link>
          </div>
        }
      />

      {s.assignment_mismatch ? (
        <AssignmentMismatchBanner
          mismatch={s.assignment_mismatch}
          reason={s.assignment_mismatch_reason}
        />
      ) : null}

      {processingError ? (
        <Card>
          <CardBody className="text-sm text-[var(--color-danger)]">{processingError}</CardBody>
        </Card>
      ) : null}

      <Tabs
        items={[
          { id: 'assessment', label: 'Assessment' },
          { id: 'work', label: 'Submitted work' },
          { id: 'evidence', label: 'Evidence' },
          { id: 'similarity', label: 'Similarity' },
        ]}
        value={tab}
        onChange={selectTab}
      />

      {tab === 'assessment' ? (
        assessmentQuery.loading ? (
          <ProgressPanel copy={PLATFORM_PROGRESS.assessment} />
        ) : activeAssessment ? (
          <AssessmentReview assessment={activeAssessment} onUpdated={setAssessment} compact />
        ) : (
          <Card>
            <CardBody className="text-sm text-[var(--color-muted)]">
              No AI assessment yet. It appears after the viva completes. Check{' '}
              <button type="button" className="mk-link" onClick={() => selectTab('work')}>
                submitted work
              </button>{' '}
              while you wait.
            </CardBody>
          </Card>
        )
      ) : null}

      {tab === 'work' ? (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <SubmissionWorkViewer submission={s} compact />
            </CardBody>
          </Card>
          {s.repository ? (
            <Card>
              <CardBody>
                <RepositorySummary submission={s} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === 'evidence' ? <EvidencePanel submissionId={id} /> : null}

      {tab === 'similarity' ? (
        s.plagiarism_report ? (
          <PlagiarismReportPanel report={s.plagiarism_report} />
        ) : (
          <Card>
            <CardBody className="text-sm text-[var(--color-muted)]">
              No similarity report yet. It is generated after the student completes their viva.
            </CardBody>
          </Card>
        )
      ) : null}
    </div>
  )
}
