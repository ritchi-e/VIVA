import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const styles = {
  info: {
    wrap: 'border-[var(--color-border)] bg-[var(--color-sidebar-active)] text-[var(--color-foreground)]',
    icon: Info,
  },
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: CheckCircle2,
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: TriangleAlert,
  },
  danger: {
    wrap: 'border-red-200 bg-red-50 text-red-900',
    icon: AlertCircle,
  },
} as const

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof styles
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const cfg = styles[tone]
  const Icon = cfg.icon
  return (
    <div
      role="status"
      className={cn(
        'flex gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-sm',
        cfg.wrap,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  )
}
