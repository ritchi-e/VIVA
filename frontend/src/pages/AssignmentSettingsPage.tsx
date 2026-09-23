import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { assignmentsApi, getApiErrorMessage, rubricsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { Alert } from '@/components/ui/Alert'
import {
  AssignmentSetupFormFields,
  defaultSetupValues,
  rubricPayloadFromSetup,
  setupChecklist,
  type AssignmentSetupValues,
} from '@/components/assignment/AssignmentSetupForm'
import { draftsFromSaved, matchTemplateId } from '@/lib/rubricTemplates'

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AssignmentSettingsPage() {
  const { id = '' } = useParams()
  const assignment = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const rubric = useAsync(() => rubricsApi.getForAssignment(id).then((r) => r.data), [id])

  const [values, setValues] = useState<AssignmentSetupValues>(() => defaultSetupValues())
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!assignment.data || !rubric.data || hydrated) return
    const data = assignment.data
    const existing = rubric.data.criteria || []
    const budget = Number((data.viva_config as { question_budget?: number } | undefined)?.question_budget)
    setValues(
      defaultSetupValues({
        courseId: data.course,
        title: data.title,
        instructions: data.instructions || '',
        dueAt: toLocalInput(data.due_at),
        allowPdf: data.allow_pdf,
        allowDocx: data.allow_docx,
        allowPptx: data.allow_pptx,
        allowZip: data.allow_zip,
        allowGithub: data.allow_github,
        questionBudget: Number.isFinite(budget) && budget > 0 ? budget : 8,
        templateId: existing.length ? matchTemplateId(existing) : 'general_project',
        criteria: existing.length ? draftsFromSaved(existing) : defaultSetupValues().criteria,
      }),
    )
    setHydrated(true)
  }, [assignment.data, rubric.data, hydrated])

  const checklist = useMemo(() => setupChecklist(values), [values])
  const readyToPublish = checklist.every((c) => c.ok)

  const patchValues = (
    patch: Partial<AssignmentSetupValues> | ((prev: AssignmentSetupValues) => AssignmentSetupValues),
  ) => {
    setValues((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
  }

  if (assignment.loading || rubric.loading || !hydrated) {
    return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  }
  if (assignment.error || !assignment.data) {
    return <ErrorState message={assignment.error ?? 'Not found'} onRetry={assignment.reload} />
  }

  const persistSetup = async () => {
    if (!assignment.data) throw new Error('Assignment not loaded.')
    if (values.criteria.length === 0) throw new Error('Select at least one rubric criterion.')
    await assignmentsApi.update(id, {
      title: values.title,
      instructions: values.instructions,
      due_at: values.dueAt ? new Date(values.dueAt).toISOString() : null,
      allow_pdf: values.allowPdf,
      allow_docx: values.allowDocx,
      allow_pptx: values.allowPptx,
      allow_zip: values.allowZip,
      allow_github: values.allowGithub,
      viva_config: { ...(assignment.data.viva_config || {}), question_budget: values.questionBudget },
    })
    await rubricsApi.replaceCriteria(id, rubricPayloadFromSetup(values))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setErrorMsg(null)
    try {
      await persistSetup()
      setMessage('Setup saved.')
      await Promise.all([assignment.reload(), rubric.reload()])
      setHydrated(false)
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onPublish = async () => {
    setSaving(true)
    setMessage(null)
    setErrorMsg(null)
    try {
      await persistSetup()
      await assignmentsApi.publish(id)
      setMessage('Published — students can access this assessment.')
      await Promise.all([assignment.reload(), rubric.reload()])
      setHydrated(false)
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const data = assignment.data

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/assignments/${id}`}
            className="rounded-full p-2 text-[var(--color-muted)] hover:bg-white hover:text-[var(--color-foreground)]"
            aria-label="Back"
          >
            <X className="h-5 w-5" />
          </Link>
          <div>
            <p className="font-display text-lg font-bold text-[var(--color-foreground)]">Assignment</p>
            <p className="text-xs text-[var(--color-muted)]">
              {data.status === 'published' ? 'Published — edits apply to students' : 'Draft — not visible yet'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" loading={saving}>
            Save
          </Button>
          {data.status !== 'published' ? (
            <Button type="button" loading={saving} disabled={!readyToPublish} onClick={onPublish}>
              Assign
            </Button>
          ) : null}
        </div>
      </div>

      <AssignmentSetupFormFields values={values} onChange={patchValues} />

      {errorMsg ? <Alert tone="danger">{errorMsg}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </form>
  )
}
