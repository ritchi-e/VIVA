import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import {
  ArrowUpRight,
  BarChart3,
  Check,
  FileText,
  GitBranch,
  Menu,
  MessagesSquare,
  Mic,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react'
import { LogoLight, LogoMarkLight, WordmarkLight } from '@/components/brand/Logo'
import { LiquidChrome } from '@/components/landing/LiquidChrome'
import {
  AsciiGlitch,
  AuroraBloom,
  FilmGrain,
  GlowButton,
  GridOverlay,
  Marquee,
  RippleRings,
  SpotlightCard,
  TiltCard,
} from '@/components/landing/fx'
import { GlitchText, NumberTicker, SparklesText, WordReveal } from '@/components/landing/text'
import { DynamicIslandCTA } from '@/components/landing/DynamicIslandCTA'
import { CardSwipe, type SwipeCard } from '@/components/landing/CardSwipe'
import { BentoGrid } from '@/components/landing/Bento'
import { PricingMatrix } from '@/components/landing/Pricing'
import { SECTION, SHELL, TYPE } from '@/components/landing/tokens'
import { cn } from '@/lib/utils'

const CONTACT_EMAIL = 'hello@mokhik.com'

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#showcase', label: 'Showcase' },
  { href: '#platform', label: 'Platform' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#contact', label: 'Contact' },
]

const MARQUEE_ITEMS = [
  'Repo-grounded questioning',
  'Nova-3 speech',
  'Adaptive follow-ups',
  'Live session integrity',
  'Rubric-aligned scoring',
  'Cohort analytics',
  'Zero hallucinated prompts',
  'Evidence-linked grades',
]

/* ------------------------------------------------------------------ *
 * Section header — one component so every section shares the rhythm.
 * ------------------------------------------------------------------ */

function SectionHead({
  eyebrow,
  title,
  body,
  highlight,
  align = 'center',
}: {
  eyebrow: string
  title: string
  body?: string
  highlight?: string[]
  align?: 'center' | 'left'
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className={TYPE.eyebrow}
      >
        {eyebrow}
      </motion.p>
      <h2 className={cn('mt-5', TYPE.h2)}>
        <WordReveal text={title} highlight={highlight} />
      </h2>
      {body ? (
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className={cn('mt-6', TYPE.lead, align === 'center' && 'mx-auto')}
        >
          {body}
        </motion.p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 pt-4"
    >
      <div className={SHELL}>
        <div
          className={cn(
            'flex h-16 items-center justify-between rounded-full border px-5 transition-all duration-500 sm:px-6',
            scrolled
              ? 'border-white/10 bg-black/65 backdrop-blur-2xl shadow-[0_20px_60px_-30px_rgba(0,0,0,1)]'
              : 'border-transparent bg-transparent',
          )}
        >
          <Link to="/" aria-label="Mokhik home" onClick={() => setOpen(false)}>
            <LogoLight markClassName="h-7" wordmarkClassName="h-[15px]" />
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group relative text-sm text-white/55 transition-colors hover:text-white"
              >
                {item.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-gradient-to-r from-[#2de2b2] to-transparent transition-all duration-400 group-hover:w-full" />
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="text-sm text-white/60 transition-colors hover:text-white">
              Sign in
            </Link>
            <Link to="/register">
              <GlowButton className="px-5 py-2.5 text-[13px]">
                Get started
                <ArrowUpRight className="h-3.5 w-3.5" />
              </GlowButton>
            </Link>
          </div>

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="mt-2 overflow-hidden rounded-[28px] border border-white/10 bg-black/85 p-5 backdrop-blur-2xl md:hidden"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-white/5 py-3.5 text-sm text-white/70 last:border-0"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-2.5">
                <Link
                  to="/login"
                  className="rounded-full border border-white/12 py-3 text-center text-sm text-white/80"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-gradient-to-b from-[#3fe9bd] to-[#0ebe92] py-3 text-center text-sm font-semibold text-[#03231e]"
                >
                  Get started
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

function Hero() {
  const { scrollY } = useScroll()
  const shaderY = useTransform(scrollY, [0, 900], [0, 220])
  const contentY = useTransform(scrollY, [0, 700], [0, -70])
  const contentOpacity = useTransform(scrollY, [0, 620], [1, 0])

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-28">
      <motion.div style={{ y: shaderY }} className="absolute inset-0 -top-24 h-[125%]">
        <LiquidChrome speed={0.3} />
        <div className="absolute inset-0 bg-[#030303]/45" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#030303] via-[#030303]/85 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#030303] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#030303] to-transparent" />
      </motion.div>

      <GridOverlay className="opacity-60" />
      <FilmGrain />

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className={cn(SHELL, 'relative z-10')}>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="flex justify-center"
          >
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
              <LogoMarkLight className="h-4" />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
                Oral assessment infrastructure
              </span>
            </span>
          </motion.div>

          <h1 className={cn('mt-9', TYPE.display)}>
            <SparklesText>
              <WordReveal text="Submission ≠ Understanding." delay={0.25} play="mount" highlight={['Understanding']} />
            </SparklesText>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.85 }}
            className={cn('mx-auto mt-8 max-w-xl', TYPE.lead)}
          >
            Students upload documents or link their GitHub repo. Mokhik reads the submission,
            runs an adaptive spoken viva grounded in their own work, and returns evidence-linked
            rubric scores for you to review.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1 }}
            className="mt-11 flex flex-col items-center gap-5"
          >
            <DynamicIslandCTA />
            <a href="#showcase" className="text-sm text-white/40 transition-colors hover:text-white/80">
              or watch a session unfold ↓
            </a>
          </motion.div>
        </div>
      </motion.div>

    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Trust marquee
 * ------------------------------------------------------------------ */

function TrustStrip() {
  const departments = [
    'Computer Science',
    'Software Engineering',
    'Data Science',
    'Information Systems',
    'Cybersecurity',
    'Applied Computing',
  ]

  return (
    <section className="relative border-b border-white/6 py-16">
      <div className={cn(SHELL, 'mb-10')}>
        <p className={cn(TYPE.eyebrow, 'text-center')}>Built for the way faculties assess</p>
      </div>
      <Marquee duration={38} gap="4rem">
        {departments.map((department) => (
          <span key={department} className="flex items-center gap-4 whitespace-nowrap">
            <LogoMarkLight className="h-5 opacity-35" />
            <span className="font-display text-lg font-semibold tracking-[-0.02em] text-white/30">
              {department}
            </span>
          </span>
        ))}
      </Marquee>
      <Marquee duration={46} gap="3rem" reverse className="mt-6">
        {MARQUEE_ITEMS.map((item) => (
          <span
            key={item}
            className="whitespace-nowrap rounded-full border border-white/8 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35"
          >
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * How it works — horizontal flow, GitHub-focused
 * ------------------------------------------------------------------ */

const FLOW_STEPS = [
  { icon: GitBranch, label: 'Link repo', color: '#2de2b2' },
  { icon: Zap, label: 'Extract & embed', color: '#7dd3fc' },
  { icon: Mic, label: 'Adaptive viva', color: '#a78bfa' },
  { icon: Check, label: 'Evidence report', color: '#f59e0b' },
]

function GitHubMockTerminal() {
  const [step, setStep] = useState(0)

  const lines = [
    { prompt: true, text: 'github.com/alex-morgan/neural-network-report' },
    { prompt: false, text: '  ├── README.md' },
    { prompt: false, text: '  ├── src/model.py          → ResNet-18, batch norm, Adam' },
    { prompt: false, text: '  ├── src/train.py           → 40 epochs, early stopping' },
    { prompt: false, text: '  ├── notebooks/analysis.ipynb' },
    { prompt: false, text: '  └── docs/report.pdf' },
    { prompt: false, text: '' },
    { prompt: false, text: '  ✓ 23 files indexed · 147 chunks embedded · 3 knowledge nodes' },
    { prompt: false, text: '  ✓ Question plan: 8 questions across 4 rubric criteria' },
    { prompt: false, text: '  ✓ Ready for viva' },
  ]

  useEffect(() => {
    if (step >= lines.length) return
    const delay = step === 0 ? 800 : step < 6 ? 180 : step === 6 ? 500 : 400
    const timer = setTimeout(() => setStep((s) => s + 1), delay)
    return () => clearTimeout(timer)
  }, [step, lines.length])

  useEffect(() => {
    const restart = setInterval(() => setStep(0), 12000)
    return () => clearInterval(restart)
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/60 backdrop-blur-xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 font-mono text-[10px] text-white/30">mokhik — submission ingestion</span>
      </div>

      <div className="p-5 font-mono text-[12px] leading-[1.9] sm:text-[13px]">
        {lines.slice(0, step).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              line.prompt ? 'text-[#7ff5d3]' : 'text-white/40',
              line.text.startsWith('  ✓') && 'text-[#2de2b2]/80',
            )}
          >
            {line.prompt && <span className="text-white/25">❯ </span>}
            {line.text}
          </motion.div>
        ))}
        {step < lines.length && (
          <span className="inline-block h-4 w-1.5 animate-pulse bg-[#2de2b2]/70" />
        )}
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className={cn(SECTION, 'scroll-mt-24')}>
      <GridOverlay className="opacity-40" />
      <div className={cn(SHELL, 'relative')}>
        <SectionHead
          eyebrow="How it works"
          title="Paste a GitHub link. We handle the rest."
          highlight={['GitHub']}
          body="Link a repository or upload a document — the system reads every file, embeds the content, plans viva questions grounded in the student's own code, and delivers an evidence-backed assessment to the instructor."
        />

        {/* Flow steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="flex items-center justify-between">
            {FLOW_STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-0 flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2.5">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 + i * 0.12 }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"
                    style={{ boxShadow: `0 0 30px -10px ${s.color}40` }}
                  >
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </motion.div>
                  <span className="text-[11px] font-medium text-white/50">{s.label}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.12 }}
                    className="mx-3 mb-6 h-px flex-1 origin-left"
                    style={{ background: `linear-gradient(to right, ${s.color}40, ${FLOW_STEPS[i + 1].color}40)` }}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* GitHub terminal + side info */}
        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <GitHubMockTerminal />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="space-y-6"
          >
            <div>
              <h3 className={TYPE.h3}>Every question traces back to their code</h3>
              <p className={cn('mt-3', TYPE.body)}>
                The planner reads the repo tree, parses functions and classes, and generates questions
                it can anchor to a real file and line range. Ungrounded questions are discarded before
                the student ever sees them.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Documents', items: 'PDF · DOCX · PPTX · ZIP', icon: FileText },
                { label: 'Repositories', items: 'Public & private GitHub repos', icon: GitBranch },
                { label: 'Processing', items: 'Extract → chunk → embed → knowledge graph', icon: Zap },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3">
                  <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2de2b2]/60" />
                  <div>
                    <p className="text-[13px] font-medium text-white/70">{row.label}</p>
                    <p className="text-[12px] text-white/35">{row.items}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Showcase carousel
 * ------------------------------------------------------------------ */

function TranscriptVisual({ active }: { active: boolean }) {
  return (
    <div className="space-y-3">
      {[
        { who: 'mokhik', text: 'You cache tokens keyed by source offset. What breaks after an edit?' },
        { who: 'student', text: 'The cached token goes stale, so I invalidate everything past the offset.' },
        { who: 'mokhik', text: 'Show me where that invalidation actually happens.' },
      ].map((line, index) => (
        <motion.div
          key={line.text}
          initial={{ opacity: 0, y: 12 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0.35, y: 0 }}
          transition={{ delay: active ? 0.15 + index * 0.15 : 0, duration: 0.5 }}
          className={cn(
            'max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
            line.who === 'student'
              ? 'ml-auto bg-gradient-to-br from-[#0ebe92]/25 to-[#0ebe92]/10 text-white/85'
              : 'bg-white/[0.04] text-white/60',
          )}
        >
          {line.text}
        </motion.div>
      ))}
    </div>
  )
}

/** The grace window told as a story: focus drops, the student returns, nothing is penalised. */
function IntegrityVisual({ active }: { active: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/40 p-5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
        <span>Attention timeline</span>
        <span>14:20 elapsed</span>
      </div>

      <div className="relative mt-5 h-2 rounded-full bg-white/6">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#0ebe92]/50 to-[#7ff5d3]"
          initial={{ width: 0 }}
          animate={{ width: active ? '100%' : '0%' }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.span
          className="absolute -top-1 h-4 w-1 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
          style={{ left: '58%' }}
          initial={{ opacity: 0, scaleY: 0.4 }}
          animate={active ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0.4 }}
          transition={{ delay: 1, duration: 0.4 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: 1.25, duration: 0.5 }}
        className="mt-5 flex items-start gap-3"
      >
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        <p className="text-xs leading-relaxed text-white/45">
          <span className="text-amber-300">Focus left the window at 09:41.</span> The student returned
          after 2.4 seconds — inside the grace period, so the viva continued. Recorded in the report,
          not held against them.
        </p>
      </motion.div>
    </div>
  )
}

function AnalyticsVisual({ active }: { active: boolean }) {
  const bars = [42, 68, 55, 84, 72, 91, 63, 78]
  return (
    <div className="flex h-28 items-end gap-2.5">
      {bars.map((value, index) => (
        <motion.div
          key={index}
          className="flex-1 rounded-t-md bg-gradient-to-t from-[#0ebe92]/25 to-[#7ff5d3]/80"
          initial={{ height: 0 }}
          animate={{ height: active ? `${value}%` : '18%' }}
          transition={{ duration: 0.8, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

const SHOWCASE: SwipeCard[] = [
  {
    id: 'conversation',
    kicker: '01 — The conversation',
    title: 'It probes, it does not quiz.',
    body: 'Answers steer the session. Thin reasoning gets a follow-up; proven understanding moves the examiner on to new ground it has not already covered.',
    icon: MessagesSquare,
    accent: '#2de2b2',
    visual: TranscriptVisual,
  },
  {
    id: 'integrity',
    kicker: '02 — The session',
    title: 'Monitored without the theatre.',
    body: 'Window focus, fullscreen state, and a live camera feed run for the length of the viva. A short grace window forgives accidents; everything else lands in your report.',
    icon: ShieldCheck,
    accent: '#7dd3fc',
    visual: IntegrityVisual,
  },
  {
    id: 'analytics',
    kicker: '03 — The evidence',
    title: 'Grades with a paper trail.',
    body: 'Every criterion links back to the moment in the transcript that earned it, then rolls up into cohort trends you can act on before the next assignment.',
    icon: BarChart3,
    accent: '#a78bfa',
    visual: AnalyticsVisual,
  },
]

function Showcase() {
  return (
    <section id="showcase" className={cn(SECTION, 'scroll-mt-24')}>
      <AuroraBloom className="opacity-50" />
      <div className={cn(SHELL, 'relative')}>
        <SectionHead
          eyebrow="The session"
          title="Watch a viva actually happen"
          highlight={['actually']}
          body="Three moments from a single assessment: the questioning, the monitoring, and the evidence that reaches you afterwards."
        />
        <div className="mt-20">
          <CardSwipe cards={SHOWCASE} />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Platform bento
 * ------------------------------------------------------------------ */

function Platform() {
  return (
    <section id="platform" className={cn(SECTION, 'scroll-mt-24 border-t border-white/6')}>
      <GridOverlay size={72} className="opacity-40" />
      <div className={cn(SHELL, 'relative')}>
        <SectionHead
          eyebrow="The platform"
          title="Four systems, one defensible grade"
          highlight={['defensible']}
          body="Grounding, speech, integrity, and scoring are separate subsystems that each refuse to guess."
        />
        <BentoGrid />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Metrics
 * ------------------------------------------------------------------ */

function Metrics() {
  const stats = [
    { value: 5, suffix: 's', label: 'Grace window before a session closes' },
    { value: 3, suffix: '', label: 'Independent checks before a question ships' },
    { value: 100, suffix: '%', label: 'Of submissions can be assessed orally' },
  ]

  return (
    <section className="relative border-y border-white/6 py-20">
      <div className={cn(SHELL, 'grid gap-12 sm:grid-cols-3')}>
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: index * 0.12 }}
            className="text-center sm:text-left"
          >
            <p className="font-display text-6xl font-semibold tracking-[-0.05em] text-white">
              <NumberTicker value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/45">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Pricing
 * ------------------------------------------------------------------ */

function Pricing() {
  return (
    <section id="pricing" className={cn(SECTION, 'scroll-mt-24')}>
      <AuroraBloom className="opacity-40" />
      <div className={cn(SHELL, 'relative')}>
        <SectionHead
          eyebrow="Pricing"
          title="Start free, scale when the cohort grows"
          highlight={['free']}
          body="Fixed packages sized for a class, a course, or a faculty. Talk to us if you need something built around how you teach."
        />
        <PricingMatrix />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Contact
 * ------------------------------------------------------------------ */

function Contact() {
  return (
    <section id="contact" className={cn(SECTION, 'scroll-mt-24')}>
      <div className={cn(SHELL, 'relative')}>
        <TiltCard max={4}>
          <SpotlightCard className="overflow-hidden px-8 py-20 text-center sm:px-16">
            <RippleRings className="opacity-70" />
            <div className="relative">
              <LogoMarkLight className="mx-auto h-12" />
              <h2 className={cn('mx-auto mt-9 max-w-2xl', TYPE.h2)}>
                <WordReveal text="Bring the oral exam back" highlight={['oral']} />
              </h2>
              <p className={cn('mx-auto mt-6 max-w-lg', TYPE.lead)}>
                Send us one assignment. We will run a Mokhik viva on it and walk you through the report
                it produces.
              </p>
              <div className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a href={`mailto:${CONTACT_EMAIL}?subject=Mokhik%20demo`}>
                  <GlowButton>
                    Book a demo
                    <ArrowUpRight className="h-4 w-4" />
                  </GlowButton>
                </a>
                <Link to="/register">
                  <GlowButton tone="ghost">Create an account</GlowButton>
                </Link>
              </div>
              <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">
                <GlitchText text={CONTACT_EMAIL} />
              </p>
            </div>
          </SpotlightCard>
        </TiltCard>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

type FooterLink = { label: string; href: string; internal?: boolean }

function SiteFooter() {
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: 'Product',
      links: [
        { label: 'Showcase', href: '#showcase' },
        { label: 'Platform', href: '#platform' },
        { label: 'Pricing', href: '#pricing' },
      ],
    },
    {
      title: 'Access',
      links: [
        { label: 'Sign in', href: '/login', internal: true },
        { label: 'Create account', href: '/register', internal: true },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'Contact', href: '#contact' },
        { label: `Email ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}` },
      ],
    },
  ]

  return (
    <footer className="relative overflow-hidden border-t border-white/6">
      <AsciiGlitch className="mk-grid-fade" opacity={0.14} />
      <div className={cn(SHELL, 'relative py-20')}>
        <div className="grid gap-14 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <LogoLight markClassName="h-9" wordmarkClassName="h-5" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/40">
              Oral assessment infrastructure that stays grounded in the student's own work.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/30">
                  {column.title}
                </p>
                <ul className="mt-5 space-y-3.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.internal ? (
                        <Link to={link.href} className="text-sm text-white/55 transition-colors hover:text-[#7ff5d3]">
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-white/55 transition-colors hover:text-[#7ff5d3]">
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-white/6 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <WordmarkLight className="h-8 opacity-10" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">
            © {new Date().getFullYear()} Mokhik — All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function HomePage() {
  useEffect(() => {
    // The app shell is a light theme; scope the ink background to this route only.
    document.body.classList.add('mk-dark')
    return () => document.body.classList.remove('mk-dark')
  }, [])

  useEffect(() => {
    // The router owns the URL, so a hash deep link has to be resolved after mount.
    const { hash } = window.location
    if (!hash || hash.length < 2) return
    const target = document.querySelector(hash)
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#030303] text-white">
      <SiteHeader />
      <main>
        <Hero />
        <TrustStrip />
        <Showcase />
        <HowItWorks />
        <Platform />
        <Metrics />
        <Pricing />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  )
}
