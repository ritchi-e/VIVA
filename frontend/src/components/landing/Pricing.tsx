import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlowButton, ShineBorder, SpotlightCard } from './fx'
import { TYPE } from './tokens'

type Tier = {
  name: string
  price: number
  blurb: string
  features: string[]
  cta: string
  featured?: boolean
}

const TIERS: Tier[] = [
  {
    name: 'Try',
    price: 0,
    blurb: '10 students · 1 assessment/student',
    features: [],
    cta: 'Start Free',
  },
  {
    name: 'Starter',
    price: 1999,
    blurb: '30 students · 2 assessments/student',
    features: ['60 assessments', '6-question adaptive assessments'],
    cta: 'Get Started',
  },
  {
    name: 'Faculty',
    price: 7499,
    blurb: '100 students · 3 assessments/student',
    features: ['300 assessments', '6-question adaptive assessments', 'Cohort analytics'],
    cta: 'Get Started',
    featured: true,
  },
  {
    name: 'Faculty Pro',
    price: 11999,
    blurb: '100+ students · 3 assessments/student',
    features: ['5–12 questions per assessment', 'Custom rubrics and assessment controls'],
    cta: 'Get Started',
  },
]

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function TierCard({ tier }: { tier: Tier }) {
  const featured = Boolean(tier.featured)

  const body = (
    <SpotlightCard
      className={cn(
        'flex h-full flex-col p-7 sm:p-8',
        featured &&
          'rounded-[27px] border-[#2de2b2]/35 bg-[color:var(--mk-featured-bg)] shadow-[0_24px_60px_-36px_rgba(14,190,146,0.55)]',
      )}
      spotlight={featured ? 'rgba(45,226,178,0.2)' : 'rgba(45,226,178,0.08)'}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          className={cn(
            TYPE.h3,
            featured && 'text-[color:var(--mk-featured-fg)]',
          )}
        >
          {tier.name}
        </h3>
        {featured ? (
          <span className="rounded-full border border-[#2de2b2]/40 bg-[#0ebe92]/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#076f65] [.mk-theme-dark_&]:text-[#7ff5d3]">
            ★ Most popular
          </span>
        ) : null}
      </div>

      <div className="mt-6">
        <span
          className={cn(
            'font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl',
            featured ? 'text-[color:var(--mk-featured-fg)]' : 'mk-text',
          )}
        >
          {tier.price === 0 ? '₹0' : formatInr(tier.price)}
        </span>
      </div>

      <p
        className={cn(
          'mt-4 text-sm leading-relaxed',
          featured ? 'text-[color:var(--mk-featured-muted)]' : 'mk-text-50',
        )}
      >
        {tier.blurb}
      </p>

      {tier.features.length > 0 ? (
        <>
          <div
            aria-hidden
            className={cn(
              'my-6 h-px bg-gradient-to-r from-transparent to-transparent',
              featured ? 'via-[#2de2b2]/35' : 'via-[color:var(--mk-border-12)]',
            )}
          />
          <ul className="flex-1 space-y-3.5">
            {tier.features.map((feature) => (
              <li
                key={feature}
                className={cn(
                  'flex gap-3 text-sm leading-snug',
                  featured ? 'text-[color:var(--mk-featured-fg)]/80' : 'mk-text-65',
                )}
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0ebe92]/18">
                  <Check className="h-2.5 w-2.5 text-[#2de2b2]" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex-1" />
      )}

      <Link to="/register" className="mt-8 self-start">
        <GlowButton tone={featured || tier.price === 0 ? 'primary' : 'ghost'}>{tier.cta}</GlowButton>
      </Link>
    </SpotlightCard>
  )

  if (!featured) return <div className="h-full">{body}</div>

  return (
    <ShineBorder className="h-full lg:-mt-4 lg:mb-4" duration={7}>
      {body}
    </ShineBorder>
  )
}

export function PricingMatrix() {
  return (
    <>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            <TierCard tier={tier} />
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mt-12 text-center text-sm mk-text-45"
      >
        Need a different size cohort or campus-wide rollout?{' '}
        <a
          href="#contact"
          className="font-medium text-[#076f65] underline decoration-[#076f65]/30 underline-offset-4 transition hover:decoration-[#076f65] [.mk-theme-dark_&]:text-[#7ff5d3] [.mk-theme-dark_&]:decoration-[#7ff5d3]/30"
        >
          Talk to us for your desired package
        </a>
        .
      </motion.p>
    </>
  )
}
