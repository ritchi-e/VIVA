import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { assignmentsApi, coursesApi, getApiErrorMessage, rubricsApi } from '@/lib/api'
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

export function AssignmentCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const courseFromQuery = searchParams.get('course') || ''
  const courses = useAsync(() => coursesApi.list())
  const [values, setValues] = useState<AssignmentSetupValues>(() =>
    defaultSetupValues({ courseId: courseFromQuery }),
  )
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const ready = setupChecklist(values, { requireCourse: true }).every((c) => c.ok)

  const patchValues = (
    patch: Partial<AssignmentSetupValues> | ((prev: AssignmentSetupValues) => AssignmentSetupValues),
  ) => {
    setValues((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
  }

  const createAssignment = async (publish: boolean) => {
    if (!values.courseId) throw new Error('Select a course.')
    if (!values.title.trim()) throw new Error('Enter a title.')
    if (values.criteria.length === 0) throw new Error('Select at least one rubric criterion.')

    const created = await assignmentsApi.create({
      course: values.courseId,
      title: values.title.trim(),
      instructions: values.instructions,
      due_at: values.dueAt ? new Date(values.dueAt).toISOString() : null,
      status: 'draft',
      allow_pdf: values.allowPdf,
      allow_docx: values.allowDocx,
      allow_pptx: values.allowPptx,
      allow_zip: values.allowZip,
      allow_github: values.allowGithub,
      viva_config: { question_budget: values.questionBudget },
    })

    const id = created.data.id
    await rubricsApi.replaceCriteria(id, rubricPayloadFromSetup(values))

    if (publish) {
      await assignmentsApi.publish(id)
    }

    return id
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      const id = await createAssignment(false)
      navigate(`/assignments/${id}`)
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onSaveAndPublish = async () => {
    setSaving(true)
    setErrorMsg(null)
    try {
      const id = await createAssignment(true)
      navigate(`/assignments/${id}`)
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (courses.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.assignments} />
  if (courses.error) return <ErrorState message={courses.error} onRetry={courses.reload} />

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-3">
          <Link
            to="/assignments"
            className="rounded-full p-2 text-[var(--color-muted)] hover:bg-white hover:text-[var(--color-foreground)]"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </Link>
          <div>
            <p className="font-display text-lg font-bold text-[var(--color-foreground)]">Assignment</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" loading={saving} disabled={!ready}>
            Save draft
          </Button>
          <Button type="button" loading={saving} disabled={!ready} onClick={onSaveAndPublish}>
            Assign
          </Button>
        </div>
      </div>

      <AssignmentSetupFormFields
        values={values}
        onChange={patchValues}
        courses={courses.data || []}
        showCourse
      />

      {errorMsg ? <Alert tone="danger">{errorMsg}</Alert> : null}
    </form>
  )
}
