import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { formatScore } from '@/lib/utils'
import { flagGuidance, flagLabel } from '@/components/evidence/flagCopy'
import type { EvidenceQuestionDetail } from '@/types'

interface QuestionDrillDownProps {
  detail: EvidenceQuestionDetail
  onFlag?: () => void
}

export function QuestionDrillDown({ detail, onFlag }: QuestionDrillDownProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const evaln = detail.evaluation

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Q{detail.sequence}</Badge>
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {detail.question_type.replace(/_/g, ' ')}
          </span>
          {detail.provenance_completeness === 'limited' ? (
            <Badge tone="warning">Limited evidence trail</Badge>
          ) : (
            <Badge tone="success">Evidence trail complete</Badge>
          )}
          {evaln?.confidence ? <Badge>{evaln.confidence.replace(/_/g, ' ')}</Badge> : null}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{detail.question_text}</p>
          {detail.topic ? <p className="mt-1 text-xs text-slate-500">Topic: {detail.topic}</p> : null}
          {detail.purpose ? <p className="mt-1 text-xs text-slate-500">Purpose: {detail.purpose}</p> : null}
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Why this was asked</p>
          {detail.why_asked.rationale ? (
            <p className="mt-2 text-sm text-slate-700">{detail.why_asked.rationale}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No rationale recorded.</p>
          )}
          {detail.why_asked.source_ref ? (
            <p className="mt-2 text-xs text-slate-500">Source: {detail.why_asked.source_ref}</p>
          ) : null}
          {detail.why_asked.excerpt ? (
            <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-700">
              {detail.why_asked.excerpt}
            </blockquote>
          ) : null}
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Student answer</p>
          {detail.student_answer ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{detail.student_answer.text}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No answer recorded.</p>
          )}
        </div>

        {evaln ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>AI assessment</Badge>
              <span className="text-sm font-semibold text-slate-900">
                Score {formatScore(evaln.overall)} / 10
              </span>
              {evaln.evidence_quality ? (
                <span className="text-xs text-slate-500">
                  Evidence: {evaln.evidence_quality.replace(/_/g, ' ')}
                </span>
              ) : null}
            </div>
            {evaln.explanation ? <p className="mt-2 text-sm text-slate-700">{evaln.explanation}</p> : null}
          </div>
        ) : null}

        {detail.supporting_evidence.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Supporting evidence</p>
            <div className="mt-2 space-y-2">
              {detail.supporting_evidence.map((item) => (
                <div key={item.chunk_id} className="rounded border border-slate-200 p-2 text-sm text-slate-700">
                  <p className="text-xs text-slate-500">
                    {(item.location.source_ref as string) || item.chunk_id}
                  </p>
                  <p className="mt-1">{item.quote}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {detail.flags.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Flags</p>
            {detail.flags.map((flag) => (
              <div key={flag.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-sm">
                <Badge tone="warning">{flagLabel(flag.flag_type)}</Badge>
                <p className="mt-1 text-slate-700">{flag.description}</p>
                <p className="mt-1 text-xs text-slate-500">{flagGuidance(flag.flag_type)}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide technical details' : 'Show technical details'}
          </Button>
          {onFlag ? (
            <Button variant="secondary" onClick={onFlag}>
              Flag for review
            </Button>
          ) : null}
        </div>

        {showAdvanced ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
            <p>Retrieval query: {detail.why_asked.retrieval_query || '—'}</p>
            <p>Model: {detail.ai_provenance.model_name || '—'}</p>
            <p>Provider: {detail.ai_provenance.model_provider || '—'}</p>
            <p>Prompt version: {detail.ai_provenance.prompt_version || '—'}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
