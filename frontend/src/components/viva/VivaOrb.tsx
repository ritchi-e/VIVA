import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { VIVA_PHASE_COPY, type ProgressCopy } from '@/lib/progressCopy'

export type VivaPhase =
  | 'connecting'
  | 'preparing'
  | 'speaking'
  | 'listening'
  | 'processing'
  | 'complete'
  | 'terminated'
  | 'error'

const phaseColors: Record<VivaPhase, { glow: string; ring: string; core: string }> = {
  connecting: {
    glow: 'bg-slate-400/30',
    ring: 'from-slate-300/40 via-teal-400/30 to-cyan-500/20',
    core: 'from-slate-300 to-teal-500',
  },
  preparing: {
    glow: 'bg-teal-400/25',
    ring: 'from-teal-300/40 via-cyan-400/30 to-slate-400/20',
    core: 'from-teal-400 to-cyan-600',
  },
  speaking: {
    glow: 'bg-cyan-400/30',
    ring: 'from-cyan-300/50 via-teal-400/35 to-sky-500/25',
    core: 'from-cyan-400 to-teal-600',
  },
  listening: {
    glow: 'bg-emerald-400/30',
    ring: 'from-emerald-300/50 via-teal-400/35 to-cyan-400/25',
    core: 'from-emerald-400 to-teal-600',
  },
  processing: {
    glow: 'bg-sky-400/25',
    ring: 'from-sky-300/40 via-teal-400/30 to-slate-400/20',
    core: 'from-sky-400 to-teal-700',
  },
  complete: {
    glow: 'bg-emerald-400/25',
    ring: 'from-emerald-300/40 via-teal-400/30 to-cyan-400/20',
    core: 'from-emerald-400 to-teal-600',
  },
  terminated: {
    glow: 'bg-amber-400/25',
    ring: 'from-amber-300/40 via-orange-400/25 to-slate-400/20',
    core: 'from-amber-400 to-orange-600',
  },
  error: {
    glow: 'bg-rose-400/25',
    ring: 'from-rose-300/40 via-orange-400/25 to-slate-400/20',
    core: 'from-rose-400 to-orange-600',
  },
}

interface VivaOrbProps {
  phase: VivaPhase
  className?: string
}

export function VivaOrb({ phase, className }: VivaOrbProps) {
  const colors = phaseColors[phase]
  const active =
    phase === 'speaking' || phase === 'listening' || phase === 'processing' || phase === 'preparing'

  return (
    <div
      className={cn(
        'relative flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-6 rounded-full blur-3xl',
          colors.glow,
          active && 'animate-viva-breathe',
        )}
      />
      <div
        className={cn(
          'absolute h-44 w-44 rounded-full bg-gradient-to-tr opacity-50 blur-2xl sm:h-56 sm:w-56',
          colors.ring,
          'animate-viva-orbit',
        )}
      />
      <div
        className={cn(
          'absolute h-36 w-36 rounded-full bg-gradient-to-bl opacity-40 blur-xl sm:h-48 sm:w-48',
          colors.ring,
          'animate-viva-orbit-rev',
        )}
      />
      <div
        className={cn(
          'relative z-10 flex h-28 w-28 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-[0_0_40px_rgba(15,118,110,0.35)] backdrop-blur-md sm:h-36 sm:w-36',
          active && 'animate-viva-breathe',
        )}
      >
        <div
          className={cn(
            'h-16 w-16 rounded-full bg-gradient-to-br shadow-inner sm:h-20 sm:w-20',
            colors.core,
          )}
        />
      </div>
    </div>
  )
}

export function phaseCopy(phase: VivaPhase): ProgressCopy & { rotating?: string[] } {
  return VIVA_PHASE_COPY[phase] ?? { title: 'Working…' }
}

/** @deprecated Prefer phaseCopy(phase).title */
export function phaseLabel(phase: VivaPhase): string {
  return phaseCopy(phase).title
}

export function useRotatingDetail(lines: string[] | undefined, intervalMs = 3200): string | undefined {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    setIndex(0)
    if (!lines || lines.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % lines.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [lines, intervalMs])
  if (!lines?.length) return undefined
  return lines[index % lines.length]
}
