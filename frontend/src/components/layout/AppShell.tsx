import type { ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
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
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
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
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-r border-[var(--color-border)] bg-white">
        <div className="flex h-14 items-center border-b border-[var(--color-border)] px-4">
          <span className="text-sm font-semibold tracking-tight text-slate-900">AI Viva</span>
        </div>
        <div className="p-3">
          <NavItems items={nav} />
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 sm:px-6">
          <div className="text-sm text-slate-500">
            {activeMembership?.organization_name ?? 'Organization'}
          </div>
          <div className="flex items-center gap-3">
            {memberships.length > 1 ? (
              <select
                className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm"
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
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
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
        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
