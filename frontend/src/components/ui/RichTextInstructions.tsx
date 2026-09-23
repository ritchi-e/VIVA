import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, Italic, List, Underline } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Allow only formatting tags used by the instructions editor. */
export function sanitizeInstructionsHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'P', 'BR', 'DIV'])

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        if (!allowed.has(el.tagName)) {
          while (el.firstChild) {
            node.insertBefore(el.firstChild, el)
          }
          node.removeChild(el)
          continue
        }
        for (const attr of Array.from(el.attributes)) {
          el.removeAttribute(attr.name)
        }
        walk(el)
      }
    }
  }

  walk(doc.body)
  return doc.body.innerHTML
}

export function instructionsToPlainText(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

export function InstructionsHtml({
  html,
  className,
  empty = 'No instructions.',
}: {
  html?: string | null
  className?: string
  empty?: string
}) {
  const clean = sanitizeInstructionsHtml(html || '')
  if (!instructionsToPlainText(clean)) {
    return <p className={cn('text-sm text-[var(--color-muted)]', className)}>{empty}</p>
  }
  return (
    <div
      className={cn(
        'prose-instructions text-sm text-[var(--color-foreground)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:my-0.5',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

function ToolbarButton({
  label,
  onMouseDown,
  children,
}: {
  label: string
  onMouseDown: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown()
      }}
      className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
    >
      {children}
    </button>
  )
}

export function RichTextInstructions({
  label = 'Instructions',
  value,
  onChange,
  placeholder = 'Instructions (optional)',
}: {
  label?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef(value)
  const [showPlaceholder, setShowPlaceholder] = useState(!instructionsToPlainText(value))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value !== lastEmitted.current) {
      el.innerHTML = value || ''
      lastEmitted.current = value
      setShowPlaceholder(!instructionsToPlainText(value))
    }
  }, [value])

  const emit = () => {
    const el = ref.current
    if (!el) return
    const html = sanitizeInstructionsHtml(el.innerHTML)
    lastEmitted.current = html
    setShowPlaceholder(!instructionsToPlainText(html))
    onChange(html)
  }

  const run = (command: string) => {
    ref.current?.focus()
    document.execCommand(command, false)
    emit()
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-semibold text-[var(--color-foreground)]">{label}</label>
      ) : null}
      <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 px-1.5 py-1">
          <ToolbarButton label="Bold" onMouseDown={() => run('bold')}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Italic" onMouseDown={() => run('italic')}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Underline" onMouseDown={() => run('underline')}>
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Bullet list" onMouseDown={() => run('insertUnorderedList')}>
            <List className="h-4 w-4" />
          </ToolbarButton>
        </div>
        <div className="relative">
          {showPlaceholder ? (
            <span className="pointer-events-none absolute left-3.5 top-2.5 text-[15px] text-[var(--color-muted)]">
              {placeholder}
            </span>
          ) : null}
          <div
            ref={ref}
            role="textbox"
            aria-multiline
            contentEditable
            suppressContentEditableWarning
            className={cn(
              'mk-focus-ring min-h-[7.5rem] px-3.5 py-2.5 text-[15px] outline-none',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
            )}
            onInput={emit}
            onBlur={emit}
          />
        </div>
      </div>
    </div>
  )
}
