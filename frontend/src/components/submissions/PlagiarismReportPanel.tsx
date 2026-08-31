import { Link } from 'react-router-dom'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { PlagiarismReport } from '@/types'
import { formatDate } from '@/lib/utils'

function similarityLabel(score: number) {
  return `${Math.round(score * 100)}%`
}

export function PlagiarismReportPanel({ report }: { report: PlagiarismReport }) {
  if (report.status === 'pending') {
    return (
      <Card className="mb-6 border-slate-200">
        <CardBody className="text-sm text-slate-600">
          Plagiarism check is pending. It runs automatically after the viva completes.
        </CardBody>
      </Card>
    )
  }

  if (report.status === 'skipped') {
    return (
      <Card className="mb-6 border-slate-200">
        <CardBody className="text-sm text-slate-600">{report.summary || 'No peer submissions to compare.'}</CardBody>
      </Card>
    )
  }

  const flagged = report.plagiarism_detected

  return (
    <Card className={`mb-6 ${flagged ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`}>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Similarity report</h2>
            <p className="mt-1 text-sm text-slate-600">
              Compared against {report.peer_count} other submission{report.peer_count === 1 ? '' : 's'}
              {report.checked_at ? ` · ${formatDate(report.checked_at)}` : ''}
            </p>
          </div>
          <Badge tone={flagged ? 'warning' : 'success'}>
            {flagged ? 'Review recommended' : 'No significant overlap'}
          </Badge>
        </div>

        <p className="text-sm text-slate-700">{report.summary}</p>

        {!flagged ? (
          <p className="text-xs text-slate-500">
            This check uses file fingerprints and text embeddings from submitted work. It flags likely overlap but
            does not replace your academic judgment.
          </p>
        ) : null}

        {report.matches.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Closest matches</p>
            {report.matches.map((match) => (
              <div
                key={match.submission_id}
                className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {match.student_name || match.student_email || 'Another student'}
                    </p>
                    {match.student_name && match.student_email ? (
                      <p className="text-xs text-slate-500">{match.student_email}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={match.similarity_score >= 0.45 ? 'warning' : 'default'}>
                      {similarityLabel(match.similarity_score)} similar
                    </Badge>
                    <Link
                      to={`/submissions/${match.submission_id}`}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      View submission
                    </Link>
                  </div>
                </div>

                <ul className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  {match.identical_repository ? <li>Identical GitHub repository snapshot</li> : null}
                  {match.matching_upload_files > 0 ? (
                    <li>{match.matching_upload_files} identical uploaded file(s)</li>
                  ) : null}
                  {match.matching_repo_files > 0 ? (
                    <li>{match.matching_repo_files} identical repository file(s)</li>
                  ) : null}
                  {match.matching_chunks > 0 ? <li>{match.matching_chunks} identical text section(s)</li> : null}
                  {match.similar_chunk_pairs > 0 ? (
                    <li>{match.similar_chunk_pairs} highly similar text section(s)</li>
                  ) : null}
                </ul>

                {match.sample_matches?.length ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-slate-500">Examples</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {match.sample_matches.map((sample, idx) => (
                        <li key={`${sample.path}-${idx}`} className="truncate">
                          {sample.path}
                          {sample.other_path && sample.other_path !== sample.path ? ` ↔ ${sample.other_path}` : ''}
                          {sample.similarity != null ? ` · ${similarityLabel(sample.similarity)}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
