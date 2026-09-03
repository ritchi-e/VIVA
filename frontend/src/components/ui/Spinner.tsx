import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProgressCopy } from '@/lib/progressCopy'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-[var(--color-primary)]', className)} />
}

export function LoadingPanel({
  label = 'Working…',
  detail,
  tone = 'light',
}: {
  label?: string
  detail?: string
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 animate-viva-fade-up">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div
          className={cn(
            'absolute inset-0 rounded-full animate-viva-breathe',
            dark ? 'bg-teal-400/20' : 'bg-teal-500/15',
          )}
        />
        <Spinner className={cn('relative h-7 w-7', dark && 'text-teal-200')} />
      </div>
      <div className="max-w-sm text-center">
        <p
          className={cn(
            'font-display text-lg font-semibold tracking-tight',
            dark ? 'text-white' : 'text-[var(--color-foreground)]',
          )}
        >
          {label}
        </p>
        {detail ? (
          <p className={cn('mt-1.5 text-base leading-relaxed', dark ? 'text-white/55' : 'text-[var(--color-muted)]')}>
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function ProgressPanel({
  copy,
  tone = 'light',
}: {
  copy: ProgressCopy
  tone?: 'light' | 'dark'
}) {
  return <LoadingPanel label={copy.title} detail={copy.detail} tone={tone} />
}
