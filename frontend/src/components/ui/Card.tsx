import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string
  children: ReactNode
  hover?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]',
        'shadow-[var(--shadow-card)]',
        hover && 'mk-card-hover',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-base text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>
}
