import { useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlitchText } from './text'
import { RADIUS } from './tokens'

export type SwipeCard = {
  id: string
  kicker: string
  title: string
  body: string
  icon: ComponentType<{ className?: string }>
  accent: string
  visual: ReactVisual
}

type ReactVisual = (props: { active: boolean }) => ReactNode

/**
 * Apple-style swipe deck: the active card sits forward while neighbours recede in
 * depth, blur, and opacity. Drag, arrows, and dot controls all move the same index.
 */
export function CardSwipe({ cards }: { cards: SwipeCard[] }) {
  const [index, setIndex] = useState(0)
  const go = (next: number) => setIndex((next + cards.length) % cards.length)

  return (
    <div className="relative">
      <div className="relative h-[30rem] select-none sm:h-[34rem]">
        {cards.map((card, cardIndex) => {
          const offset = cardIndex - index
          const distance = Math.abs(offset)
          const active = offset === 0
          if (distance > 2) return null

          return (
            <motion.article
              key={card.id}
              drag={active ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) go(index + 1)
                else if (info.offset.x > 70) go(index - 1)
              }}
              animate={{
                x: `${offset * 46}%`,
                scale: 1 - distance * 0.09,
                opacity: distance > 1 ? 0 : 1 - distance * 0.45,
                filter: `blur(${distance * 3}px)`,
                zIndex: cards.length - distance,
                rotateY: offset * -6,
              }}
              transition={{ type: 'spring', stiffness: 220, damping: 30 }}
              onClick={() => !active && go(cardIndex)}
              className={cn(
                'absolute inset-0 mx-auto w-full max-w-3xl overflow-hidden border border-[color:var(--mk-border)] bg-[var(--mk-card-solid)]',
                RADIUS.card,
                active ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                'shadow-[0_60px_140px_-60px_rgba(0,0,0,1)]',
              )}
              style={{ transformPerspective: 1400 }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background: `radial-gradient(120% 80% at 50% 0%, ${card.accent}22, transparent 62%)`,
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-16 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${card.accent}, transparent)` }}
              />

              <div className="relative flex h-full flex-col justify-between p-8 sm:p-11">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] mk-text-40">
                      {card.kicker}
                    </p>
                    <h3 className="mt-4 max-w-md font-display text-2xl font-semibold leading-tight tracking-[-0.03em] mk-text sm:text-[2rem]">
                      <AnimatePresence mode="wait">
                        {active ? (
                          <motion.span
                            key={card.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="inline-block"
                          >
                            <GlitchText text={card.title} trigger="view" />
                          </motion.span>
                        ) : (
                          <span>{card.title}</span>
                        )}
                      </AnimatePresence>
                    </h3>
                    <p className="mt-4 max-w-lg text-sm leading-[1.75] mk-text-50">{card.body}</p>
                  </div>
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--mk-border)]"
                    style={{ background: `${card.accent}14`, color: card.accent }}
                  >
                    <card.icon className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-8">{card.visual({ active })}</div>
              </div>
            </motion.article>
          )
        })}
      </div>

      <div className="mt-10 flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => go(index - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--mk-border)] mk-text-60 transition hover:border-[color:var(--mk-fg-25)] hover:text-[color:var(--mk-nav-hover)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {cards.map((card, dotIndex) => (
            <button
              key={card.id}
              type="button"
              aria-label={`Show ${card.title}`}
              onClick={() => setIndex(dotIndex)}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: dotIndex === index ? 38 : 10,
                background: dotIndex === index ? '#2de2b2' : 'var(--mk-fg-30)',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Next"
          onClick={() => go(index + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--mk-border)] mk-text-60 transition hover:border-[color:var(--mk-fg-25)] hover:text-[color:var(--mk-nav-hover)]"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
