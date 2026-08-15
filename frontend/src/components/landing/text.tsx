import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * SparklesText — glyph-safe sparkle field layered over a headline.
 * ------------------------------------------------------------------ */

type Sparkle = { id: number; x: number; y: number; size: number; delay: number; duration: number }

export function SparklesText({
  children,
  className,
  count = 14,
  color = '#2de2b2',
}: {
  children: ReactNode
  className?: string
  count?: number
  color?: string
}) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let seed = 0
    const spawn = (): Sparkle => ({
      id: seed++,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 5 + Math.random() * 8,
      delay: Math.random() * 1.6,
      duration: 1.4 + Math.random() * 1.4,
    })
    setSparkles(Array.from({ length: count }, spawn))
    const timer = window.setInterval(() => {
      setSparkles((current) => [...current.slice(1), spawn()])
    }, 480)
    return () => window.clearInterval(timer)
  }, [count])

  return (
    <span className={cn('relative inline-block', className)}>
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        {sparkles.map((sparkle) => (
          <svg
            key={sparkle.id}
            width={sparkle.size}
            height={sparkle.size}
            viewBox="0 0 24 24"
            fill={color}
            className="absolute"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              animation: `mk-sparkle ${sparkle.duration}s ease-in-out ${sparkle.delay}s infinite`,
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          >
            <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
          </svg>
        ))}
      </span>
      <span className="relative z-10">{children}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * WordReveal — per-word mask-up entrance driven by viewport entry.
 * ------------------------------------------------------------------ */

export function WordReveal({
  text,
  className,
  delay = 0,
  highlight,
  play = 'view',
}: {
  text: string
  className?: string
  delay?: number
  /** Words rendered in the accent gradient instead of plain white. */
  highlight?: string[]
  /** Above-the-fold copy should play on mount rather than wait for an observer. */
  play?: 'view' | 'mount'
}) {
  const words = useMemo(() => text.split(' '), [text])
  const accent = useMemo(() => new Set(highlight?.map((word) => word.toLowerCase())), [highlight])
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const shown = play === 'mount' || inView

  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden py-[0.08em] align-bottom">
          <motion.span
            className={cn(
              'inline-block',
              accent.has(word.toLowerCase().replace(/[^a-z]/g, '')) &&
                'bg-gradient-to-br from-[#7ff5d3] via-[#2de2b2] to-[#0ebe92] bg-clip-text text-transparent',
            )}
            initial={{ y: '110%', opacity: 0 }}
            animate={shown ? { y: '0%', opacity: 1 } : { y: '110%', opacity: 0 }}
            transition={{
              duration: 0.85,
              delay: delay + index * 0.055,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * ScrollVelocityRow — marquee whose speed and direction follow scroll.
 * ------------------------------------------------------------------ */

export function ScrollVelocityRow({
  children,
  baseVelocity = 3,
  className,
}: {
  children: ReactNode
  baseVelocity?: number
  className?: string
}) {
  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const scrollVelocity = useVelocity(scrollY)
  const smooth = useSpring(scrollVelocity, { damping: 50, stiffness: 400 })
  const velocityFactor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false })
  const x = useTransform(baseX, (value) => `${wrap(-25, -50, value)}%`)
  const direction = useRef(1)

  useAnimationFrame((_, delta) => {
    let moveBy = direction.current * baseVelocity * (delta / 1000)
    const factor = velocityFactor.get()
    if (factor < 0) direction.current = -1
    else if (factor > 0) direction.current = 1
    moveBy += direction.current * moveBy * factor
    baseX.set(baseX.get() + moveBy)
  })

  return (
    <div className={cn('relative flex flex-nowrap overflow-hidden whitespace-nowrap', className)}>
      <motion.div className="flex flex-nowrap whitespace-nowrap" style={{ x }}>
        {[0, 1, 2, 3].map((copy) => (
          <span key={copy} className="flex shrink-0 items-center">
            {children}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

function wrap(min: number, max: number, value: number) {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

/* ------------------------------------------------------------------ *
 * GlitchText — brief character scramble on hover or on view.
 * ------------------------------------------------------------------ */

const SCRAMBLE = '!<>-_\\/[]{}—=+*^?#________'

export function GlitchText({
  text,
  className,
  trigger = 'hover',
}: {
  text: string
  className?: string
  trigger?: 'hover' | 'view'
}) {
  const [display, setDisplay] = useState(text)
  const frame = useRef(0)
  const raf = useRef(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20% 0px' })

  const scramble = () => {
    cancelAnimationFrame(raf.current)
    frame.current = 0
    const total = 22

    const run = () => {
      const progress = frame.current / total
      setDisplay(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' '
            if (index / text.length < progress) return char
            return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
          })
          .join(''),
      )
      frame.current++
      if (frame.current <= total) raf.current = requestAnimationFrame(run)
      else setDisplay(text)
    }
    raf.current = requestAnimationFrame(run)
  }

  useEffect(() => {
    if (trigger === 'view' && inView) scramble()
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, trigger])

  return (
    <span
      ref={ref}
      onMouseEnter={trigger === 'hover' ? scramble : undefined}
      className={cn('inline-block tabular-nums', className)}
    >
      {display}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * NumberTicker — spring count-up when the metric scrolls into frame.
 * ------------------------------------------------------------------ */

export function NumberTicker({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { damping: 34, stiffness: 90 })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (inView) motionValue.set(value)
  }, [inView, motionValue, value])

  useEffect(
    () =>
      spring.on('change', (latest) => {
        setDisplay(
          latest.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }),
        )
      }),
    [spring, decimals],
  )

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
