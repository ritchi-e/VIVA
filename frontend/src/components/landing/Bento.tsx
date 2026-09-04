import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { AudioLines, FileCode2, Gauge, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShineBorder, SpotlightCard } from './fx'
import { NumberTicker, WordReveal } from './text'
import { TYPE } from './tokens'

function CardShell({
  icon: Icon,
  title,
  body,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  body: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full flex-col p-7 sm:p-8', className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--mk-border)] bg-[color:var(--mk-panel)] text-[#2de2b2]">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <h3 className={cn('mt-6', TYPE.h3)}>{title}</h3>
      <p className={cn('mt-3', TYPE.body)}>{body}</p>
      {children ? <div className="mt-auto pt-8">{children}</div> : null}
    </div>
  )
}

/** Evidence trace: a question resolving to the exact symbol it came from. */
function EvidenceTrace() {
  return (
    <div className="rounded-2xl border border-[color:var(--mk-border-8)] bg-[color:var(--mk-ink-40)] p-4 font-mono text-[11px] leading-relaxed">
      {[
        { label: 'question', value: 'Why invalidate past the edit offset?', tone: 'mk-text-70' },
        { label: 'source', value: 'parser/lexer.py :: TokenCache.invalidate', tone: 'text-[#7ff5d3]' },
        { label: 'commit', value: 'a91f0c3 · 14 lines changed', tone: 'mk-text-40' },
      ].map((row, index) => (
        <motion.div
          key={row.label}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + index * 0.12, duration: 0.5 }}
          className="flex gap-3 py-1"
        >
          <span className="w-16 shrink-0 uppercase tracking-[0.14em] mk-text-25">{row.label}</span>
          <span className={row.tone}>{row.value}</span>
        </motion.div>
      ))}
    </div>
  )
}

/** Micro-interaction: hovering arms the tab-switch grace countdown. */
function GraceCountdown() {
  const [armed, setArmed] = useState(false)
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (!armed) {
      setSeconds(5)
      return
    }
    const timer = window.setInterval(() => {
      setSeconds((value) => (value <= 1 ? 5 : value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [armed])

  const circumference = 2 * Math.PI * 26

  return (
    <button
      type="button"
      onMouseEnter={() => setArmed(true)}
      onMouseLeave={() => setArmed(false)}
      onFocus={() => setArmed(true)}
      onBlur={() => setArmed(false)}
      className="flex w-full items-center gap-4 text-left"
    >
      <span className="relative flex h-16 w-16 items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--mk-border)" strokeWidth="3" />
          <motion.circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke={armed ? '#f59e0b' : '#2de2b2'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference * (1 - seconds / 5) }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        </svg>
        <span className={cn('font-display text-lg font-semibold', armed ? 'text-amber-300' : 'mk-text-70')}>
          {armed ? seconds : '5s'}
        </span>
      </span>
      <span className="text-xs leading-relaxed mk-text-45">
        {armed ? 'Return to the window or the session ends and the instructor is notified.' : 'Hover to arm the grace window.'}
      </span>
    </button>
  )
}

/** Live-feel waveform reacting on hover. */
function Waveform() {
  const bars = Array.from({ length: 28 })
  return (
    <div className="group/wave flex h-16 items-end gap-1">
      {bars.map((_, index) => (
        <motion.span
          key={index}
          className="flex-1 rounded-full bg-gradient-to-t from-[#0ebe92]/30 to-[#7ff5d3]"
          animate={{ height: [`${12 + ((index * 37) % 40)}%`, `${30 + ((index * 53) % 65)}%`, `${16 + ((index * 29) % 45)}%`] }}
          transition={{
            duration: 1.6 + (index % 5) * 0.22,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

function RubricBars() {
  const rows = [
    { label: 'Correctness', value: 86 },
    { label: 'Depth of reasoning', value: 74 },
    { label: 'Code ownership', value: 92 },
  ]
  return (
    <div className="space-y-3.5">
      {rows.map((row, index) => (
        <div key={row.label}>
          <div className="flex justify-between text-[11px] mk-text-45">
            <span>{row.label}</span>
            <span className="tabular-nums mk-text-70">{(row.value / 10).toFixed(1)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#0ebe92] to-[#7ff5d3]"
              initial={{ width: 0 }}
              whileInView={{ width: `${row.value}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, delay: 0.2 + index * 0.14, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function BentoGrid() {
  return (
    <div className="mt-16 grid gap-5 lg:grid-cols-3">
      <SpotlightCard className="lg:col-span-2">
        <CardShell
          icon={FileCode2}
          title="Every question traced to their code"
          body="The planner reads the repository, drafts candidate questions, then throws away anything it cannot anchor to a real file, symbol, or commit. What survives is what gets asked."
        >
          <EvidenceTrace />
        </CardShell>
      </SpotlightCard>

      <ShineBorder className="h-full" duration={9}>
        <div className="flex h-full flex-col justify-between rounded-[27px] border border-[#2de2b2]/30 bg-[color:var(--mk-featured-bg)] p-8 shadow-[0_24px_60px_-36px_rgba(14,190,146,0.45)]">
          <p className={cn(TYPE.eyebrow, 'text-[color:var(--mk-featured-soft)]')}>Grounding rate</p>
          <div>
            <p className="font-display text-[4.5rem] font-semibold leading-none tracking-[-0.05em] text-[color:var(--mk-featured-fg)]">
              <NumberTicker value={100} suffix="%" />
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--mk-featured-muted)]">
              of shipped questions cite a location in the submission. Ungrounded drafts never reach the student.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[color:var(--mk-featured-soft)]">
            <Gauge className="h-3.5 w-3.5 text-[#2de2b2]" />
            <WordReveal text="Checked at plan time and again live" />
          </div>
        </div>
      </ShineBorder>

      <SpotlightCard spotlight="rgba(245,158,11,0.12)">
        <CardShell
          icon={ShieldCheck}
          title="Integrity, not surveillance theatre"
          body="Leaving the exam window arms a short countdown. Come back and nothing happens; don't, and the session closes with a report."
        >
          <GraceCountdown />
        </CardShell>
      </SpotlightCard>

      <SpotlightCard>
        <CardShell
          icon={AudioLines}
          title="Speech tuned to your syllabus"
          body="Transcription is primed with repository symbols and course vocabulary, so domain terms land accurately the first time."
        >
          <Waveform />
        </CardShell>
      </SpotlightCard>

      <SpotlightCard>
        <CardShell
          icon={Gauge}
          title="Scores you can defend"
          body="Each criterion carries the transcript excerpt that earned it, so a grade is never just a number."
        >
          <RubricBars />
        </CardShell>
      </SpotlightCard>
    </div>
  )
}
