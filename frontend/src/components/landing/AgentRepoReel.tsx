import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { FileCode2, FolderGit2, Mic, Pause, Play, Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'scan' | 'open' | 'find' | 'ask' | 'hold'

const PHASES: { id: Phase; label: string; ms: number }[] = [
  { id: 'scan', label: 'Scanning repo', ms: 3200 },
  { id: 'open', label: 'Opening train.py', ms: 2200 },
  { id: 'find', label: 'Locating evidence', ms: 3800 },
  { id: 'ask', label: 'Asking viva question', ms: 5200 },
  { id: 'hold', label: 'Grounded', ms: 1800 },
]

const FILES = [
  { name: 'README.md', kind: 'doc' as const },
  { name: 'src/model.py', kind: 'code' as const },
  { name: 'src/train.py', kind: 'code' as const, target: true },
  { name: 'src/early_stop.py', kind: 'code' as const },
  { name: 'notebooks/analysis.ipynb', kind: 'doc' as const },
  { name: 'docs/report.pdf', kind: 'doc' as const },
]

const CODE_LINES = [
  { n: 84, text: 'def train_epoch(model, loader):', hot: false },
  { n: 85, text: '    for batch in loader:', hot: false },
  { n: 86, text: '        loss = criterion(model(batch))', hot: false },
  { n: 87, text: '        if early_stop.on_plateau(loss):', hot: true },
  { n: 88, text: '            break  # stop before overfit', hot: true },
  { n: 89, text: '        optim.step()', hot: false },
  { n: 90, text: '    return loss.item()', hot: false },
]

const QUESTION =
  'Why stop training when validation loss plateaus — and what fails if you don’t?'

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Cinematic product reel: agent searches a student GitHub repo, opens train.py,
 * locks onto early-stopping evidence, then asks the grounded viva question.
 */
export function AgentRepoReel({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { amount: 0.35 })
  const [playing, setPlaying] = useState(true)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [typedChars, setTypedChars] = useState(0)
  const [scanCursor, setScanCursor] = useState(0)
  const elapsedRef = useRef(0)

  const totalMs = PHASES.reduce((sum, phase) => sum + phase.ms, 0)
  const phase = PHASES[phaseIndex]?.id ?? 'scan'
  const phaseMeta = PHASES[phaseIndex]

  useEffect(() => {
    if (!inView || !playing) return
    const started = performance.now() - elapsedRef.current
    let raf = 0

    const tick = (now: number) => {
      const next = (now - started) % totalMs
      elapsedRef.current = next
      setElapsed(next)

      let cursor = 0
      let index = 0
      for (let i = 0; i < PHASES.length; i++) {
        if (next < cursor + PHASES[i].ms) {
          index = i
          break
        }
        cursor += PHASES[i].ms
        index = i
      }
      setPhaseIndex(index)

      if (PHASES[index].id === 'scan') {
        const local = next - cursor
        setScanCursor(Math.min(FILES.length - 1, Math.floor(local / 480)))
      }

      if (PHASES[index].id === 'ask') {
        const local = next - cursor
        const progress = Math.min(1, Math.max(0, (local - 400) / 2800))
        setTypedChars(Math.floor(progress * QUESTION.length))
      } else if (PHASES[index].id === 'hold') {
        setTypedChars(QUESTION.length)
      } else {
        setTypedChars(0)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, playing, totalMs])

  const showEditor = phase === 'open' || phase === 'find' || phase === 'ask' || phase === 'hold'
  const showHighlight = phase === 'find' || phase === 'ask' || phase === 'hold'
  const showQuestion = phase === 'ask' || phase === 'hold'
  const targetIndex = FILES.findIndex((file) => file.target)

  return (
    <div
      ref={rootRef}
      className={cn(
        'overflow-hidden rounded-[28px] border border-[color:var(--mk-border-8)] bg-[color:var(--mk-panel-soft)] shadow-[0_30px_80px_-48px_rgba(0,0,0,0.45)] backdrop-blur-xl',
        className,
      )}
    >
      {/* Player chrome */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--mk-border-6)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#0ebe92]/15">
            <Sparkles className="h-3.5 w-3.5 text-[#2de2b2]" />
            {playing ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-[#2de2b2]/20" />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium mk-text">Mokhik agent · viva prep</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] mk-text-35">
              {phaseMeta.label}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? 'Pause demo' : 'Play demo'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--mk-border)] bg-[color:var(--mk-panel)] mk-text-70 transition hover:text-[color:var(--mk-nav-hover)]"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 pl-0.5" />}
        </button>
      </div>

      <div className="relative grid min-h-[420px] lg:min-h-[460px] lg:grid-cols-[0.9fr_1.25fr]">
        {/* Repo pane */}
        <div className="border-b border-[color:var(--mk-border-6)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[color:var(--mk-border-8)] bg-[color:var(--mk-ink-40)] px-3 py-2.5">
            <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-[#2de2b2]" />
            <span className="truncate font-mono text-[11px] mk-text-55">
              alex-morgan/neural-network-report
            </span>
          </div>

          <div className="space-y-1">
            {FILES.map((file, index) => {
              const active =
                (phase === 'scan' && index === scanCursor) ||
                (phase !== 'scan' && Boolean(file.target))
              return (
                <motion.div
                  key={file.name}
                  animate={{
                    backgroundColor: active ? 'rgba(14,190,146,0.12)' : 'rgba(0,0,0,0)',
                    borderColor: active ? 'rgba(45,226,178,0.35)' : 'rgba(0,0,0,0)',
                  }}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
                >
                  <FileCode2
                    className={cn('h-3.5 w-3.5', active ? 'text-[#2de2b2]' : 'mk-text-30')}
                  />
                  <span className={cn('font-mono text-[12px]', active ? 'mk-text' : 'mk-text-45')}>
                    {file.name}
                  </span>
                  {file.target && phase !== 'scan' ? (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="ml-auto rounded-full bg-[#0ebe92]/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#076f65] [.mk-theme-dark_&]:text-[#7ff5d3]"
                    >
                      open
                    </motion.span>
                  ) : null}
                  {phase === 'scan' && index === scanCursor ? (
                    <Search className="ml-auto h-3 w-3 text-[#2de2b2]" />
                  ) : null}
                </motion.div>
              )
            })}
          </div>

          <AnimatePresence>
            {phase === 'scan' ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 font-mono text-[11px] leading-relaxed mk-text-40"
              >
                Agent walking the tree… looking for training logic and evaluation hooks.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Editor + question pane */}
        <div className="relative flex flex-col p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {!showEditor ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center text-center"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-panel)]">
                  <Search className="h-5 w-5 text-[#2de2b2]" />
                </div>
                <p className="font-display text-xl font-semibold tracking-[-0.02em] mk-text">
                  Searching the submission
                </p>
                <p className="mt-2 max-w-xs text-sm mk-text-45">
                  Reading {FILES[Math.min(scanCursor, targetIndex)]?.name ?? 'files'} for concepts the
                  viva can actually defend.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45 }}
                className="flex flex-1 flex-col"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#2de2b2]" />
                    <span className="font-mono text-[11px] mk-text-50">src/train.py</span>
                  </div>
                  {showHighlight ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#076f65] [.mk-theme-dark_&]:text-[#7ff5d3]">
                      early_stop · L87–88
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] mk-text-30">
                      opening…
                    </span>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-[color:var(--mk-border-6)] bg-[color:var(--mk-ink-40)]">
                  <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-[1.9] sm:text-[12px]">
                    <code>
                      {CODE_LINES.map((line) => {
                        const lit = showHighlight && line.hot
                        return (
                          <motion.span
                            key={line.n}
                            animate={{
                              backgroundColor: lit ? 'rgba(14,190,146,0.16)' : 'rgba(0,0,0,0)',
                            }}
                            className={cn(
                              'block rounded-md px-1.5',
                              lit
                                ? 'text-[#076f65] [.mk-theme-dark_&]:text-[#7ff5d3]'
                                : 'mk-text-55',
                            )}
                          >
                            <span className="inline-block w-8 select-none mk-text-25">{line.n}</span>
                            {line.text}
                          </motion.span>
                        )
                      })}
                    </code>
                  </pre>
                </div>

                <AnimatePresence>
                  {showQuestion ? (
                    <motion.div
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.45 }}
                      className="mt-4 rounded-2xl border border-[#2de2b2]/30 bg-[color:var(--mk-featured-bg)] p-4 shadow-[0_18px_50px_-28px_rgba(14,190,146,0.55)] sm:p-5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0ebe92]/15">
                          <Mic className="h-3.5 w-3.5 text-[#2de2b2]" />
                        </span>
                        <div>
                          <p className="text-[12px] font-medium text-[color:var(--mk-featured-fg)]">
                            Viva agent
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--mk-featured-soft)]">
                            Criterion 2 · grounded follow-up
                          </p>
                        </div>
                        <span className="ml-auto hidden rounded-full border border-[#2de2b2]/25 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#076f65] sm:inline [.mk-theme-dark_&]:text-[#7ff5d3]">
                          cites train.py:87–88
                        </span>
                      </div>
                      <p className="mt-4 min-h-[3.4em] font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-[color:var(--mk-featured-fg)] sm:text-xl">
                        {QUESTION.slice(0, typedChars)}
                        {typedChars < QUESTION.length ? (
                          <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.12em] animate-pulse bg-[#2de2b2]" />
                        ) : null}
                      </p>
                      <div className="mt-4 flex h-8 items-end gap-1">
                        {Array.from({ length: 22 }).map((_, index) => (
                          <motion.span
                            key={index}
                            className="flex-1 rounded-full bg-gradient-to-t from-[#0ebe92]/35 to-[#2de2b2]"
                            animate={{
                              height: playing
                                ? [`${18 + ((index * 17) % 40)}%`, `${45 + ((index * 29) % 50)}%`, `${22 + ((index * 13) % 35)}%`]
                                : '28%',
                            }}
                            transition={{
                              duration: 0.9 + (index % 4) * 0.12,
                              repeat: Infinity,
                              repeatType: 'mirror',
                              ease: 'easeInOut',
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 text-sm mk-text-45"
                    >
                      {phase === 'open'
                        ? 'Opening the training loop the student actually submitted…'
                        : 'Locking onto early-stopping — the plateau check the viva will probe.'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Timeline scrub */}
      <div className="border-t border-[color:var(--mk-border-6)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="w-8 font-mono text-[10px] tabular-nums mk-text-35">{formatClock(elapsed)}</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--mk-border-6)]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#0ebe92] to-[#2de2b2]"
              style={{ width: `${(elapsed / totalMs) * 100}%` }}
            />
            <div className="pointer-events-none absolute inset-0 flex">
              {PHASES.map((item) => (
                <div key={item.id} className="relative" style={{ width: `${(item.ms / totalMs) * 100}%` }}>
                  <span className="absolute right-0 top-1/2 h-2 w-px -translate-y-1/2 bg-[color:var(--mk-fg-25)]" />
                </div>
              ))}
            </div>
          </div>
          <span className="w-8 text-right font-mono text-[10px] tabular-nums mk-text-35">
            {formatClock(totalMs)}
          </span>
        </div>
      </div>
    </div>
  )
}
