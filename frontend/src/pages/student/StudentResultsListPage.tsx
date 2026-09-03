import { Link } from 'react-router-dom'
import { assessmentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatScore } from '@/lib/utils'

export function StudentResultsListPage() {
  const { data, loading, error, reload } = useAsync(() => assessmentsApi.list())

  return (
    <div>
      <PageHeader title="Results" description="Scores and submitted work from your completed vivas." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.results} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No results yet"
          description="Your scores appear here after you complete a booked viva."
        />
      ) : null}
      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  to={`/student/results/${a.viva_session}`}
                  className="font-medium text-slate-900 hover:text-blue-700"
                >
                  {a.assignment_title || 'Viva results'}
                </Link>
                <p className="mt-1 text-sm text-slate-500">{a.status.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatScore(a.overall_score ?? a.ai_overall_score)}
                </span>
                <Badge tone={a.status === 'finalized' ? 'success' : 'info'}>
                  {a.status === 'finalized' ? 'Final' : 'Draft'}
                </Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
