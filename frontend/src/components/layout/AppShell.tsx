import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, LogOut, Menu, Plus, Settings, Shield, UserPlus, X } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import wordmarkUrl from '@/assets/mokhik-wordmark.png'
import { useAuth } from '@/context/AuthContext'
import { coursesApi } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/utils'
import type { Course } from '@/types'

function SidebarBrand() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-5 sm:h-16">
      <LogoMark className="h-9 sm:h-10" />
      <div className="min-w-0">
        <img src={wordmarkUrl} alt="Mokhik" className="h-[18px] w-auto" />
      </div>
    </div>
  )
}

function HomeNavLink({ to, onNavigate }: { to: string; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[15px] font-semibold transition duration-150',
          isActive
            ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
            : 'text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-foreground)]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)] transition',
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
            )}
          />
          <Home className="h-5 w-5 shrink-0 opacity-90" />
          Home
        </>
      )}
    </NavLink>
  )
}

function CourseNavList({
  courses,
  activeCourseId,
  basePath,
  onNavigate,
}: {
  courses: Course[]
  activeCourseId?: string
  basePath: string
  onNavigate?: () => void
}) {
  return (
    <nav className="space-y-0.5" aria-label="Courses">
      {courses.map((course) => {
        const active = activeCourseId === course.id
        return (
          <NavLink
            key={course.id}
            to={`${basePath}/${course.id}`}
            onClick={onNavigate}
            title={`${course.code} — ${course.title}`}
            className={cn(
              'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[14px] font-semibold transition duration-150',
              active
                ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                : 'text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-foreground)]',
            )}
          >
            <span
              className={cn(
                'absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)] transition',
                active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
              )}
            />
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase tracking-wide',
                active
                  ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {course.code.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1 truncate">{course.title}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function SignOutButton({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  return (
    <div className="border-t border-[var(--color-border)] p-3">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-[15px] font-semibold text-[var(--color-muted)] transition hover:bg-slate-50 hover:text-[var(--color-foreground)]"
        onClick={() => {
          onNavigate?.()
          logout()
          navigate('/login')
        }}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        Sign out
      </button>
    </div>
  )
}

function InstructorSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isOrgAdmin, activeMembership } = useAuth()
  const location = useLocation()
  const courses = useAsync(
    () => coursesApi.list(),
    [activeMembership?.organization ?? '', location.pathname.startsWith('/courses/new') ? 'new' : 'list'],
  )

  const pathParts = location.pathname.split('/')
  const activeCourseId =
    pathParts[1] === 'courses' && pathParts[2] && pathParts[2] !== 'new'
      ? pathParts[2]
      : undefined

  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Workspace
        </p>
        <HomeNavLink to="/dashboard" onNavigate={onNavigate} />

        <div className="mt-5 mb-2 flex items-center justify-between px-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Classes
          </p>
          <Link
            to="/courses/new"
            onClick={onNavigate}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--color-primary)]"
            aria-label="Create course"
            title="Create course"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>

        {courses.loading ? (
          <p className="px-3 py-2 text-sm text-[var(--color-muted)]">Loading…</p>
        ) : null}
        {courses.error ? (
          <button
            type="button"
            className="px-3 py-2 text-left text-sm text-[var(--color-danger)]"
            onClick={() => void courses.reload()}
          >
            Couldn’t load classes. Retry
          </button>
        ) : null}
        {!courses.loading && !courses.error && (courses.data?.length ?? 0) === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--color-muted)]">No classes yet</p>
        ) : null}
        {courses.data ? (
          <CourseNavList
            courses={courses.data}
            activeCourseId={activeCourseId}
            basePath="/courses"
            onNavigate={onNavigate}
          />
        ) : null}

        <div className="mt-5 space-y-0.5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Account
          </p>
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[15px] font-semibold transition duration-150',
                isActive
                  ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-foreground)]',
              )
            }
          >
            <Settings className="h-5 w-5 shrink-0 opacity-90" />
            Settings
          </NavLink>
          {isOrgAdmin ? (
            <NavLink
              to="/admin"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[15px] font-semibold transition duration-150',
                  isActive
                    ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                    : 'text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-foreground)]',
                )
              }
            >
              <Shield className="h-5 w-5 shrink-0 opacity-90" />
              Admin
            </NavLink>
          ) : null}
        </div>
      </div>
      <SignOutButton onNavigate={onNavigate} />
    </div>
  )
}

function StudentSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { activeMembership } = useAuth()
  const location = useLocation()
  const courses = useAsync(
    () => coursesApi.list(),
    [activeMembership?.organization ?? '', location.pathname.includes('/join') ? 'join' : 'list'],
  )

  const pathParts = location.pathname.split('/')
  const activeCourseId =
    pathParts[1] === 'student' && pathParts[2] === 'courses' && pathParts[3]
      ? pathParts[3]
      : undefined

  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Workspace
        </p>
        <HomeNavLink to="/student/dashboard" onNavigate={onNavigate} />

        <div className="mt-5 mb-2 flex items-center justify-between px-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Classes
          </p>
          <Link
            to="/student/join"
            onClick={onNavigate}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--color-primary)]"
            aria-label="Join course"
            title="Join course"
          >
            <UserPlus className="h-4 w-4" />
          </Link>
        </div>

        {courses.loading ? (
          <p className="px-3 py-2 text-sm text-[var(--color-muted)]">Loading…</p>
        ) : null}
        {courses.error ? (
          <button
            type="button"
            className="px-3 py-2 text-left text-sm text-[var(--color-danger)]"
            onClick={() => void courses.reload()}
          >
            Couldn’t load classes. Retry
          </button>
        ) : null}
        {!courses.loading && !courses.error && (courses.data?.length ?? 0) === 0 ? (
          <div className="px-3 py-2">
            <p className="text-sm text-[var(--color-muted)]">No classes yet</p>
            <Link
              to="/student/join"
              onClick={onNavigate}
              className="mt-2 inline-flex text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Join a course
            </Link>
          </div>
        ) : null}
        {courses.data ? (
          <CourseNavList
            courses={courses.data}
            activeCourseId={activeCourseId}
            basePath="/student/courses"
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
      <SignOutButton onNavigate={onNavigate} />
    </div>
  )
}

export function AppShell({ variant }: { variant: 'instructor' | 'student' }) {
  const { user, activeMembership, memberships, setActiveOrganization } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-[var(--color-border)] bg-[var(--color-sidebar)] lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            background:
              'radial-gradient(ellipse 90% 50% at 0% 0%, rgba(14, 190, 146, 0.08), transparent 55%)',
          }}
        />
        <div className="relative flex h-full flex-col">
          {variant === 'instructor' ? <InstructorSidebar /> : <StudentSidebar />}
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-mk-drawer relative flex h-full w-[min(288px,88vw)] flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {variant === 'instructor' ? (
              <InstructorSidebar onNavigate={() => setMobileOpen(false)} />
            ) : (
              <StudentSidebar onNavigate={() => setMobileOpen(false)} />
            )}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white/90 px-4 backdrop-blur-md sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex rounded-[var(--radius-control)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-sidebar-active)] hover:text-[var(--color-primary)] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="truncate text-[15px] font-semibold text-[var(--color-foreground)]">
              {activeMembership?.organization_name ?? 'Organization'}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {memberships.length > 1 ? (
              <select
                className="mk-focus-ring max-w-[160px] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-sidebar-active)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-primary)] sm:max-w-none"
                value={activeMembership?.organization ?? ''}
                onChange={(e) => {
                  const m = memberships.find((x) => x.organization === e.target.value)
                  if (m) setActiveOrganization(m)
                }}
              >
                {memberships.map((m) => (
                  <option key={m.id || m.organization} value={m.organization}>
                    {m.organization_name}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="hidden max-w-[200px] truncate rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 sm:inline">
              {user?.full_name || user?.email}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1280px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
