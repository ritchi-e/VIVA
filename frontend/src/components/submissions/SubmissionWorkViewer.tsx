import { useEffect, useState } from 'react'
import { submissionsApi } from '@/lib/api'
import type { Submission, SubmissionFile } from '@/types'
import { cn } from '@/lib/utils'

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

function OfficeFilePreview({
  submissionId,
  file,
  compact,
  text,
}: {
  submissionId: string
  file: SubmissionFile
  compact: boolean
  text: string
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    submissionsApi
      .fileContent(submissionId, file.id)
      .then((r) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(r.data)
        setDownloadUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this file.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [submissionId, file.id])

  return (
    <div
      className={cn(
        'overflow-y-auto rounded-xl border border-slate-200 bg-white p-5',
        compact ? 'max-h-[62vh]' : 'max-h-[70vh]',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{file.original_filename}</p>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download={file.original_filename}
            className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            Download
          </a>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {text ? (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">{text}</pre>
      ) : (
        <p className="text-sm text-slate-500">
          Preview shows extracted text after processing. Use Download to open the original file.
        </p>
      )}
    </div>
  )
}

function FilePreview({
  submissionId,
  file,
  compact = false,
}: {
  submissionId: string
  file: SubmissionFile
  compact?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPdf(file)) return
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
        if (!cancelled) setError('Could not load this file in the viewer.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [submissionId, file.id, file.file_type, file.original_filename, file.content_type])

  if (isPdf(file)) {
    if (error) return <p className="text-sm text-red-600">{error}</p>
    if (!url) return <p className="text-sm text-slate-500">Loading document…</p>
    return (
      <iframe
        title={file.original_filename}
        src={url}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-slate-100',
          compact ? 'h-[62vh]' : 'h-[70vh]',
        )}
      />
    )
  }

  if (isOfficeDoc(file)) {
    const text = (file.extracted_text || '').trim()
    return (
      <OfficeFilePreview submissionId={submissionId} file={file} compact={compact} text={text} />
    )
  }

  return (
    <p className="text-sm text-slate-600">
      {file.original_filename} is stored with this submission.
    </p>
  )
}

export function SubmissionWorkViewer({
  submission,
  compact = false,
}: {
  submission: Submission
  compact?: boolean
}) {
  const files = submission.files || []
  const githubUrl = submission.github_url || submission.repository?.github_url

  if (!files.length && !githubUrl) {
    return <p className="text-sm text-[var(--color-muted)]">No uploaded files or GitHub URL on this submission.</p>
  }

  return (
    <div className="space-y-4">
      {githubUrl ? (
        <div>
          <p className="mb-1 text-sm font-medium">GitHub repository</p>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {githubUrl}
          </a>
        </div>
      ) : null}
      {files.map((file) => (
        <div key={file.id} className="space-y-2">
          <p className="text-sm font-medium">{file.original_filename}</p>
          <FilePreview submissionId={submission.id} file={file} compact={compact} />
        </div>
      ))}
    </div>
  )
}
