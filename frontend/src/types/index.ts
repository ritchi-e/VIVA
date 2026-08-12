export type UserRole = 'organization_admin' | 'instructor' | 'student' | 'viewer'

export interface User {
  id: string
  email: string
  full_name: string
  email_verified: boolean
  avatar_url: string
  date_joined: string
}

export interface Membership {
  id: string
  organization: string
  organization_name: string
  organization_slug: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Course {
  id: string
  code: string
  title: string
  description: string
  term: string
  is_active: boolean
  created_at?: string
}

export interface Assignment {
  id: string
  course: string
  title: string
  description: string
  instructions: string
  status: 'draft' | 'published' | 'closed'
  due_at: string | null
  allow_pdf: boolean
  allow_docx: boolean
  allow_pptx: boolean
  allow_github: boolean
  allow_zip: boolean
  viva_config: Record<string, unknown>
  created_at?: string
}

export interface RubricCriterion {
  id: string
  name: string
  description: string
  weight: string | number
  max_score: string | number
  order: number
  category: string
}

export interface Rubric {
  id: string
  assignment: string
  title: string
  description: string
  criteria: RubricCriterion[]
}

export interface Submission {
  id: string
  assignment: string
  assignment_title?: string
  student: string
  student_email?: string
  student_name?: string
  status: 'uploaded' | 'queued' | 'processing' | 'ready' | 'failed'
  github_url: string
  metadata: Record<string, unknown>
  processing_error: string
  processed_at: string | null
  version: number
  created_at?: string
}

export interface VivaSession {
  id: string
  assignment: string
  assignment_title?: string
  submission: string
  student: string
  student_email?: string
  student_name?: string
  state: string
  mode: 'text' | 'voice'
  question_budget: number
  questions_asked: number
  time_limit_seconds: number
  started_at: string | null
  completed_at: string | null
  error_message: string
  created_at?: string
}

export interface VivaAnswerEvaluation {
  id: string
  conceptual_accuracy: number
  evidence_support: number
  depth: number
  relevance: number
  overall: number
  requires_follow_up: boolean
  explanation: string
}

export interface VivaStudentAnswer {
  id: string
  text: string
  input_mode: string
  submitted_at: string
  evaluation?: VivaAnswerEvaluation | null
}

export interface VivaQuestion {
  id: string
  sequence: number
  question_text: string
  question_type: string
  concept?: string
  source_ref?: string
  excerpt?: VivaExcerpt | null
  asked_at: string
  student_answer?: VivaStudentAnswer | null
}

export interface AssessmentEvidence {
  id: string
  source_ref: string
  quote: string
  note: string
}

export interface AssessmentCriterion {
  id: string
  name: string
  category: string
  ai_score: number | null
  instructor_score: number | null
  final_score: number | null
  max_score: number
  weight: number
  confidence: number
  explanation: string
  ai_explanation: string
  evidence_items?: AssessmentEvidence[]
}

export interface AssessmentQuestionReview {
  question_id: string
  sequence: number
  question_text: string
  question_type: string
  concept: string
  answer_text: string | null
  input_mode: string | null
  answered_at: string | null
  evaluation_overall: number | null
  evaluation_explanation: string | null
  conceptual_accuracy: number | null
  evidence_support: number | null
  depth: number | null
  relevance: number | null
  requires_follow_up: boolean | null
}

export interface Assessment {
  id: string
  viva_session: string
  submission: string
  status: 'draft' | 'pending_review' | 'modified' | 'finalized'
  overall_score: number | null
  ai_overall_score: number | null
  strengths: string[]
  weaknesses: string[]
  evidence_summary: string
  areas_requiring_review: string[]
  unanswered_areas: string[]
  recommended_followups: string[]
  disclaimer: string
  instructor_notes: string
  criteria: AssessmentCriterion[]
  question_reviews?: AssessmentQuestionReview[]
  student_name?: string
  assignment_title?: string
  reviewed_at: string | null
  finalized_at: string | null
}

export interface StudentSummary {
  id: string
  email: string
  full_name: string
  role: string
  submissions_count?: number
  viva_sessions_count?: number
  pending_reviews_count?: number
}

export interface DashboardRecentSession {
  id: string
  state: string
  mode: string
  student_id: string
  student_email: string
  student_name: string
  assignment_id: string
  assignment_title: string
  submission_id: string
  questions_asked: number
  question_budget: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface DashboardMetrics {
  courses_count: number
  assignments_count: number
  submissions_count: number
  viva_sessions_count: number
  pending_reviews_count: number
  students_count: number
  active_assignments: number
  pending_submissions: number
  viva_completion: {
    completed: number
    in_progress: number
    failed: number
    total: number
  }
  average_assessment: number | null
  assessment_distribution: { status: string; count: number }[]
  students_requiring_review: number
  recent_sessions: DashboardRecentSession[]
}

export type VivaExcerpt = {
  quote: string
  source_ref?: string
}

export type VivaWsMessage =
  | { type: 'connected'; session_id: string; state?: string }
  | {
      type: 'question'
      text: string
      sequence?: number
      question_id?: string
      excerpt?: VivaExcerpt
      provenance?: Record<string, unknown>
    }
  | { type: 'ack'; message?: string }
  | { type: 'error'; message: string }
  | { type: 'state'; state: string }
  | { type: 'complete'; state?: string }
  | {
      type: 'answer_result'
      next_question_id?: string | null
      next_question_text?: string | null
      next_question_sequence?: number | null
      next_question_excerpt?: VivaExcerpt | null
      session_state?: string
      questions_asked?: number
      question_budget?: number
      evaluation?: { explanation?: string; overall?: number; requires_follow_up?: boolean }
    }
  | { type: 'processing'; message?: string }
  | { type: 'pong' }
