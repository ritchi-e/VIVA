import { useEffect, useState, type FormEvent } from 'react'
import { authApi, getApiErrorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

export function SettingsPage() {
  const { user, activeMembership, memberships, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    setFullName(user?.full_name || '')
  }, [user?.full_name])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setErrorMsg(null)
    try {
      await authApi.updateProfile({ full_name: fullName.trim() })
      await refreshProfile()
      setMessage('Profile updated.')
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const dirty = fullName.trim() !== (user?.full_name || '').trim()

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Your profile and organization memberships." />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {errorMsg ? <Alert tone="danger">{errorMsg}</Alert> : null}

      <Card>
        <CardBody>
          <form className="space-y-3" onSubmit={onSave}>
            <Input
              label="Display name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Email
              </p>
              <p className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-2.5 text-sm text-[var(--color-foreground)]">
                {user?.email}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" loading={saving} disabled={!dirty}>
                Save name
              </Button>
              {activeMembership ? (
                <p className="text-sm text-[var(--color-muted)]">
                  {activeMembership.organization_name} ·{' '}
                  <Badge>{activeMembership.role?.replace(/_/g, ' ') || '—'}</Badge>
                </p>
              ) : null}
            </div>
          </form>
        </CardBody>
      </Card>

      {memberships.length > 0 ? (
        <Card>
          <CardBody>
            <p className="mb-3 text-sm font-medium text-slate-900">Your memberships</p>
            <ul className="space-y-2 text-sm text-slate-700">
              {memberships.map((m) => (
                <li key={m.id || m.organization} className="flex items-center justify-between gap-3">
                  <span>{m.organization_name}</span>
                  <Badge tone={m.organization === activeMembership?.organization ? 'success' : 'default'}>
                    {m.role.replace(/_/g, ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
