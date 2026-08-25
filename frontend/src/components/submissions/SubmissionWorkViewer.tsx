import { useEffect, useState } from 'react'
import { submissionsApi } from '@/lib/api'
import type { Submission, SubmissionFile } from '@/types'

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

function FilePreview({ submissionId, file }: { submissionId: string; file: SubmissionFile }) {
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
        className="h-[70vh] w-full rounded-xl border border-slate-200 bg-slate-100"
      />
    )
  }

  if (isOfficeDoc(file)) {
    const text = (file.extracted_text || '').trim()
    return (
      <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-medium text-slate-700">{file.original_filename}</p>
        {text ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">{text}</pre>
        ) : (
          <p className="text-sm text-slate-500">
            Word and PowerPoint files are kept on the platform. A formatted page preview is not available in
            the browser, so the extracted text will appear here after processing.
          </p>
        )}
      </div>
    )
  }

  return (
    <p className="text-sm text-slate-600">
      {file.original_filename} is stored with this submission.
    </p>
  )
}

export function SubmissionWorkViewer({ submission }: { submission: Submission }) {
  const files = submission.files || []
  const githubUrl = submission.github_url || submission.repository?.github_url

  if (!files.length && !githubUrl) {
    return <p className="text-sm text-slate-600">No uploaded files or GitHub URL on this submission.</p>
  }

  return (
    <div className="space-y-6">
      {githubUrl ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">GitHub repository</p>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-base font-medium text-blue-700 hover:underline"
          >
            {githubUrl}
          </a>
        </div>
      ) : null}
      {files.map((file) => (
        <div key={file.id} className="space-y-2">
          <p className="text-sm font-medium text-slate-700">{file.original_filename}</p>
          <FilePreview submissionId={submission.id} file={file} />
        </div>
      ))}
    </div>
  )
}
