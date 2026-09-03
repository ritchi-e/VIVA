import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { coursesApi, getApiErrorMessage } from '@/lib/api'
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

export function CoursesPage() {
  const { data, loading, error, reload } = useAsync(() => coursesApi.list())
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [term, setTerm] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await coursesApi.create({ code, title, term, description, is_active: true })
      setCode('')
      setTitle('')
      setTerm('')
      setDescription('')
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
        title="Courses"
        description="Courses in your organization."
        actions={
          <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Create course'}
          </Button>
        }
      />
      {showForm ? (
        <Card className="mb-6">
          <CardBody>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
              <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Input label="Term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Fall 2026" />
              <div className="sm:col-span-2">
                <Textarea
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              {formError ? <p className="sm:col-span-2 text-sm text-red-600">{formError}</p> : null}
              <div className="sm:col-span-2">
                <Button type="submit" loading={saving}>
                  Save course
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.courses} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="No courses yet" description="Create a course to start publishing assignments." />
      ) : null}
      <div className="grid gap-2">
        {data?.map((course) => (
          <Card key={course.id} hover>
            <CardBody className="flex items-center justify-between gap-4 py-4">
              <div>
                <Link to={`/courses/${course.id}`} className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
                  {course.code} — {course.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{course.term || 'No term set'}</p>
              </div>
              <Badge tone={course.is_active ? 'success' : 'default'}>
                {course.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
