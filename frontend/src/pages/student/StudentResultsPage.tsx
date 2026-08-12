import { Link, useParams } from 'react-router-dom'
import { assessmentsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'
import { formatScore } from '@/lib/utils'

export function StudentResultsPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    const byViva = await assessmentsApi.byVivaSession(id)
    if (byViva) return byViva
    try {
      return (await assessmentsApi.get(id)).data
    } catch {
      return null
    }
  }, [id])

  if (loading) return <LoadingPanel label="Loading results…" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) {
    return (
      <div>
        <PageHeader title="Viva results" description="Assessment is still being prepared." />
        <Card>
          <CardBody className="space-y-3 text-sm text-slate-700">
            <p>
              Your viva is complete, but the AI assessment is not ready yet. This usually finishes within a minute.
            </p>
            <ButtonLikeReload onClick={reload} />
            <Link to="/student/dashboard" className="inline-block text-blue-700 hover:underline">
              Back to dashboard
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Viva results" description="Scores after instructor review when finalized." />
      <Card className="mb-4">
        <CardBody>
          {data.disclaimer ? <p className="text-sm text-amber-800">{data.disclaimer}</p> : null}
          <p className="mt-3 text-2xl font-semibold">{formatScore(data.overall_score)}</p>
          <p className="mt-1 text-sm text-slate-500">
            Status: <Badge>{data.status.replace(/_/g, ' ')}</Badge>
          </p>
        </CardBody>
      </Card>
      {data.criteria?.length ? (
        <Card className="mb-4">
          <CardBody>
            <p className="font-medium text-slate-900">Criteria</p>
            <ul className="mt-3 space-y-3">
              {data.criteria.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span>{formatScore(c.instructor_score ?? c.ai_score)}</span>
                  </div>
                  {c.explanation ? <p className="mt-1 text-slate-600">{c.explanation}</p> : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      {data.strengths?.length ? (
        <Card className="mb-4">
          <CardBody>
            <p className="font-medium text-slate-900">Strengths</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {data.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      {data.weaknesses?.length ? (
        <Card>
          <CardBody>
            <p className="font-medium text-slate-900">Areas to improve</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {data.weaknesses.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function ButtonLikeReload({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Refresh results
    </button>
  )
}
