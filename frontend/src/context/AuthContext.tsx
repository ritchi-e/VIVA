import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  authApi,
  clearStoredTokens,
  getOrganizationId,
  getStoredTokens,
  setOrganizationId,
  setStoredTokens,
  type GoogleAuthPayload,
  type LoginPayload,
  type RegisterPayload,
} from '@/lib/api'
import type { Membership, User, UserRole } from '@/types'

interface AuthContextValue {
  user: User | null
  memberships: Membership[]
  activeMembership: Membership | null
  organizationId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isStudent: boolean
  isInstructor: boolean
  isOrgAdmin: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  loginWithGoogle: (payload: GoogleAuthPayload) => Promise<void>
  logout: () => void
  setActiveOrganization: (membership: Membership) => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function pickMembership(memberships: Membership[], orgId: string | null): Membership | null {
  if (!memberships.length) return null
  if (orgId) {
    const match = memberships.find((m) => m.organization === orgId)
    if (match) return match
  }
  return memberships[0]
}

function isInstructorRole(role: UserRole) {
  return role === 'instructor' || role === 'organization_admin' || role === 'viewer'
}

function isOrgAdminRole(role: UserRole) {
  return role === 'organization_admin'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const applySession = useCallback(
    (nextUser: User, nextMemberships: Membership[], preferredOrg?: string | null) => {
      setUser(nextUser)
      setMemberships(nextMemberships)
      const orgId = preferredOrg ?? getOrganizationId()
      const active = pickMembership(nextMemberships, orgId)
      setActiveMembership(active)
      if (active) setOrganizationId(active.organization)
    },
    [],
  )

  const refreshProfile = useCallback(async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setUser(null)
      setMemberships([])
      setActiveMembership(null)
      return
    }
    const { data } = await authApi.me()
    applySession(data.user, data.memberships)
  }, [applySession])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (getStoredTokens()) await refreshProfile()
      } catch {
        clearStoredTokens()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshProfile])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { data } = await authApi.login(payload)
      setStoredTokens(data.tokens)
      applySession(
        data.user,
        data.memberships,
        data.active_membership?.organization ?? payload.organization_id ?? null,
      )
    },
    [applySession],
  )

  const loginWithGoogle = useCallback(
    async (payload: GoogleAuthPayload) => {
      const { data } = await authApi.google(payload)
      setStoredTokens(data.tokens)
      applySession(
        data.user,
        data.memberships,
        data.active_membership?.organization ?? null,
      )
    },
    [applySession],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { data } = await authApi.register(payload)
      setStoredTokens(data.tokens)
      const membership: Membership = {
        id: '',
        organization: data.organization.id,
        organization_name: data.organization.name,
        organization_slug: data.organization.slug,
        role: data.role as Membership['role'],
        is_active: true,
        created_at: new Date().toISOString(),
      }
      applySession(data.user, [membership], data.organization.id)
    },
    [applySession],
  )

  const logout = useCallback(() => {
    clearStoredTokens()
    setOrganizationId(null)
    setUser(null)
    setMemberships([])
    setActiveMembership(null)
  }, [])

  const setActiveOrganization = useCallback((membership: Membership) => {
    setActiveMembership(membership)
    setOrganizationId(membership.organization)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      activeMembership,
      organizationId: activeMembership?.organization ?? null,
      isLoading,
      isAuthenticated: Boolean(user && getStoredTokens()),
      isStudent: activeMembership?.role === 'student',
      isInstructor: activeMembership ? isInstructorRole(activeMembership.role) : false,
      isOrgAdmin: activeMembership ? isOrgAdminRole(activeMembership.role) : false,
      login,
      register,
      loginWithGoogle,
      logout,
      setActiveOrganization,
      refreshProfile,
    }),
    [
      user,
      memberships,
      activeMembership,
      isLoading,
      login,
      register,
      loginWithGoogle,
      logout,
      setActiveOrganization,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
