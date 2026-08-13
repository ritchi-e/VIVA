import { useMemo, useState, type FormEvent } from 'react'
import { adminApi, getApiErrorMessage, getOrganizationId, type AiUsageMetrics, type MembershipRecord } from '@/lib/api'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { ErrorState } from '@/components/layout/StateViews'
import { formatDate } from '@/lib/utils'

interface AuditEntry {
  id: string
  actor_email?: string
  action: string
  resource_type: string
  resource_id: string
  created_at: string
}

export function AdminPage() {
  const { isOrgAdmin, organizationId } = useAuth()
  const orgId = organizationId || getOrganizationId() || ''
  const audit = useAsync(() => adminApi.auditLog())
  const memberships = useAsync(
    () => (orgId ? adminApi.memberships(orgId) : Promise.resolve([] as MembershipRecord[])),
    [orgId],
  )
  const usage = useAsync(
    () => (isOrgAdmin ? adminApi.aiUsage().then((r) => r.data) : Promise.resolve(null as AiUsageMetrics | null)),
    [isOrgAdmin],
  )

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('student')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const entries: AuditEntry[] = useMemo(() => {
    const data = audit.data
    return Array.isArray(data) ? (data as AuditEntry[]) : ((data as { results?: AuditEntry[] })?.results ?? [])
  }, [audit.data])

  const addMember = async (e: FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setSaving(true)
    setMessage(null)
    try {
      await adminApi.addMembership(orgId, { user_email: email, role, is_active: true })
      setEmail('')
      setMessage('Member added.')
      await memberships.reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const setMemberActive = async (membershipId: string, is_active: boolean) => {
    setSaving(true)
    setMessage(null)
    try {
      await adminApi.updateMembership(membershipId, { is_active })
      await memberships.reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const changeRole = async (membershipId: string, nextRole: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await adminApi.updateMembership(membershipId, { role: nextRole })
      await memberships.reload()
    } catch (err) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" description="Members, AI usage, and audit activity for your organization." />

      {!isOrgAdmin ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600">
              Membership and AI usage management require the organization admin role. You can still view the audit log.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {isOrgAdmin ? (
        <Card>
          <CardHeader title="Organization members" />
          <CardBody className="space-y-4">
            {memberships.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
            {memberships.error ? <ErrorState message={memberships.error} onRetry={memberships.reload} /> : null}
            <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" onSubmit={addMember}>
              <Input
                label="User email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="student@example.com"
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="organization_admin">Org admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" loading={saving}>
                  Add member
                </Button>
              </div>
            </form>
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">User</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(memberships.data || []).map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{m.user?.full_name || m.user?.email || '—'}</div>
                        <div className="text-xs text-slate-500">{m.user?.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          className="rounded border px-2 py-1 text-sm"
                          value={m.role}
                          disabled={saving}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                        >
                          <option value="student">Student</option>
                          <option value="instructor">Instructor</option>
                          <option value="organization_admin">Org admin</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={m.is_active ? 'success' : 'default'}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          disabled={saving}
                          onClick={() => setMemberActive(m.id, !m.is_active)}
                        >
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {isOrgAdmin ? (
        <Card>
          <CardHeader title="AI usage" />
          <CardBody>
            {usage.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
            {usage.error ? <ErrorState message={usage.error} onRetry={usage.reload} /> : null}
            {usage.data ? (
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-sm text-slate-500">Requests</p>
                  <p className="mt-1 text-2xl font-semibold">{usage.data.totals.requests}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Input tokens</p>
                  <p className="mt-1 text-2xl font-semibold">{usage.data.totals.input_tokens}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Output tokens</p>
                  <p className="mt-1 text-2xl font-semibold">{usage.data.totals.output_tokens}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Est. cost (USD)</p>
                  <p className="mt-1 text-2xl font-semibold">{usage.data.totals.estimated_cost_usd}</p>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Audit log" />
        <CardBody>
          {audit.loading ? <ProgressPanel copy={PLATFORM_PROGRESS.dashboard} /> : null}
          {audit.error ? <ErrorState message={audit.error} onRetry={audit.reload} /> : null}
          {entries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Actor</th>
                    <th className="py-2 pr-4 font-medium">Action</th>
                    <th className="py-2 pr-4 font-medium">Resource</th>
                    <th className="py-2 font-medium">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap py-3 pr-4">{formatDate(entry.created_at)}</td>
                      <td className="py-3 pr-4">{entry.actor_email || '—'}</td>
                      <td className="py-3 pr-4">{entry.action}</td>
                      <td className="py-3 pr-4">{entry.resource_type}</td>
                      <td className="py-3 font-mono text-xs">{entry.resource_id?.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !audit.loading && <p className="text-sm text-slate-600">No audit events recorded yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
