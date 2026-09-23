import { cn } from '@/lib/utils'

export type TabItem<T extends string = string> = {
  id: T
  label: string
  count?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn(
        'inline-flex max-w-full flex-wrap rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white p-1 shadow-sm',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`tab-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              selected
                ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)]',
            )}
          >
            {item.label}
            {item.count != null ? (
              <span className="ml-1.5 tabular-nums opacity-70">{item.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
