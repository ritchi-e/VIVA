/**
 * Single source of truth for the landing page's visual scale.
 * Sections compose these strings instead of hand-writing spacing or radii,
 * so the rhythm stays identical across every block on the page.
 */

export const BRAND = {
  ink: '#030303',
  teal: '#076f65',
  mint: '#0ebe92',
  glow: '#2de2b2',
  iris: '#7dd3fc',
} as const

export const SHELL = 'mx-auto w-full max-w-[1200px] px-6 sm:px-8'

export const SECTION = 'relative py-28 sm:py-36'

export const RADIUS = {
  card: 'rounded-[28px]',
  inner: 'rounded-[20px]',
  pill: 'rounded-full',
  control: 'rounded-2xl',
} as const

export const TYPE = {
  eyebrow: 'text-[11px] font-medium uppercase tracking-[0.32em] text-white/45',
  display:
    'font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.94] tracking-[-0.045em] text-white',
  h2: 'font-display text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white',
  h3: 'font-display text-xl font-semibold tracking-[-0.02em] text-white',
  lead: 'text-base leading-[1.7] text-white/55 sm:text-lg',
  body: 'text-sm leading-[1.75] text-white/50',
  mono: 'font-mono text-[11px] uppercase tracking-[0.18em]',
} as const

/** Frosted panel used by every card on the page. */
export const SURFACE =
  'border border-white/8 bg-white/[0.025] backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_30px_80px_-40px_rgba(0,0,0,0.9)]'

export const HAIRLINE = 'border-white/8'
