import markUrl from '@/assets/mokhik-mark.png'
import wordmarkUrl from '@/assets/mokhik-wordmark.png'
import stackedUrl from '@/assets/mokhik-logo.png'
import markLightUrl from '@/assets/mokhik-mark-light.png'
import wordmarkLightUrl from '@/assets/mokhik-wordmark-light.png'
import { cn } from '@/lib/utils'

export const BRAND_NAME = 'Mokhik'

/** Inverted lockup for dark surfaces: near-white wordmark, mint accent in the mark. */
export function LogoLight({
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
      <img src={markLightUrl} alt="" aria-hidden className={cn('h-8 w-auto', markClassName)} />
      <img src={wordmarkLightUrl} alt={BRAND_NAME} className={cn('h-[17px] w-auto', wordmarkClassName)} />
    </span>
  )
}

export function LogoMarkLight({ className }: { className?: string }) {
  return <img src={markLightUrl} alt="" aria-hidden className={cn('h-8 w-auto', className)} />
}

export function WordmarkLight({ className }: { className?: string }) {
  return <img src={wordmarkLightUrl} alt={BRAND_NAME} className={cn('h-5 w-auto', className)} />
}

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
