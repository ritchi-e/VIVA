import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'

export type StudentActionKind = 'submit' | 'wait' | 'book' | 'join' | 'start' | 'results' | 'retry'

export function StudentAssessmentCard({
  title,
  dueAt,
  statusLabel,
  statusKind,
  statusValue,
  estimate = 'About 10–15 minutes',
  primaryLabel,
  primaryTo,
  onPrimary,
  primaryLoading,
  secondaryLabel,
  secondaryTo,
}: {
  title: string
  dueAt?: string | null
  statusLabel: string
  statusKind?: 'submission' | 'viva' | 'assignment' | 'assessment' | 'booking'
  statusValue?: string | null
  estimate?: string
  primaryLabel: string
  primaryTo?: string
  onPrimary?: () => void
  primaryLoading?: boolean
  secondaryLabel?: string
  secondaryTo?: string
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-[var(--color-foreground)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {dueAt ? `Due ${formatDate(dueAt)}` : 'No due date'}
            {' · '}
            {estimate}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {statusKind && statusValue ? <StatusBadge kind={statusKind} value={statusValue} /> : null}
            <span className="text-sm text-[var(--color-muted)]">{statusLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryLabel && secondaryTo ? (
            <Link to={secondaryTo}>
              <Button variant="secondary">{secondaryLabel}</Button>
            </Link>
          ) : null}
          {primaryTo ? (
            <Link to={primaryTo}>
              <Button>{primaryLabel}</Button>
            </Link>
          ) : (
            <Button loading={primaryLoading} onClick={onPrimary}>
              {primaryLabel}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
