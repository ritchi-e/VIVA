import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { coursesApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { cn } from '@/lib/utils'

export function StudentCourseWorkspaceLayout() {
  const { courseId = '' } = useParams()
  const location = useLocation()
  const course = useAsync(() => coursesApi.get(courseId).then((r) => r.data), [courseId])

  if (course.loading) return <ProgressPanel copy={PLATFORM_PROGRESS.courses} />
  if (course.error || !course.data) {
    return <ErrorState message={course.error ?? 'Course not found'} onRetry={course.reload} />
  }

  const c = course.data
  const onViva = /\/viva\/?$/.test(location.pathname)
  const onAssignments = !onViva

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          {c.code}
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-[var(--color-foreground)]">
          {c.title}
        </h1>
      </div>

      <nav
        aria-label="Course sections"
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-1"
      >
        <NavLink
          to={`/student/courses/${courseId}`}
          className={cn(
            'shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition',
            onAssignments
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
          )}
        >
          Assignments
        </NavLink>
        <NavLink
          to={`/student/courses/${courseId}/viva`}
          className={cn(
            'shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition',
            onViva
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
          )}
        >
          Viva
        </NavLink>
      </nav>

      <Outlet context={{ course: c }} />
    </div>
  )
}
