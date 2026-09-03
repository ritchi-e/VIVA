import type { ReactNode } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="rounded-full bg-[var(--color-sidebar-active)] p-3.5 text-[var(--color-primary)]">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-[var(--color-foreground)]">{title}</p>
          {description ? (
            <p className="mt-1.5 max-w-md text-base text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        {action}
      </CardBody>
    </Card>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="rounded-full bg-red-50 p-3.5 text-[var(--color-danger)]">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-[var(--color-foreground)]">
            Unable to load data
          </p>
          <p className="mt-1.5 max-w-md text-base text-[var(--color-muted)]">{message}</p>
        </div>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </CardBody>
    </Card>
  )
}
