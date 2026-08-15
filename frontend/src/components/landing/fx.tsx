import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'
import { RADIUS, SURFACE } from './tokens'

/* ------------------------------------------------------------------ *
 * Marquee — infinite CSS loop, duplicated track, pauses on hover.
 * ------------------------------------------------------------------ */

export function Marquee({
  children,
  duration = 42,
  gap = '3rem',
  reverse,
  className,
}: {
  children: ReactNode
  duration?: number
  gap?: string
  reverse?: boolean
  className?: string
}) {
  const style = { '--mk-duration': `${duration}s`, '--mk-gap': gap } as CSSProperties

  return (
    <div className={cn('mk-marquee group relative flex overflow-hidden', className)} style={style}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={cn(
            'mk-marquee-track flex shrink-0 items-center',
            reverse && '[animation-direction:reverse]',
          )}
          style={{ gap, paddingRight: gap }}
        >
          {children}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ShineBorder — conic gradient rotating around a masked 1px ring.
 * ------------------------------------------------------------------ */

export function ShineBorder({
  children,
  className,
  duration = 8,
  colors = ['#2de2b2', '#7dd3fc', '#0ebe92'],
  radius = 28,
}: {
  children: ReactNode
  className?: string
  duration?: number
  colors?: string[]
  radius?: number
}) {
  // 1px of gradient padding with an opaque inner surface keeps the sweep on the
  // ring only — otherwise a translucent child lets the whole conic bleed through.
  return (
    <div
      className={cn('mk-spin-border relative isolate p-px', className)}
      style={
        {
          borderRadius: radius,
          background: `conic-gradient(from var(--mk-angle), rgba(255,255,255,0.06) 0deg, ${colors.join(', ')}, rgba(255,255,255,0.06) 320deg)`,
          animation: `mk-border-spin ${duration}s linear infinite`,
        } as CSSProperties
      }
    >
      <div className="h-full bg-[#050505]" style={{ borderRadius: radius - 1 }}>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SpotlightCard — radial glow that tracks the pointer across a panel.
 * ------------------------------------------------------------------ */

export function SpotlightCard({
  children,
  className,
  spotlight = 'rgba(45,226,178,0.13)',
  radius = 380,
}: {
  children: ReactNode
  className?: string
  spotlight?: string
  radius?: number
}) {
  const x = useMotionValue(-9999)
  const y = useMotionValue(-9999)
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, ${spotlight}, transparent 72%)`

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      x.set(event.clientX - rect.left)
      y.set(event.clientY - rect.top)
    },
    [x, y],
  )

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        x.set(-9999)
        y.set(-9999)
      }}
      className={cn('group relative overflow-hidden', RADIUS.card, SURFACE, className)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TiltCard — pointer-driven 3D tilt with spring damping.
 * ------------------------------------------------------------------ */

export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: ReactNode
  className?: string
  max?: number
}) {
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 })
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 })

  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const px = (event.clientX - rect.left) / rect.width - 0.5
        const py = (event.clientY - rect.top) / rect.height - 0.5
        ry.set(px * max * 2)
        rx.set(-py * max * 2)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ *
 * GlowButton — magnetic pill with a travelling sheen.
 * ------------------------------------------------------------------ */

export function GlowButton({
  children,
  className,
  tone = 'primary',
}: {
  children: ReactNode
  className?: string
  tone?: 'primary' | 'ghost'
}) {
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 })
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 })

  return (
    <motion.span
      style={{ x, y }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        x.set(((event.clientX - rect.left) / rect.width - 0.5) * 10)
        y.set(((event.clientY - rect.top) / rect.height - 0.5) * 6)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
      className={cn(
        'group relative inline-flex items-center justify-center gap-2 overflow-hidden px-7 py-3.5 text-sm font-semibold tracking-[-0.01em]',
        RADIUS.pill,
        tone === 'primary'
          ? 'bg-gradient-to-b from-[#3fe9bd] to-[#0ebe92] text-[#03231e] shadow-[0_0_0_1px_rgba(45,226,178,0.5),0_18px_50px_-18px_rgba(14,190,146,0.9)]'
          : 'border border-white/12 bg-white/[0.03] text-white/85 backdrop-blur-xl hover:bg-white/[0.07]',
        className,
      )}
    >
      {tone === 'primary' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]"
        />
      ) : null}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.span>
  )
}

/* ------------------------------------------------------------------ *
 * Ambient layers — grid, ripple rings, aurora blooms, film grain.
 * ------------------------------------------------------------------ */

export function GridOverlay({ className, size = 56 }: { className?: string; size?: number }) {
  return (
    <div
      aria-hidden
      className={cn('mk-grid-fade pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)',
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  )
}

export function RippleRings({ className, count = 5 }: { className?: string; count?: number }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: count }).map((_, index) => (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
            style={{
              width: 220 + index * 190,
              height: 220 + index * 190,
              animation: `mk-ripple ${7 + index}s ease-out ${index * 1.1}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function AuroraBloom({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="absolute -left-40 top-0 h-[34rem] w-[34rem] rounded-full opacity-40 blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(14,190,146,0.55), transparent 68%)' }}
      />
      <div
        className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.45), transparent 68%)' }}
      />
    </div>
  )
}

export function FilmGrain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('mk-noise pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay', className)}
    />
  )
}

/* ------------------------------------------------------------------ *
 * AsciiGlitch — character rain rendered on a canvas, deliberately faint.
 * ------------------------------------------------------------------ */

export function AsciiGlitch({ className, opacity = 0.16 }: { className?: string; opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const glyphs = '01<>/\\{}[]#*+=-·'
    const fontSize = 13
    let columns = 0
    let drops: number[] = []
    let last = 0
    let visible = true

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      columns = Math.max(1, Math.ceil(canvas.width / fontSize))
      drops = Array.from({ length: columns }, () => Math.random() * -40)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)

    let raf = 0
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      if (!visible || now - last < 90) return
      last = now

      ctx.fillStyle = 'rgba(3,3,3,0.22)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, monospace`

      for (let i = 0; i < columns; i++) {
        const char = glyphs[Math.floor(Math.random() * glyphs.length)]
        ctx.fillStyle = Math.random() > 0.94 ? 'rgba(45,226,178,0.85)' : 'rgba(255,255,255,0.3)'
        ctx.fillText(char, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      }
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('absolute inset-0 h-full w-full', className)}
      style={{ opacity }}
    />
  )
}
