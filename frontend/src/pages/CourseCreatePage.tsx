import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { coursesApi, getApiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'

export function CourseCreatePage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [term, setTerm] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      const created = await coursesApi.create({
        code: code.trim(),
        title: title.trim(),
        term: term.trim(),
        description,
        is_active: true,
      })
      navigate(`/courses/${created.data.id}`, { replace: true })
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mx-auto max-w-xl space-y-4" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-full p-2 text-[var(--color-muted)] hover:bg-white hover:text-[var(--color-foreground)]"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </Link>
          <p className="font-display text-lg font-bold text-[var(--color-foreground)]">Course</p>
        </div>
        <Button type="submit" loading={saving} disabled={!code.trim() || !title.trim()}>
          Create
        </Button>
      </div>

      <Card>
        <CardBody className="space-y-3 !py-4">
          <Input
            label="Course code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CS101"
            required
          />
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Introduction to Algorithms"
            required
          />
          <Input
            label="Term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Fall 2026"
          />
          <Textarea
            label="Description (optional)"
            rows={3}
            className="min-h-0"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </CardBody>
      </Card>

      <Alert tone="info">
        After you create the course, you&apos;ll get a join code and share link for students — like Google
        Classroom.
      </Alert>

      {errorMsg ? <Alert tone="danger">{errorMsg}</Alert> : null}
    </form>
  )
}
