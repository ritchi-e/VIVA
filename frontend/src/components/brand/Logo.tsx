import markUrl from '@/assets/mokhik-mark.png'
import wordmarkUrl from '@/assets/mokhik-wordmark.png'
import stackedUrl from '@/assets/mokhik-logo.png'
import { cn } from '@/lib/utils'

export const BRAND_NAME = 'Mokhik'

export function LogoMark({ className }: { className?: string }) {
  return <img src={markUrl} alt="" aria-hidden className={cn('h-8 w-auto', className)} />
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string
  markClassName?: string
  wordmarkClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src={markUrl} alt="" aria-hidden className={cn('h-8 w-auto', markClassName)} />
      <img src={wordmarkUrl} alt={BRAND_NAME} className={cn('h-5 w-auto', wordmarkClassName)} />
    </span>
  )
}

export function LogoStacked({ className }: { className?: string }) {
  return <img src={stackedUrl} alt={BRAND_NAME} className={cn('h-24 w-auto', className)} />
}
