import { Badge } from '@/components/ui/Badge'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

const SUBMISSION: Record<string, { label: string; tone: Tone }> = {
  uploaded: { label: 'Uploaded', tone: 'info' },
  queued: { label: 'Queued', tone: 'info' },
  processing: { label: 'Preparing', tone: 'info' },
  ready: { label: 'Ready for viva', tone: 'success' },
  failed: { label: 'Needs attention', tone: 'danger' },
}

const VIVA: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: 'Created', tone: 'default' },
  PREPARING: { label: 'Preparing', tone: 'info' },
  READY: { label: 'Ready', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  PAUSED: { label: 'Paused', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  FAILED: { label: 'Could not finish', tone: 'danger' },
  REVIEW_REQUIRED: { label: 'Awaiting review', tone: 'warning' },
}

const ASSESSMENT: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'default' },
  pending_review: { label: 'Needs review', tone: 'warning' },
  modified: { label: 'Modified', tone: 'info' },
  finalized: { label: 'Finalized', tone: 'success' },
}

const ASSIGNMENT: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'default' },
  published: { label: 'Published', tone: 'success' },
  closed: { label: 'Closed', tone: 'default' },
}

const BOOKING: Record<string, { label: string; tone: Tone }> = {
  booked: { label: 'Booked', tone: 'info' },
  started: { label: 'Started', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'default' },
  no_show: { label: 'Missed', tone: 'warning' },
}

const MAPS = {
  submission: SUBMISSION,
  viva: VIVA,
  assessment: ASSESSMENT,
  assignment: ASSIGNMENT,
  booking: BOOKING,
} as const

export type StatusKind = keyof typeof MAPS

export function statusMeta(kind: StatusKind, value?: string | null) {
  if (!value) return { label: '—', tone: 'default' as Tone }
  const hit = MAPS[kind][value]
  if (hit) return hit
  return { label: value.replace(/_/g, ' '), tone: 'default' as Tone }
}

export function StatusBadge({
  kind,
  value,
  className,
}: {
  kind: StatusKind
  value?: string | null
  className?: string
}) {
  const { label, tone } = statusMeta(kind, value)
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  )
}
