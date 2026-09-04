import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, AudioLines, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATES = [
  { icon: AudioLines, label: 'Listening to the candidate' },
  { icon: ShieldCheck, label: 'Session integrity verified' },
  { icon: Sparkles, label: 'Rubric scored from evidence' },
] as const

/**
 * Apple-style dynamic island: an ambient status pill that morphs into the
 * primary call to action when the pointer enters it.
 */
export function DynamicIslandCTA({ to = '/register', className }: { to?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % STATES.length), 2600)
    return () => window.clearInterval(timer)
  }, [open])

  const active = STATES[index]

  return (
    <motion.div
      layout
      onHoverStart={() => setOpen(true)}
      onHoverEnd={() => setOpen(false)}
      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.7 }}
      className={cn(
        'relative inline-flex items-center overflow-hidden rounded-full border border-[color:var(--mk-border)] bg-[color:var(--mk-ink-70)] p-1.5 backdrop-blur-2xl',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_70px_-30px_rgba(45,226,178,0.65)]',
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.div
            key="cta"
            layout
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.24 }}
            className="flex items-center gap-2"
          >
            <Link
              to={to}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#3fe9bd] to-[#0ebe92] px-6 py-3 text-sm font-semibold text-[#03231e]"
            >
              Start your first viva
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <span className="whitespace-nowrap px-3 pr-4 text-xs mk-text-45">Free · no card</span>
          </motion.div>
        ) : (
          <motion.div
            key={active.label}
            layout
            initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2.5 px-4 py-2.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2de2b2] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2de2b2]" />
            </span>
            <active.icon className="h-4 w-4 mk-text-60" />
            <span className="whitespace-nowrap text-sm mk-text-70">{active.label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
