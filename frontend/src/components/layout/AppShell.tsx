import type { ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Award,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mic,
  Settings,
  Shield,
  Users,
} from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import wordmarkUrl from '@/assets/mokhik-wordmark.png'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> }

const instructorNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/submissions', label: 'Submissions', icon: FileText },
  { to: '/viva-sessions', label: 'Viva sessions', icon: Mic },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/reports', label: 'Reports', icon: GraduationCap },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const studentNav: NavItem[] = [
  { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/student/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/student/results', label: 'Results', icon: Award },
]

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-teal-50 text-teal-900 shadow-sm ring-1 ring-teal-100'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0 opacity-80" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell({ variant }: { variant: 'instructor' | 'student' }) {
  const { user, activeMembership, memberships, logout, setActiveOrganization, isOrgAdmin } = useAuth()
  const navigate = useNavigate()
  const nav =
    variant === 'student'
      ? studentNav
      : isOrgAdmin
        ? [...instructorNav, { to: '/admin', label: 'Admin', icon: Shield }]
        : instructorNav

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-r border-[var(--color-border)] bg-white/90 backdrop-blur-sm">
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--color-border)] px-5">
          <LogoMark className="h-8" />
          <div>
            <img src={wordmarkUrl} alt="Mokhik" className="h-[15px] w-auto" />
            <p className="mt-0.5 text-[11px] text-slate-500">
              {variant === 'student' ? 'Student' : 'Instructor'}
            </p>
          </div>
        </div>
        <div className="p-3">
          <NavItems items={nav} />
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-white/80 px-4 backdrop-blur-sm sm:px-6">
          <div className="text-sm font-medium text-slate-600">
            {activeMembership?.organization_name ?? 'Organization'}
          </div>
          <div className="flex items-center gap-3">
            {memberships.length > 1 ? (
              <select
                className="rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm"
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
            <span className="hidden text-sm text-slate-700 sm:inline">
              {user?.full_name || user?.email}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-7 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
