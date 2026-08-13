import { PLATFORM_PROGRESS } from '@/lib/progressCopy'
import { useEffect } from 'react'

const NODES = [
  { cx: 80, cy: 18, delay: '0s' },
  { cx: 142, cy: 80, delay: '0.25s' },
  { cx: 80, cy: 142, delay: '0.5s' },
  { cx: 18, cy: 80, delay: '0.75s' },
  { cx: 124, cy: 36, delay: '1s' },
  { cx: 36, cy: 124, delay: '1.25s' },
]

export function PreparingVivaOverlay({
  title = PLATFORM_PROGRESS.preparingViva.title,
  detail = PLATFORM_PROGRESS.preparingViva.detail,
}: {
  title?: string
  detail?: string
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-teal-950/45 via-slate-950/35 to-cyan-950/40" />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center animate-viva-fade-up">
        <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-6 rounded-full bg-teal-400/20 blur-2xl animate-viva-breathe" />

          <svg viewBox="0 0 160 160" className="relative h-full w-full" aria-hidden>
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="rgba(94,234,212,0.55)"
              strokeWidth="1.5"
              strokeDasharray="8 14"
              className="animate-viva-ring-dash"
            />
            <circle
              cx="80"
              cy="80"
              r="50"
              fill="none"
              stroke="rgba(165,243,252,0.18)"
              strokeWidth="1"
            />
            <g className="animate-viva-arc-spin">
              <circle
                cx="80"
                cy="80"
                r="50"
                fill="none"
                stroke="url(#viva-arc)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="70 244"
              />
            </g>
            <defs>
              <linearGradient id="viva-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5eead4" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {NODES.map((node) => (
              <circle
                key={`${node.cx}-${node.cy}`}
                cx={node.cx}
                cy={node.cy}
                r="3.5"
                fill="#99f6e4"
                className="animate-viva-node-pulse"
                style={{ animationDelay: node.delay }}
              />
            ))}
          </svg>

          <div className="absolute inset-[54px] overflow-hidden rounded-full border border-white/20 bg-slate-950/70 animate-viva-core-glow">
            <div className="absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 bg-gradient-to-b from-transparent via-teal-300/70 to-transparent animate-viva-scan" />
          </div>
        </div>

        <p className="font-display text-xl font-semibold tracking-tight text-white">{title}</p>
        {detail ? (
          <p className="mt-3 text-sm leading-relaxed text-white/70 text-balance">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}
