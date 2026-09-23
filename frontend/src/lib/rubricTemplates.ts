/** Predefined rubric packs + criterion library for assignment setup. */

export type RubricCriterionDraft = {
  key: string
  name: string
  description: string
  category: string
  weight: number
  max_score: number
  order: number
  custom?: boolean
}

export type RubricTemplate = {
  id: string
  label: string
  description: string
  title: string
  criteriaKeys: string[]
}

export type RubricCategoryFilter = {
  id: string
  label: string
}

function c(
  key: string,
  name: string,
  description: string,
  category: string,
  order: number,
): RubricCriterionDraft {
  return {
    key,
    name,
    description,
    category,
    weight: 1,
    max_score: 10,
    order,
  }
}

export const CRITERION_LIBRARY: RubricCriterionDraft[] = [
  c(
    'conceptual',
    'Conceptual understanding',
    'Explains core concepts accurately and connects them to the work.',
    'conceptual',
    0,
  ),
  c(
    'problem_framing',
    'Problem framing',
    'Defines the problem, scope, and success criteria clearly.',
    'methodology',
    1,
  ),
  c(
    'methodology',
    'Methodology & approach',
    'Chooses and justifies an appropriate method or process.',
    'methodology',
    2,
  ),
  c(
    'implementation',
    'Implementation quality',
    'Execution is sound, complete, and consistent with the stated approach.',
    'implementation',
    3,
  ),
  c(
    'code_quality',
    'Code quality & design',
    'Structure, readability, correctness, and maintainability of the code.',
    'implementation',
    4,
  ),
  c(
    'testing',
    'Testing & validation',
    'Evidence that the solution was tested or validated appropriately.',
    'implementation',
    5,
  ),
  c(
    'results',
    'Results & analysis',
    'Interprets outcomes critically and relates them to the goals.',
    'results',
    6,
  ),
  c(
    'evidence',
    'Evidence & citation',
    'Uses credible sources and attributes them correctly.',
    'critical_thinking',
    7,
  ),
  c(
    'critical',
    'Critical thinking',
    'Evaluates trade-offs, limitations, and alternative explanations.',
    'critical_thinking',
    8,
  ),
  c(
    'communication',
    'Communication & clarity',
    'Explains ideas clearly in writing and/or oral discussion.',
    'communication',
    9,
  ),
  c(
    'design',
    'Visual / design quality',
    'Visual hierarchy, usability, and polish of the designed artifact.',
    'implementation',
    10,
  ),
  c(
    'experimental',
    'Experimental rigor',
    'Controls, measurement quality, and reproducibility of the experiment.',
    'methodology',
    11,
  ),
  c(
    'oral_defense',
    'Oral defense',
    'Responds to questions with precision, composure, and depth.',
    'communication',
    12,
  ),
  c(
    'ethics',
    'Ethics & integrity',
    'Handles data, attribution, and academic integrity appropriately.',
    'critical_thinking',
    13,
  ),
]

const libraryByKey = Object.fromEntries(CRITERION_LIBRARY.map((x) => [x.key, x]))
const libraryByName = Object.fromEntries(CRITERION_LIBRARY.map((x) => [x.name.toLowerCase(), x]))

/** Balanced default: strong criteria spanning every category. */
export const DEFAULT_CRITERION_KEYS = [
  'conceptual',
  'methodology',
  'implementation',
  'testing',
  'results',
  'critical',
  'communication',
  'oral_defense',
] as const

export const RUBRIC_CATEGORIES: RubricCategoryFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'conceptual', label: 'Conceptual' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'implementation', label: 'Implementation' },
  { id: 'results', label: 'Results' },
  { id: 'critical_thinking', label: 'Critical thinking' },
  { id: 'communication', label: 'Communication' },
]

export const RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    id: 'general_project',
    label: 'General project',
    description: 'Understanding, method, execution, results, and clarity — fits most coursework.',
    title: 'General project rubric',
    criteriaKeys: ['conceptual', 'methodology', 'implementation', 'results', 'communication'],
  },
  {
    id: 'software_project',
    label: 'Software / coding',
    description: 'Problem framing, design, code quality, testing, and defense.',
    title: 'Software project rubric',
    criteriaKeys: ['problem_framing', 'code_quality', 'implementation', 'testing', 'oral_defense'],
  },
  {
    id: 'research_paper',
    label: 'Research / essay',
    description: 'Framing, evidence, analysis, critical thinking, and writing.',
    title: 'Research & writing rubric',
    criteriaKeys: ['problem_framing', 'evidence', 'critical', 'results', 'communication'],
  },
  {
    id: 'lab_report',
    label: 'Lab / experiment',
    description: 'Method rigor, execution, analysis, and integrity.',
    title: 'Lab report rubric',
    criteriaKeys: ['methodology', 'experimental', 'results', 'critical', 'ethics'],
  },
  {
    id: 'design_ux',
    label: 'Design / UX',
    description: 'Problem framing, design quality, validation, and communication.',
    title: 'Design project rubric',
    criteriaKeys: ['problem_framing', 'design', 'methodology', 'testing', 'communication'],
  },
  {
    id: 'presentation_defense',
    label: 'Presentation / viva',
    description: 'Understanding, critical thinking, and oral defense focus.',
    title: 'Presentation & viva rubric',
    criteriaKeys: ['conceptual', 'critical', 'results', 'oral_defense', 'communication'],
  },
]

export function criteriaFromKeys(keys: readonly string[]): RubricCriterionDraft[] {
  return keys
    .map((key, i) => {
      const base = libraryByKey[key]
      if (!base) return null
      return { ...base, order: i }
    })
    .filter(Boolean) as RubricCriterionDraft[]
}

export function defaultBestCriteria(): RubricCriterionDraft[] {
  return criteriaFromKeys(DEFAULT_CRITERION_KEYS)
}

export function criteriaFromTemplate(templateId: string): RubricCriterionDraft[] {
  const template = RUBRIC_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return []
  return criteriaFromKeys(template.criteriaKeys)
}

export function matchTemplateId(criteria: { name: string }[]): string | null {
  if (!criteria.length) return null
  const names = new Set(criteria.map((c) => c.name.toLowerCase()))
  for (const t of RUBRIC_TEMPLATES) {
    const pack = t.criteriaKeys.map((k) => libraryByKey[k]?.name.toLowerCase()).filter(Boolean)
    if (pack.length === names.size && pack.every((n) => names.has(n!))) {
      return t.id
    }
  }
  return null
}

export function draftsFromSaved(
  criteria: {
    id?: string
    name: string
    description?: string
    category?: string
    weight?: string | number
    max_score?: string | number
    order?: number
  }[],
): RubricCriterionDraft[] {
  return criteria.map((c, i) => {
    const known = libraryByName[c.name.toLowerCase()]
    return {
      key: known?.key ?? `custom-${c.id ?? i}-${c.name}`,
      name: c.name,
      description: c.description || known?.description || '',
      category: c.category || known?.category || '',
      weight: Number(c.weight ?? known?.weight ?? 1) || 1,
      max_score: Number(c.max_score ?? known?.max_score ?? 10) || 10,
      order: c.order ?? i,
      custom: !known,
    }
  })
}

export function toApiCriteria(drafts: RubricCriterionDraft[]) {
  return drafts.map((c, i) => ({
    name: c.name,
    description: c.description,
    category: c.category,
    weight: c.weight,
    max_score: c.max_score,
    order: i,
  }))
}
