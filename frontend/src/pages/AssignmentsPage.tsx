import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { assignmentsApi, coursesApi, getApiErrorMessage } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

export function AssignmentsPage() {
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.list())
  const courses = useAsync(() => coursesApi.list())
  const [showForm, setShowForm] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!courseId) {
      setFormError('Select a course.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await assignmentsApi.create({
        course: courseId,
        title,
        description,
        instructions,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: 'draft',
        allow_pdf: true,
        allow_docx: true,
        allow_pptx: true,
        allow_github: true,
        allow_zip: true,
        viva_config: { question_budget: 8 },
      })
      setTitle('')
      setDescription('')
      setInstructions('')
      setDueAt('')
      setShowForm(false)
      await reload()
    } catch (err) {
      setFormError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Published and draft viva assignments."
        actions={
          <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Create assignment'}
          </Button>
        }
      />
      {showForm ? (
        <Card className="mb-6">
          <CardBody>
            <form className="space-y-3" onSubmit={onCreate}>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700" htmlFor="course">
                  Course
                </label>
                <select
                  id="course"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                >
                  <option value="">Select course…</option>
                  {courses.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Textarea
                label="Instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              <Input
                label="Due date"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button type="submit" loading={saving}>
                Save assignment
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No assignments" description="Create an assignment to collect submissions and run vivas." />
      ) : null}
      <div className="space-y-2">
        {data?.map((assignment) => (
          <Card key={assignment.id} hover>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link to={`/assignments/${assignment.id}`} className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
                  {assignment.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Due {formatDate(assignment.due_at)}</p>
              </div>
              <Badge tone={assignment.status === 'published' ? 'success' : 'default'}>{assignment.status}</Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
