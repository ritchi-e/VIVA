import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CourseWorkspaceLayout } from '@/components/layout/CourseWorkspaceLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CourseCreatePage } from '@/pages/CourseCreatePage'
import { CourseDashboardPage } from '@/pages/course/CourseDashboardPage'
import { CourseAssignmentsPage } from '@/pages/course/CourseAssignmentsPage'
import { CourseStudentsPage } from '@/pages/course/CourseStudentsPage'
import { CourseReviewsPage } from '@/pages/course/CourseReviewsPage'
import { AssignmentCreatePage } from '@/pages/AssignmentCreatePage'
import { AssignmentDetailPage } from '@/pages/AssignmentDetailPage'
import { AssignmentBookedSlotsPage } from '@/pages/AssignmentBookedSlotsPage'
import { AssignmentRubricPage } from '@/pages/AssignmentRubricPage'
import { AssignmentSettingsPage } from '@/pages/AssignmentSettingsPage'
import { SubmissionDetailPage } from '@/pages/SubmissionDetailPage'
import { EvidenceDashboardPage } from '@/pages/EvidenceDashboardPage'
import { VivaSessionsPage } from '@/pages/VivaSessionsPage'
import { VivaSessionDetailPage } from '@/pages/VivaSessionDetailPage'
import { StudentDetailPage } from '@/pages/StudentDetailPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AdminPage } from '@/pages/AdminPage'
import { StudentDashboardPage } from '@/pages/student/StudentDashboardPage'
import { StudentAssignmentsPage } from '@/pages/student/StudentAssignmentsPage'
import { StudentAssignmentDetailPage } from '@/pages/student/StudentAssignmentDetailPage'
import { StudentSubmissionPage } from '@/pages/student/StudentSubmissionPage'
import { StudentVivaPage } from '@/pages/student/StudentVivaPage'
import { StudentSlotBookingPage } from '@/pages/student/StudentSlotBookingPage'
import { StudentResultsPage } from '@/pages/student/StudentResultsPage'
import { StudentResultsListPage } from '@/pages/student/StudentResultsListPage'
import { JoinCoursePage } from '@/pages/JoinCoursePage'
import { HomeRedirect } from '@/components/auth/HomeRedirect'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/join" element={<JoinCoursePage />} />
      <Route path="/join/:code" element={<JoinCoursePage />} />

      <Route element={<ProtectedRoute instructorOnly />}>
        <Route element={<AppShell variant="instructor" />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/courses" element={<Navigate to="/dashboard" replace />} />
          <Route path="/courses/new" element={<CourseCreatePage />} />
          <Route path="/courses/:courseId" element={<CourseWorkspaceLayout />}>
            <Route index element={<CourseDashboardPage />} />
            <Route path="assignments" element={<CourseAssignmentsPage />} />
            <Route path="students" element={<CourseStudentsPage />} />
            <Route path="reviews" element={<CourseReviewsPage />} />
          </Route>
          <Route path="/assignments/new" element={<AssignmentCreatePage />} />
          <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/assignments/:id/booked-slots" element={<AssignmentBookedSlotsPage />} />
          <Route path="/assignments/:id/rubric" element={<AssignmentRubricPage />} />
          <Route path="/assignments/:id/settings" element={<AssignmentSettingsPage />} />
          <Route path="/assignments" element={<Navigate to="/dashboard" replace />} />
          <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
          <Route path="/submissions/:id/evidence" element={<EvidenceDashboardPage />} />
          <Route path="/submissions" element={<Navigate to="/dashboard" replace />} />
          <Route path="/viva-sessions" element={<VivaSessionsPage />} />
          <Route path="/viva-sessions/:id" element={<VivaSessionDetailPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/students" element={<Navigate to="/dashboard" replace />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute studentOnly />}>
        <Route element={<AppShell variant="student" />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/join" element={<JoinCoursePage />} />
          <Route path="/student/assignments" element={<StudentAssignmentsPage />} />
          <Route path="/student/assignments/:id" element={<StudentAssignmentDetailPage />} />
          <Route path="/student/submissions/:id" element={<StudentSubmissionPage />} />
          <Route path="/student/assignments/:id/book-slot" element={<StudentSlotBookingPage />} />
          <Route path="/student/viva/:id" element={<StudentVivaPage />} />
          <Route path="/student/results" element={<StudentResultsListPage />} />
          <Route path="/student/results/:id" element={<StudentResultsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
