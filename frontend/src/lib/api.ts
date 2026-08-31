import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { formatVivaErrorMessage, logTechnicalError } from './userErrors'
import type {
  Assessment,
  Assignment,
  AuthTokens,
  Course,
  DashboardMetrics,
  Paginated,
  Rubric,
  StudentSummary,
  Submission,
  SubmissionStatus,
  User,
  VivaQuestion,
  VivaSession,
} from '@/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:18000/api'

const ACCESS_KEY = 'aiviva_access'
const REFRESH_KEY = 'aiviva_refresh'
const ORG_KEY = 'aiviva_org'

export function getStoredTokens(): AuthTokens | null {
  const access = localStorage.getItem(ACCESS_KEY)
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!access || !refresh) return null
  return { access, refresh }
}

export function setStoredTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, tokens.access)
  localStorage.setItem(REFRESH_KEY, tokens.refresh)
}

export function clearStoredTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function getOrganizationId(): string | null {
  return localStorage.getItem(ORG_KEY)
}

export function setOrganizationId(orgId: string | null) {
  if (orgId) localStorage.setItem(ORG_KEY, orgId)
  else localStorage.removeItem(ORG_KEY)
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens()
  if (!tokens?.refresh) return null
  try {
    const { data } = await axios.post<{ access: string; refresh?: string }>(
      `${API_URL}/auth/token/refresh/`,
      { refresh: tokens.refresh },
    )
    const next: AuthTokens = {
      access: data.access,
      refresh: data.refresh ?? tokens.refresh,
    }
    setStoredTokens(next)
    return next.access
  } catch {
    clearStoredTokens()
    return null
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = getStoredTokens()
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`
  }
  const orgId = getOrganizationId()
  if (orgId) {
    config.headers['X-Organization-ID'] = orgId
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const access = await refreshPromise
      if (access) {
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

function unwrapList<T>(data: Paginated<T> | T[]): T[] {
  if (Array.isArray(data)) return data
  return data.results ?? []
}

export interface LoginPayload {
  email: string
  password: string
  organization_id?: string
}

export interface RegisterPayload {
  email: string
  password: string
  full_name?: string
  organization_name?: string
  role?: string
}

export interface GoogleAuthPayload {
  credential: string
  role?: string
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<{
      user: User
      tokens: AuthTokens
      memberships: import('@/types').Membership[]
      active_membership: import('@/types').Membership | null
    }>('/auth/login/', payload),
  register: (payload: RegisterPayload) =>
    api.post<{
      user: User
      organization: { id: string; name: string; slug: string }
      role: string
      tokens: AuthTokens
    }>('/auth/register/', payload),
  me: () =>
    api.get<{ user: User; memberships: import('@/types').Membership[] }>('/auth/me/'),
  google: (payload: GoogleAuthPayload) =>
    api.post<{
      user: User
      tokens: AuthTokens
      memberships: import('@/types').Membership[]
      active_membership: import('@/types').Membership | null
      created?: boolean
    }>('/auth/google/', payload),
}

export const dashboardApi = {
  metrics: () => api.get<DashboardMetrics>('/orgs/dashboard/'),
}

export const coursesApi = {
  list: () => api.get<Paginated<Course> | Course[]>('/courses/').then((r) => unwrapList(r.data)),
  get: (id: string) => api.get<Course>(`/courses/${id}/`),
  create: (data: Partial<Course> & { code: string; title: string }) => api.post<Course>('/courses/', data),
}

export const assignmentsApi = {
  list: (params?: { course?: string }) =>
    api
      .get<Paginated<Assignment> | Assignment[]>('/assignments/', { params })
      .then((r) => unwrapList(r.data)),
  get: (id: string) => api.get<Assignment>(`/assignments/${id}/`),
  create: (data: Partial<Assignment> & { course: string; title: string }) =>
    api.post<Assignment>('/assignments/', data),
  update: (id: string, data: Partial<Assignment>) => api.patch<Assignment>(`/assignments/${id}/`, data),
  publish: (id: string) => api.post<Assignment>(`/assignments/${id}/publish/`),
}

export const rubricsApi = {
  getForAssignment: (assignmentId: string) =>
    api.get<Rubric>(`/assignments/${assignmentId}/rubric/`).catch(() =>
      api.get<Rubric>(`/rubrics/`, { params: { assignment: assignmentId } }).then((r) => {
        const list = unwrapList(r.data as unknown as Paginated<Rubric> | Rubric[])
        return { data: list[0] }
      }),
    ),
  updateForAssignment: (assignmentId: string, data: Partial<Rubric>) =>
    api.patch<Rubric>(`/assignments/${assignmentId}/rubric/`, data),
  addCriterion: (
    rubricId: string,
    data: {
      name: string
      description?: string
      weight?: number
      max_score?: number
      order?: number
      category?: string
    },
  ) => api.post(`/rubrics/${rubricId}/criteria/`, data),
  updateCriterion: (
    criterionId: string,
    data: Partial<{
      name: string
      description: string
      weight: number
      max_score: number
      order: number
      category: string
    }>,
  ) => api.patch(`/rubrics/criteria/${criterionId}/`, data),
  deleteCriterion: (criterionId: string) => api.delete(`/rubrics/criteria/${criterionId}/`),
}

export const submissionsApi = {
  list: (params?: { assignment?: string; student?: string }) =>
    api
      .get<Paginated<Submission> | Submission[]>('/submissions/', { params })
      .then((r) => unwrapList(r.data)),
  get: (id: string) => api.get<Submission>(`/submissions/${id}/`),
  status: (id: string) => api.get<SubmissionStatus>(`/submissions/${id}/status/`),
  create: (payload: FormData) =>
    api.post<Submission>('/submissions/', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  fileContent: (submissionId: string, fileId: string) =>
    api.get<Blob>(`/submissions/${submissionId}/files/${fileId}/content/`, { responseType: 'blob' }),
}

export const vivaApi = {
  list: (params?: { assignment?: string }) =>
    api
      .get<Paginated<VivaSession> | VivaSession[]>('/viva/sessions/', { params })
      .then((r) => unwrapList(r.data)),
  get: (id: string) => api.get<VivaSession>(`/viva/sessions/${id}/`),
  questions: (id: string) =>
    api
      .get<Paginated<VivaQuestion> | VivaQuestion[]>(`/viva/sessions/${id}/questions/`)
      .then((r) => unwrapList(r.data)),
  create: (payload: { assignment: string; submission: string; mode?: string }) =>
    api.post<VivaSession>('/viva/sessions/', payload),
  prepare: (id: string) =>
    api.post<VivaSession>(`/viva/sessions/${id}/prepare/`, {}, { timeout: 180_000 }),
  begin: (id: string) => api.post<VivaSession>(`/viva/sessions/${id}/start/`, {}, { timeout: 60_000 }),
  finish: (id: string, payload?: { question_id?: string; text?: string }) =>
    api.post<VivaSession>(`/viva/sessions/${id}/finish/`, payload ?? {}),
  integrity: (id: string, payload: { event_type: string; metadata?: Record<string, unknown> }) =>
    api.post(`/viva/sessions/${id}/integrity/`, payload),
  sttConfig: (id: string) =>
    api.get<{ provider: string; model: string; keyterms: string[]; configured: boolean }>(
      `/viva/sessions/${id}/stt-config/`,
    ),
  /** Create session, prepare questions with AI, then start — call before navigating to the viva UI. */
  start: async (payload: { assignment: string; submission: string; mode?: string }) => {
    const created = await api.post<VivaSession>('/viva/sessions/', { ...payload, mode: payload.mode ?? 'voice' })
    const sessionId = created.data.id
    const prepared = await api.post<VivaSession>(`/viva/sessions/${sessionId}/prepare/`, {}, { timeout: 180_000 })
    if (prepared.data.state === 'FAILED') {
      logTechnicalError('viva.prepare', prepared.data.error_message)
      throw new Error(formatVivaErrorMessage(prepared.data.error_message))
    }
    const started = await api.post<VivaSession>(`/viva/sessions/${sessionId}/start/`, {}, { timeout: 60_000 })
    return started
  },
}

export const assessmentsApi = {
  get: (id: string) => api.get<Assessment>(`/assessments/${id}/`),
  list: (params?: { submission?: string; viva_session?: string }) =>
    api
      .get<Paginated<Assessment> | Assessment[]>('/assessments/', { params })
      .then((r) => unwrapList(r.data)),
  bySubmission: (submissionId: string) =>
    api
      .get<Paginated<Assessment> | Assessment[]>('/assessments/', {
        params: { submission: submissionId },
      })
      .then((r) => unwrapList(r.data)[0] ?? null),
  byVivaSession: (vivaSessionId: string) =>
    api
      .get<Paginated<Assessment> | Assessment[]>('/assessments/', {
        params: { viva_session: vivaSessionId },
      })
      .then((r) => unwrapList(r.data)[0] ?? null),
  updateCriterion: (assessmentId: string, criterionId: string, data: { instructor_score: number }) =>
    api.post<Assessment>(`/assessments/${assessmentId}/modify/`, {
      field_name: 'instructor_score',
      criterion_id: criterionId,
      new_value: data.instructor_score,
      reason: 'Instructor score adjustment',
    }),
  finalize: (id: string, data?: { instructor_notes?: string }) =>
    api.post<Assessment>(`/assessments/${id}/finalize/`, data ?? {}),
}

export const studentsApi = {
  list: () =>
    api
      .get<StudentSummary[]>('/orgs/dashboard/students/', { params: { role: 'student' } })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),
  get: (id: string) => api.get<StudentSummary>(`/orgs/dashboard/students/${id}/`),
}

export const reportsApi = {
  summary: () => api.get<DashboardMetrics>('/orgs/dashboard/'),
}

export interface MembershipRecord {
  id: string
  organization: string
  role: string
  is_active: boolean
  created_at?: string
  user?: {
    id: string
    email: string
    full_name?: string
  }
}

export interface AiUsageMetrics {
  organization_id: string
  totals: {
    requests: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: string
  }
  by_request_type: Array<{
    request_type: string
    count: number
    input_tokens: number | null
    output_tokens: number | null
  }>
}

export const adminApi = {
  auditLog: () => api.get<Paginated<unknown> | unknown[]>('/audit/logs/'),
  memberships: (organizationId: string) =>
    api.get<MembershipRecord[]>(`/orgs/${organizationId}/memberships/`).then((r) => r.data),
  addMembership: (
    organizationId: string,
    payload: { user_email: string; role: string; is_active?: boolean },
  ) => api.post<MembershipRecord>(`/orgs/${organizationId}/memberships/`, payload),
  updateMembership: (membershipId: string, payload: Partial<{ role: string; is_active: boolean }>) =>
    api.patch<MembershipRecord>(`/orgs/memberships/${membershipId}/`, payload),
  removeMembership: (membershipId: string) => api.delete(`/orgs/memberships/${membershipId}/`),
  aiUsage: () => api.get<AiUsageMetrics>('/ai/usage/'),
}

export interface SlotWindow {
  slot_start: string
  slot_end: string
  capacity: number
  booked: number
  available: number
}

export interface SlotBooking {
  id: string
  student: string
  student_name: string
  student_email?: string
  assignment: string
  assignment_title: string
  submission: string
  slot_start: string
  slot_end: string
  status: string
  viva_session_id: string | null
  created_at: string
}

export const slotsApi = {
  available: () => api.get<SlotWindow[]>('/viva/slots/available/').then((r) => r.data),
  book: (assignmentId: string, slotStart: string) =>
    api.post<SlotBooking>('/viva/slots/book/', { assignment_id: assignmentId, slot_start: slotStart }),
  cancel: (bookingId: string) => api.post<SlotBooking>(`/viva/slots/${bookingId}/cancel/`),
  my: () => api.get<SlotBooking[]>('/viva/slots/my/').then((r) => r.data),
  forAssignment: (assignmentId: string) =>
    api.get<SlotBooking[]>('/viva/slots/for-assignment/', { params: { assignment: assignmentId } }).then((r) => r.data),
}

export function getVivaWebSocketUrl(sessionId: string, accessToken: string) {
  const base = import.meta.env.VITE_WS_URL ?? 'ws://localhost:18000/ws'
  const url = new URL(`${base.replace(/\/$/, '')}/viva/${sessionId}/`)
  url.searchParams.set('token', accessToken)
  return url.toString()
}

export { getApiErrorMessage, formatSubmissionProcessingError, formatVivaErrorMessage } from './userErrors'
