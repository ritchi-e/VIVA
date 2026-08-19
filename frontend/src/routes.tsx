import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { AssignmentsPage } from '@/pages/AssignmentsPage'
import { AssignmentDetailPage } from '@/pages/AssignmentDetailPage'
import { AssignmentRubricPage } from '@/pages/AssignmentRubricPage'
import { AssignmentSettingsPage } from '@/pages/AssignmentSettingsPage'
import { SubmissionsPage } from '@/pages/SubmissionsPage'
import { SubmissionDetailPage } from '@/pages/SubmissionDetailPage'
import { VivaSessionsPage } from '@/pages/VivaSessionsPage'
import { VivaSessionDetailPage } from '@/pages/VivaSessionDetailPage'
import { StudentsPage } from '@/pages/StudentsPage'
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
import { HomeRedirect } from '@/components/auth/HomeRedirect'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute instructorOnly />}>
        <Route element={<AppShell variant="instructor" />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/assignments/:id/rubric" element={<AssignmentRubricPage />} />
          <Route path="/assignments/:id/settings" element={<AssignmentSettingsPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
          <Route path="/viva-sessions" element={<VivaSessionsPage />} />
          <Route path="/viva-sessions/:id" element={<VivaSessionDetailPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute studentOnly />}>
        <Route element={<AppShell variant="student" />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/assignments" element={<StudentAssignmentsPage />} />
          <Route path="/student/assignments/:id" element={<StudentAssignmentDetailPage />} />
          <Route path="/student/submissions/:id" element={<StudentSubmissionPage />} />
          <Route path="/student/assignments/:id/book-slot" element={<StudentSlotBookingPage />} />
          <Route path="/student/viva/:id" element={<StudentVivaPage />} />
          <Route path="/student/results/:id" element={<StudentResultsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
