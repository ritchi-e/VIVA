import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { coursesApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { EmptyState, ErrorState } from '@/components/layout/StateViews'
import type { Course, CourseEnrollment } from '@/types'

type CourseStudentsGroup = {
  course: Course
  students: CourseEnrollment[]
}

export function StudentsPage() {
  const courses = useAsync(() => coursesApi.list())
  const grouped = useAsync(async () => {
    const list = await coursesApi.list()
    const groups: CourseStudentsGroup[] = await Promise.all(
      list.map(async (course) => {
        const enrollments = await coursesApi.enrollments(course.id)
        const students = enrollments.filter((e) => e.role === 'student')
        return { course, students }
      }),
    )
    return groups
  }, [])

  const totalStudents = useMemo(
    () => grouped.data?.reduce((sum, g) => sum + g.students.length, 0) ?? 0,
    [grouped.data],
  )

  const loading = courses.loading || grouped.loading
  const error = courses.error || grouped.error
  const reload = () => {
    void courses.reload()
    void grouped.reload()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        description="Students grouped by the courses they have joined."
        actions={
          <Link to="/courses">
            <Button variant="secondary">Courses</Button>
          </Link>
        }
      />

      {loading ? <ProgressPanel copy={PLATFORM_PROGRESS.students} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {!loading && !error && (courses.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create a course and share its join code so students can enroll."
          action={
            <Link to="/courses/new">
              <Button>Create course</Button>
            </Link>
          }
        />
      ) : null}

      {!loading && !error && (courses.data?.length ?? 0) > 0 && totalStudents === 0 ? (
        <EmptyState
          title="No enrolled students yet"
          description="Share each course’s join code or invite link so students can join."
          action={
            <Link to="/courses">
              <Button>Open courses</Button>
            </Link>
          }
        />
      ) : null}

      {!loading && !error
        ? grouped.data?.map(({ course, students }) => (
            <section key={course.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
                  <Link to={`/courses/${course.id}`} className="hover:text-[var(--color-primary)]">
                    {course.code} — {course.title}
                  </Link>
                </h2>
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  {students.length} student{students.length === 1 ? '' : 's'}
                </p>
              </div>

              {students.length === 0 ? (
                <Card>
                  <CardBody className="py-4 text-sm text-[var(--color-muted)]">
                    No students have joined this course yet.
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-2">
                  {students.map((enrollment) => (
                    <Card key={enrollment.id} hover>
                      <CardBody className="py-4">
                        <Link
                          to={`/students/${enrollment.user.id}`}
                          className="text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
                        >
                          {enrollment.user.full_name || enrollment.user.email}
                        </Link>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{enrollment.user.email}</p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))
        : null}
    </div>
  )
}
