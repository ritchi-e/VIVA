import { useMemo, useState, type ReactNode } from 'react'
import {
  Archive,
  Check,
  FileText,
  FileType2,
  FolderGit2,
  Presentation,
  Plus,
  X,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { RichTextInstructions } from '@/components/ui/RichTextInstructions'
import { cn } from '@/lib/utils'
import {
  CRITERION_LIBRARY,
  RUBRIC_TEMPLATES,
  criteriaFromTemplate,
  toApiCriteria,
  type RubricCriterionDraft,
} from '@/lib/rubricTemplates'
import type { Course } from '@/types'

export type AssignmentSetupValues = {
  courseId: string
  title: string
  instructions: string
  dueAt: string
  allowPdf: boolean
  allowDocx: boolean
  allowPptx: boolean
  allowZip: boolean
  allowGithub: boolean
  questionBudget: number
  templateId: string | null
  criteria: RubricCriterionDraft[]
}

export function defaultSetupValues(overrides?: Partial<AssignmentSetupValues>): AssignmentSetupValues {
  return {
    courseId: '',
    title: '',
    instructions: '',
    dueAt: '',
    allowPdf: true,
    allowDocx: true,
    allowPptx: true,
    allowZip: true,
    allowGithub: true,
    questionBudget: 8,
    templateId: 'general_project',
    criteria: criteriaFromTemplate('general_project'),
    ...overrides,
  }
}

export function setupChecklist(values: AssignmentSetupValues, { requireCourse = false } = {}) {
  return [
    ...(requireCourse ? [{ ok: Boolean(values.courseId), label: 'Course' }] : []),
    { ok: values.title.trim().length > 0, label: 'Title' },
    {
      ok:
        values.allowPdf ||
        values.allowDocx ||
        values.allowPptx ||
        values.allowZip ||
        values.allowGithub,
      label: 'Submission type',
    },
    { ok: values.criteria.length > 0, label: 'Rubric' },
    { ok: values.questionBudget >= 1, label: 'Viva' },
  ]
}

export function rubricPayloadFromSetup(values: AssignmentSetupValues) {
  const template = RUBRIC_TEMPLATES.find((t) => t.id === values.templateId)
  return {
    title: template?.title || `${values.title.trim() || 'Assessment'} Rubric`,
    description: template?.description || '',
    template_id: values.templateId || undefined,
    criteria: toApiCriteria(values.criteria),
  }
}

export function totalPointsFromCriteria(criteria: RubricCriterionDraft[]) {
  return criteria.reduce((sum, c) => sum + (Number(c.max_score) || 0), 0)
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
      {children}
    </p>
  )
}

function PackChip({
  selected,
  label,
  onClick,
  title,
}: {
  selected?: boolean
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors',
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-active)] text-[var(--color-foreground)]'
          : 'border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-foreground)]',
      )}
    >
      {label}
    </button>
  )
}

const SUBMISSION_TYPES = [
  {
    key: 'allowPdf' as const,
    label: 'PDF',
    Icon: FileText,
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
    activeTone: 'bg-rose-100 text-rose-800 ring-rose-400',
  },
  {
    key: 'allowDocx' as const,
    label: 'DOCX',
    Icon: FileType2,
    tone: 'bg-sky-50 text-sky-700 ring-sky-200',
    activeTone: 'bg-sky-100 text-sky-800 ring-sky-400',
  },
  {
    key: 'allowPptx' as const,
    label: 'PPTX',
    Icon: Presentation,
    tone: 'bg-orange-50 text-orange-700 ring-orange-200',
    activeTone: 'bg-orange-100 text-orange-800 ring-orange-400',
  },
  {
    key: 'allowZip' as const,
    label: 'ZIP',
    Icon: Archive,
    tone: 'bg-amber-50 text-amber-800 ring-amber-200',
    activeTone: 'bg-amber-100 text-amber-900 ring-amber-400',
  },
  {
    key: 'allowGithub' as const,
    label: 'GitHub',
    Icon: FolderGit2,
    tone: 'bg-slate-100 text-slate-700 ring-slate-200',
    activeTone: 'bg-slate-200 text-slate-900 ring-slate-500',
  },
]

export function AssignmentSetupFormFields({
  values,
  onChange,
  courses,
  showCourse = false,
}: {
  values: AssignmentSetupValues
  onChange: (patch: Partial<AssignmentSetupValues> | ((prev: AssignmentSetupValues) => AssignmentSetupValues)) => void
  courses?: Course[]
  showCourse?: boolean
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')

  const selectedKeys = useMemo(() => new Set(values.criteria.map((c) => c.key)), [values.criteria])
  const availableLibrary = useMemo(
    () => CRITERION_LIBRARY.filter((item) => !selectedKeys.has(item.key)),
    [selectedKeys],
  )
  const totalPoints = totalPointsFromCriteria(values.criteria)

  const set = (patch: Partial<AssignmentSetupValues>) => onChange(patch)

  const applyTemplate = (id: string) => {
    set({ templateId: id, criteria: criteriaFromTemplate(id) })
  }

  const addCriterion = (item: RubricCriterionDraft) => {
    onChange((prev) => {
      if (prev.criteria.some((c) => c.key === item.key)) return prev
      return {
        ...prev,
        templateId: null,
        criteria: [...prev.criteria, { ...item, order: prev.criteria.length }],
      }
    })
  }

  const removeCriterion = (key: string) => {
    onChange((prev) => ({
      ...prev,
      templateId: null,
      criteria: prev.criteria.filter((c) => c.key !== key).map((c, i) => ({ ...c, order: i })),
    }))
  }

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    onChange((prev) => ({
      ...prev,
      templateId: null,
      criteria: [
        ...prev.criteria,
        {
          key: `custom-${Date.now()}`,
          name,
          description: customDescription.trim(),
          category: 'custom',
          weight: 1,
          max_score: 10,
          order: prev.criteria.length,
          custom: true,
        },
      ],
    }))
    setCustomName('')
    setCustomDescription('')
    setShowCustom(false)
  }

  const sidebar = (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <Card>
        <CardBody className="space-y-4 !py-4">
          {showCourse ? (
            <div>
              <FieldLabel>For</FieldLabel>
              <select
                id="setup-course"
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm shadow-sm"
                value={values.courseId}
                onChange={(e) => set({ courseId: e.target.value })}
                required
              >
                <option value="">Select course…</option>
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <FieldLabel>Due</FieldLabel>
            <Input
              type="datetime-local"
              value={values.dueAt}
              onChange={(e) => set({ dueAt: e.target.value })}
              aria-label="Due date"
            />
          </div>

          <div>
            <FieldLabel>Points</FieldLabel>
            <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-2.5 text-sm font-semibold text-[var(--color-foreground)]">
              {totalPoints}
              <span className="ml-1.5 text-xs font-normal text-[var(--color-muted)]">
                from {values.criteria.length} criteria
              </span>
            </div>
          </div>

          <div>
            <FieldLabel>Viva questions</FieldLabel>
            <Input
              type="number"
              min={1}
              max={20}
              value={values.questionBudget}
              onChange={(e) => set({ questionBudget: Number(e.target.value) || 8 })}
              aria-label="About how many viva questions"
            />
          </div>

          <div>
            <FieldLabel>Attach</FieldLabel>
            <div className="flex flex-col gap-1.5">
              {SUBMISSION_TYPES.map(({ key, label, Icon, tone, activeTone }) => {
                const selected = values[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ [key]: !selected })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition',
                      selected
                        ? 'border-[var(--color-accent)]/40 bg-[var(--color-sidebar-active)]'
                        : 'border-transparent bg-white hover:border-[var(--color-border)]',
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 transition',
                        selected ? activeTone : tone,
                        !selected && 'opacity-70',
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        selected ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted)]',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardBody>
      </Card>
    </aside>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
      <div className="min-w-0 space-y-3">
        <Card>
          <CardBody className="space-y-3 !py-4">
            <Input
              label="Title"
              value={values.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Title"
              required
            />
            <RichTextInstructions
              value={values.instructions}
              onChange={(html) => set({ instructions: html })}
              placeholder="Tell students what to submit and prepare for the viva…"
            />
          </CardBody>
        </Card>

        <div id="rubric">
          <Card>
            <CardBody className="space-y-3 !py-4">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">Rubric</h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  Pick a pack, then add or remove criteria.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {RUBRIC_TEMPLATES.map((t) => (
                  <PackChip
                    key={t.id}
                    label={t.label}
                    title={t.description}
                    selected={values.templateId === t.id}
                    onClick={() => applyTemplate(t.id)}
                  />
                ))}
              </div>

              <div className="grid h-[28rem] gap-3 md:grid-cols-2">
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
                  <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-3 py-2">
                    <p className="text-sm font-bold text-[var(--color-foreground)]">Available</p>
                    <span className="text-xs text-[var(--color-muted)]">{availableLibrary.length}</span>
                  </div>
                  <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
                    {availableLibrary.length === 0 ? (
                      <li className="px-2 py-6 text-center text-xs text-[var(--color-muted)]">
                        Everything from the library is selected.
                      </li>
                    ) : (
                      availableLibrary.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => addCriterion(item)}
                            className="flex w-full items-start gap-2 rounded-lg border border-transparent bg-white px-2.5 py-2 text-left hover:border-[var(--color-accent)]/40"
                          >
                            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[var(--color-foreground)]">
                                {item.name}
                              </span>
                              <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--color-muted)]">
                                {item.description}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="shrink-0 border-t border-[var(--color-border)] bg-white/70 p-2">
                    {showCustom ? (
                      <div className="max-h-36 space-y-2 overflow-y-auto overscroll-contain">
                        <Input
                          label="Custom criterion"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="e.g. Domain knowledge"
                        />
                        <Textarea
                          label="What good looks like (optional)"
                          rows={2}
                          className="min-h-0"
                          value={customDescription}
                          onChange={(e) => setCustomDescription(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="!px-3 !py-1.5 text-sm"
                            onClick={addCustom}
                            disabled={!customName.trim()}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="!px-3 !py-1.5 text-sm"
                            onClick={() => setShowCustom(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full !px-3 !py-1.5 text-sm"
                        onClick={() => setShowCustom(true)}
                      >
                        + Custom criterion
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-sidebar-active)]/35">
                  <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-3 py-2">
                    <p className="text-sm font-bold text-[var(--color-foreground)]">Selected</p>
                    <span className="text-xs font-semibold text-[var(--color-foreground)]">
                      {values.criteria.length}
                    </span>
                  </div>
                  <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
                    {values.criteria.length === 0 ? (
                      <li className="px-2 py-6 text-center text-xs text-[var(--color-muted)]">
                        Choose a pack, or add from Available.
                      </li>
                    ) : (
                      values.criteria.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-2"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[var(--color-foreground)]">
                              {c.name}
                            </span>
                            {c.description ? (
                              <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--color-muted)]">
                                {c.description}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${c.name}`}
                            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
                            onClick={() => removeCriterion(c.key)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {sidebar}
    </div>
  )
}
