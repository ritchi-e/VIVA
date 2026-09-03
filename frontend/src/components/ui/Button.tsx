import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white shadow-sm shadow-teal-900/10 hover:bg-[var(--color-primary-hover)]',
  secondary:
    'bg-white border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-sidebar-active)]',
  ghost: 'bg-transparent text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-foreground)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 py-2.5 text-[15px] font-semibold transition disabled:opacity-50',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Working…' : children}
    </button>
  ),
)
Button.displayName = 'Button'
