import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Award,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Settings,
  Shield,
  Users,
  X,
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

function NavItems({
  items,
  onNavigate,
}: {
  items: NavItem[]
  onNavigate?: () => void
}) {
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-[15px] font-semibold transition duration-150',
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
              <item.icon className="h-5 w-5 shrink-0 opacity-90" />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-5">
      <LogoMark className="h-10" />
      <div className="min-w-0">
        <img src={wordmarkUrl} alt="Mokhik" className="h-[18px] w-auto" />
      </div>
    </div>
  )
}

function SidebarContent({
  nav,
  onNavigate,
}: {
  nav: NavItem[]
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const { logout } = useAuth()

  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Workspace
        </p>
        <NavItems items={nav} onNavigate={onNavigate} />
      </div>
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
    </div>
  )
}

export function AppShell({ variant }: { variant: 'instructor' | 'student' }) {
  const { user, activeMembership, memberships, setActiveOrganization, isOrgAdmin } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav =
    variant === 'student'
      ? studentNav
      : isOrgAdmin
        ? [...instructorNav, { to: '/admin', label: 'Admin', icon: Shield }]
        : instructorNav

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
          <SidebarContent nav={nav} />
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
            <SidebarContent nav={nav} onNavigate={() => setMobileOpen(false)} />
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
