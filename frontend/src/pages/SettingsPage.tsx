import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function SettingsPage() {
  const { user, activeMembership, memberships } = useAuth()

  return (
    <div>
      <PageHeader title="Settings" description="Your profile and organization memberships." />
      <Card className="mb-4">
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-900">Name:</span> {user?.full_name || '—'}
          </p>
          <p>
            <span className="font-medium text-slate-900">Email:</span> {user?.email}
          </p>
          <p>
            <span className="font-medium text-slate-900">Active organization:</span>{' '}
            {activeMembership?.organization_name || '—'}
          </p>
          <p>
            <span className="font-medium text-slate-900">Role:</span>{' '}
            <Badge>{activeMembership?.role?.replace(/_/g, ' ') || '—'}</Badge>
          </p>
        </CardBody>
      </Card>
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
    </div>
  )
}
