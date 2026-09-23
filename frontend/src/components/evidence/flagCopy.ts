export const FLAG_COPY: Record<string, { label: string; guidance: string }> = {
  inconsistency: {
    label: 'Inconsistent explanation',
    guidance: 'Compare the answer with the submission excerpt before deciding.',
  },
  insufficient_evidence: {
    label: 'Weak evidence',
    guidance: 'Ask whether the student cited enough from their own work.',
  },
  unsupported_claim: {
    label: 'Unsupported claim',
    guidance: 'Check whether the claim appears in the submission.',
  },
  possible_misunderstanding: {
    label: 'Unclear understanding',
    guidance: 'Listen to the dialogue and decide if the concept was grasped.',
  },
  requires_review: {
    label: 'Requires review',
    guidance: 'Open the question evidence and record your decision.',
  },
}

export function flagLabel(flagType: string) {
  return FLAG_COPY[flagType]?.label ?? flagType.replace(/_/g, ' ')
}

export function flagGuidance(flagType: string) {
  return FLAG_COPY[flagType]?.guidance ?? 'Review the linked question and decide next steps.'
}
