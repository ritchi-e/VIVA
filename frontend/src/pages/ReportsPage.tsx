import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

/** Reports content moved into Dashboard “Needs attention” + session lists. */
export function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Completion and review signals now live on the Dashboard for faster decisions."
      />
      <Alert
        tone="info"
        title="Use Dashboard for day-to-day review"
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard">
              <Button>Open dashboard</Button>
            </Link>
            <Link to="/submissions?review=pending">
              <Button variant="secondary">Needs review</Button>
            </Link>
            <Link to="/viva-sessions">
              <Button variant="secondary">Viva sessions</Button>
            </Link>
          </div>
        }
      >
        Charts remain available for admins who need historical browsing via viva sessions.
      </Alert>
      <Card>
        <CardBody className="text-sm text-[var(--color-muted)]">
          For session-level detail, open{' '}
          <Link className="mk-link" to="/viva-sessions">
            viva sessions
          </Link>
          . For grading decisions, use{' '}
          <Link className="mk-link" to="/submissions">
            Review
          </Link>
          .
        </CardBody>
      </Card>
    </div>
  )
}
