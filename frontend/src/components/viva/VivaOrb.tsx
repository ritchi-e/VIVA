import { cn } from '@/lib/utils'

export type VivaPhase =
  | 'connecting'
  | 'preparing'
  | 'speaking'
  | 'listening'
  | 'processing'
  | 'complete'
  | 'error'

const phaseColors: Record<VivaPhase, { a: string; b: string; c: string }> = {
  connecting: { a: 'from-slate-400', b: 'from-blue-400', c: 'from-violet-400' },
  preparing: { a: 'from-amber-300', b: 'from-orange-400', c: 'from-rose-400' },
  speaking: { a: 'from-blue-400', b: 'from-indigo-500', c: 'from-violet-500' },
  listening: { a: 'from-emerald-400', b: 'from-teal-400', c: 'from-cyan-400' },
  processing: { a: 'from-violet-400', b: 'from-fuchsia-400', c: 'from-pink-400' },
  complete: { a: 'from-green-400', b: 'from-emerald-500', c: 'from-teal-400' },
  error: { a: 'from-red-400', b: 'from-orange-400', c: 'from-rose-500' },
}

interface VivaOrbProps {
  phase: VivaPhase
  className?: string
}

export function VivaOrb({ phase, className }: VivaOrbProps) {
  const colors = phaseColors[phase]
  const pulse =
    phase === 'speaking' || phase === 'listening' || phase === 'processing' || phase === 'preparing'

  return (
    <div className={cn('relative flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72', className)}>
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-br opacity-30 blur-3xl',
          colors.a,
          pulse && 'animate-pulse',
        )}
      />
      <div
        className={cn(
          'absolute h-40 w-40 animate-[spin_12s_linear_infinite] rounded-full bg-gradient-to-tr opacity-50 blur-2xl sm:h-52 sm:w-52',
          colors.b,
        )}
      />
      <div
        className={cn(
          'absolute h-32 w-32 animate-[spin_18s_linear_infinite_reverse] rounded-full bg-gradient-to-bl opacity-60 blur-xl sm:h-44 sm:w-44',
          colors.c,
        )}
      />
      <div
        className={cn(
          'relative z-10 flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md sm:h-36 sm:w-36',
          pulse && 'animate-[pulse_2s_ease-in-out_infinite]',
        )}
      >
        <div
          className={cn(
            'relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 sm:h-20 sm:w-20',
            phase === 'listening' && 'from-emerald-400 to-teal-500',
            phase === 'processing' && 'from-violet-400 to-fuchsia-500',
            phase === 'complete' && 'from-green-400 to-emerald-500',
          )}
        />
      </div>
    </div>
  )
}

export function phaseLabel(phase: VivaPhase): string {
  switch (phase) {
    case 'connecting':
      return 'Connecting…'
    case 'preparing':
      return 'Preparing your viva…'
    case 'speaking':
      return 'Examiner is speaking…'
    case 'listening':
      return 'Listening to your answer…'
    case 'processing':
      return 'Examiner is thinking…'
    case 'complete':
      return 'Viva complete'
    case 'error':
      return 'Something went wrong'
    default:
      return ''
  }
}
