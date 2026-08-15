import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardCheck,
  FileCode2,
  Mail,
  Menu,
  MessagesSquare,
  Mic,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

const CONTACT_EMAIL = 'hello@mokhik.com'

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#contact', label: 'Contact' },
]

const features: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] = [
  {
    icon: FileCode2,
    title: 'Grounded in their code',
    body: 'Every question is traced back to a file, function, or commit in the student’s own submission. Anything the model cannot cite is discarded before it is ever asked.',
  },
  {
    icon: MessagesSquare,
    title: 'Adaptive follow-ups',
    body: 'The examiner probes deeper when an answer is thin and moves on when a concept is proven, without circling back to ground it has already covered.',
  },
  {
    icon: Mic,
    title: 'Natural voice',
    body: 'Students speak instead of typing. Transcription is primed with the vocabulary of your course and their repository, so domain terms come through accurately.',
  },
  {
    icon: ShieldCheck,
    title: 'Monitored sessions',
    body: 'Leaving the exam window starts a short countdown to return. Sessions stay under live monitoring, and anything unresolved is flagged for you.',
  },
  {
    icon: ClipboardCheck,
    title: 'Rubric-aligned scoring',
    body: 'Results arrive as criterion-level scores with the transcript excerpt that justifies each one, so a grade is never a number without evidence.',
  },
  {
    icon: BarChart3,
    title: 'Cohort analytics',
    body: 'See score distributions, completion trends, and which rubric criteria a cohort consistently struggles with across every assignment.',
  },
]

const steps = [
  {
    title: 'Set the assignment',
    body: 'Create the assignment, define your rubric, and let students submit their repository. Mokhik indexes the code and prepares a question plan for each one.',
  },
  {
    title: 'Student sits the viva',
    body: 'A short, spoken oral exam in the browser. The examiner asks about the work in front of it, listens, and follows up while the session stays monitored.',
  },
  {
    title: 'Review the evidence',
    body: 'You get a transcript, per-criterion scores, integrity flags, and cohort analytics — enough to defend any grade you award.',
  },
]

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    cadence: 'for one instructor',
    blurb: 'Enough to run oral assessment across a single class.',
    features: ['25 vivas per month', 'Repo-grounded question plans', 'Rubric scoring and transcripts', 'Email support'],
    cta: 'Start free',
    featured: false,
    contactSales: false,
  },
  {
    name: 'Department',
    price: '$49',
    cadence: 'per instructor / month',
    blurb: 'For teaching teams running vivas at scale.',
    features: [
      'Unlimited vivas',
      'Live proctoring and integrity reports',
      'Cohort analytics dashboard',
      'Google sign-in for staff and students',
      'Priority support',
    ],
    cta: 'Get started',
    featured: true,
    contactSales: false,
  },
  {
    name: 'Institution',
    price: 'Custom',
    cadence: 'annual agreement',
    blurb: 'For faculty-wide or campus-wide rollout.',
    features: ['SSO and LMS integration', 'Self-hosted deployment', 'Custom data retention', 'Onboarding and SLA'],
    cta: 'Talk to us',
    featured: false,
    contactSales: true,
  },
]

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 text-balance sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-4 text-base leading-relaxed text-slate-600">{body}</p> : null}
    </div>
  )
}

function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="Mokhik home" onClick={() => setOpen(false)}>
          <Logo markClassName="h-8" wordmarkClassName="h-[18px]" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-[var(--color-primary)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-900/10 transition hover:bg-[var(--color-primary-hover)]"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--color-border)] bg-white px-5 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-2 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              to="/login"
              className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-center text-sm font-semibold text-slate-800"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}

function TranscriptPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#0ebe92]/18 via-transparent to-[#076f65]/18 blur-2xl"
      />
      <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-xl shadow-slate-900/5">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6" />
            <span className="text-sm font-semibold text-slate-800">Viva · Compiler Design</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Monitored
          </span>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex gap-3">
            <LogoMark className="mt-0.5 h-6 shrink-0" />
            <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              In <span className="font-medium text-slate-900">parser/lexer.py</span> you cache tokens in
              a dictionary keyed by source offset. What breaks if the same offset is re-scanned after an
              edit?
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <div className="rounded-2xl rounded-tr-sm bg-[var(--color-primary)] px-4 py-3 text-sm leading-relaxed text-white">
              The cached token would be stale, so I invalidate everything past the edit offset before
              re-scanning.
            </div>
          </div>

          <div className="flex gap-3">
            <LogoMark className="mt-0.5 h-6 shrink-0" />
            <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              Good. Walk me through where that invalidation actually happens in your code.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)]">
          {[
            { label: 'Correctness', value: '8.5' },
            { label: 'Depth', value: '7.8' },
            { label: 'Ownership', value: '9.2' },
          ].map((item) => (
            <div key={item.label} className="bg-white px-4 py-3.5 text-center">
              <p className="font-display text-lg font-semibold text-slate-900">{item.value}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#0ebe92]/15 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-[#076f65]/12 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="animate-viva-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0ebe92]" />
            AI oral assessment, grounded in real work
          </span>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 text-balance sm:text-5xl lg:text-[3.4rem]">
            Know who actually did the work.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Mokhik runs a short oral viva on every submission. It asks about the student’s own code,
            follows up on vague answers, and hands you a rubric-scored report backed by the transcript.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-900/15 transition hover:bg-[var(--color-primary-hover)]"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-500">
            No credit card required · Works with any Git repository
          </p>
        </div>

        <div className="animate-viva-fade-up lg:pl-4">
          <TranscriptPreview />
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-24 border-t border-[var(--color-border)] bg-white/70">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Features"
          title="An examiner that has read the submission"
          body="Mokhik assesses the work in front of it. No generic question banks, no answers it cannot point to in the code."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-6 transition hover:border-[#076f65]/30 hover:shadow-lg hover:shadow-slate-900/5"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#076f65]/8 text-[var(--color-primary)]">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, then it runs itself"
          body="Set it up once per assignment. Every submission after that gets the same defensible oral assessment."
        />

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] font-display text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const planCtaClass =
  'mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition'

const planCtaTone = (featured: boolean) =>
  featured
    ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
    : 'border border-[var(--color-border)] text-slate-800 hover:bg-slate-50'

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 border-t border-[var(--color-border)] bg-white/70">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Pricing"
          title="Priced per instructor, not per student"
          body="Start free on a single class. Move up when oral assessment becomes how your department grades."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'flex flex-col rounded-2xl border bg-white p-7',
                plan.featured
                  ? 'border-[var(--color-primary)] shadow-xl shadow-teal-900/10 lg:-mt-4 lg:pb-10'
                  : 'border-[var(--color-border)]',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-slate-900">{plan.name}</h3>
                {plan.featured ? (
                  <span className="rounded-full bg-[#0ebe92]/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                    Popular
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-semibold tracking-tight text-slate-900">
                  {plan.price}
                </span>
                <span className="text-sm text-slate-500">{plan.cadence}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{plan.blurb}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0ebe92]" />
                    {item}
                  </li>
                ))}
              </ul>

              {plan.contactSales ? (
                <a href="#contact" className={cn(planCtaClass, planCtaTone(plan.featured))}>
                  {plan.cta}
                </a>
              ) : (
                <Link to="/register" className={cn(planCtaClass, planCtaTone(plan.featured))}>
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section id="contact" className="scroll-mt-24 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--color-primary)] px-8 py-14 text-center sm:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#0ebe92]/25 blur-3xl"
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white text-balance sm:text-4xl">
              Bring oral assessment back to your course
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/80">
              Tell us about your cohort size and how you assess today. We will show you what a Mokhik
              viva looks like on one of your own assignments.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Mokhik%20demo`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-white/90"
              >
                <Mail className="h-4 w-4" />
                Book a demo
              </a>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-xl border border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Create an account
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/70">
              Or email us at{' '}
              <a className="font-medium text-white underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white/70">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo markClassName="h-8" wordmarkClassName="h-[18px]" />
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Oral assessment that stays grounded in the student’s own work.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-slate-600 transition hover:text-[var(--color-primary)]"
              >
                {link.label}
              </a>
            ))}
            <Link to="/login" className="text-sm text-slate-600 transition hover:text-[var(--color-primary)]">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-[var(--color-border)] pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} Mokhik. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  )
}
