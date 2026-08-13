import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { getApiErrorMessage, rubricsApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'

export function AssignmentRubricPage() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useAsync(
    () => rubricsApi.getForAssignment(id).then((r) => r.data),
    [id],
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [criterionDescription, setCriterionDescription] = useState('')
  const [category, setCategory] = useState('conceptual')
  const [maxScore, setMaxScore] = useState(10)
  const [weight, setWeight] = useState(1)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setTitle(data.title || '')
    setDescription(data.description || '')
  }, [data])

  const saveRubricMeta = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await rubricsApi.updateForAssignment(id, { title, description })
      setMessage('Rubric details saved.')
      reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const addCriterion = async (e: FormEvent) => {
    e.preventDefault()
    if (!data?.id) return
    setSaving(true)
    setMessage(null)
    try {
      await rubricsApi.addCriterion(data.id, {
        name,
        description: criterionDescription,
        category,
        max_score: maxScore,
        weight,
        order: data.criteria?.length ?? 0,
      })
      setName('')
      setCriterionDescription('')
      setMessage('Criterion added.')
      reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const removeCriterion = async (criterionId: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await rubricsApi.deleteCriterion(criterionId)
      setMessage('Criterion removed.')
      reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Assignment rubric" description="Criteria used for AI and instructor scoring." />
      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.assignments} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && !data ? (
        <EmptyState title="No rubric configured" description="Open this page again to auto-create a rubric." />
      ) : null}
      {data ? (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <form className="space-y-3" onSubmit={saveRubricMeta}>
                <Input label="Rubric title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <Button type="submit" loading={saving} variant="secondary">
                  Save rubric details
                </Button>
              </form>
            </CardBody>
          </Card>

          {data.criteria?.map((c) => (
            <Card key={c.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{c.description || 'No description'}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Max {c.max_score} · Weight {c.weight} · {c.category}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => removeCriterion(c.id)} disabled={saving}>
                  Remove
                </Button>
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardBody>
              <p className="mb-3 text-sm font-medium text-slate-900">Add criterion</p>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={addCriterion}>
                <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
                <Input
                  label="Max score"
                  type="number"
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value) || 10)}
                />
                <Input
                  label="Weight"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value) || 1)}
                />
                <div className="sm:col-span-2">
                  <Textarea
                    label="Description"
                    value={criterionDescription}
                    onChange={(e) => setCriterionDescription(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" loading={saving}>
                    Add criterion
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
