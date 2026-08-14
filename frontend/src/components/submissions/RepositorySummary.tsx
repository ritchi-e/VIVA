import type { Submission } from '@/types'

export function RepositorySummary({
  submission,
}: {
  submission: Pick<Submission, 'github_url' | 'repository' | 'metadata' | 'processing_error'>
}) {
  const repo = submission.repository
  if (!submission.github_url && !repo) return null
  const profile = repo?.project_profile
  const stack = profile?.stack?.length ? profile.stack.join(', ') : 'Not detected yet'
  const commit = repo?.commit_sha ? repo.commit_sha.slice(0, 8) : 'pending'
  const indexed = repo?.files?.indexed ?? []
  const skipped = repo?.files?.skipped_sample ?? []

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p className="font-display text-base font-semibold text-slate-900">Repository snapshot</p>
      <p>
        {repo ? (
          <>
            {repo.owner}/{repo.repo} · commit {commit}
          </>
        ) : (
          'GitHub URL submitted; snapshot pending.'
        )}
      </p>
      {submission.github_url ? (
        <a href={submission.github_url} className="text-teal-800 hover:underline" target="_blank" rel="noreferrer">
          {submission.github_url}
        </a>
      ) : null}
      {repo ? (
        <p>
          Indexed {repo.files_indexed} files · skipped {repo.files_skipped} · stack {stack}
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-slate-500">
        The viva assesses understanding of this submitted implementation. It does not execute the
        project or verify that the code runs.
      </p>
      {indexed.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Indexed files</p>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs">
            {indexed.map((file) => (
              <li key={file.id} className="truncate py-0.5">
                {file.path}
                {file.language ? ` · ${file.language}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {skipped.length > 0 ? (
        <p className="text-xs text-slate-500">
          Skipped examples: {skipped.slice(0, 6).map((f) => f.path).join(', ')}
        </p>
      ) : null}
      {repo?.error_message || submission.processing_error ? (
        <p className="text-sm text-red-600">{repo?.error_message || submission.processing_error}</p>
      ) : null}
    </div>
  )
}
