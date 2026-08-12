import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { assignmentsApi, getApiErrorMessage } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { LoadingPanel } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/layout/StateViews'

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AssignmentSettingsPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(() => assignmentsApi.get(id).then((r) => r.data), [id])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [status, setStatus] = useState('draft')
  const [dueAt, setDueAt] = useState('')
  const [allowPdf, setAllowPdf] = useState(true)
  const [allowDocx, setAllowDocx] = useState(true)
  const [allowPptx, setAllowPptx] = useState(true)
  const [allowZip, setAllowZip] = useState(true)
  const [allowGithub, setAllowGithub] = useState(true)
  const [questionBudget, setQuestionBudget] = useState(8)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setTitle(data.title)
    setDescription(data.description || '')
    setInstructions(data.instructions || '')
    setStatus(data.status)
    setDueAt(toLocalInput(data.due_at))
    setAllowPdf(data.allow_pdf)
    setAllowDocx(data.allow_docx)
    setAllowPptx(data.allow_pptx)
    setAllowZip(data.allow_zip)
    setAllowGithub(data.allow_github)
    const budget = Number((data.viva_config as { question_budget?: number } | undefined)?.question_budget)
    setQuestionBudget(Number.isFinite(budget) && budget > 0 ? budget : 8)
  }, [data])

  if (loading) return <LoadingPanel />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await assignmentsApi.update(id, {
        title,
        description,
        instructions,
        status: status as typeof data.status,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        allow_pdf: allowPdf,
        allow_docx: allowDocx,
        allow_pptx: allowPptx,
        allow_zip: allowZip,
        allow_github: allowGithub,
        viva_config: { ...(data.viva_config || {}), question_budget: questionBudget },
      })
      setMessage('Settings saved.')
      reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onPublish = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await assignmentsApi.publish(id)
      setMessage('Assignment published.')
      reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Assignment settings"
        description="Submission rules, viva budget, and publication status."
        actions={
          data.status !== 'published' ? (
            <Button variant="secondary" onClick={onPublish} loading={saving}>
              Publish
            </Button>
          ) : null
        }
      />
      <Card>
        <CardBody>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Textarea label="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            <Input
              label="Due date"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
            <Input
              label="Viva question budget"
              type="number"
              min={1}
              max={20}
              value={questionBudget}
              onChange={(e) => setQuestionBudget(Number(e.target.value) || 8)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Allowed submission types</legend>
              {[
                ['PDF', allowPdf, setAllowPdf],
                ['DOCX', allowDocx, setAllowDocx],
                ['PPTX', allowPptx, setAllowPptx],
                ['ZIP', allowZip, setAllowZip],
                ['GitHub URL', allowGithub, setAllowGithub],
              ].map(([label, checked, setter]) => (
                <label key={String(label)} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                  />
                  {label as string}
                </label>
              ))}
            </fieldset>
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
