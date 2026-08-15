/** Normalize examiner question text for clearer browser TTS. */

const ROTATION_LABELS: Record<string, string> = {
  LL: 'left-left',
  LR: 'left-right',
  RL: 'right-left',
  RR: 'right-right',
}

const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/\bAVL trees?\b/gi, 'A V L trees'],
  [/\bAVL\b/gi, 'A V L'],
  [/\bBSTs?\b/gi, 'binary search tree'],
  [/\bDFS\b/gi, 'depth-first search'],
  [/\bBFS\b/gi, 'breadth-first search'],
  [/\bO\s*\(\s*log\s*n\s*\)/gi, 'order log n'],
  [/\bO\s*\(\s*n\s*log\s*n\s*\)/gi, 'order n log n'],
  [/\bO\s*\(\s*n\s*\)/gi, 'order n'],
  [/\bO\s*\(\s*1\s*\)/gi, 'order one'],
]

/** Spell letter-by-letter so TTS does not garble short acronyms. */
const SPELLED_ACRONYMS: Record<string, string> = {
  API: 'A P I',
  CPU: 'C P U',
  HTTP: 'H T T P',
  IO: 'I O',
  JSON: 'J S O N',
  RAM: 'R A M',
  SQL: 'S Q L',
  UI: 'U I',
  URL: 'U R L',
}

function expandRotationLists(text: string): string {
  return text.replace(
    /\b(LL|LR|RL|RR)(?:\s*\/\s*(LL|LR|RL|RR))+\b/g,
    (match) =>
      match
        .split('/')
        .map((part) => part.trim())
        .map((code) => ROTATION_LABELS[code] ?? code)
        .join(', '),
  )
}

function expandRotations(text: string): string {
  return text.replace(/\b(LL|LR|RL|RR)\b/g, (code) => ROTATION_LABELS[code] ?? code)
}

function spellAcronyms(text: string): string {
  return text.replace(/\b([A-Z]{2,5})\b/g, (token) => SPELLED_ACRONYMS[token] ?? token)
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}

function softenCodeTokens(text: string): string {
  return text.replace(/\b([a-z]+(?:_[a-z]+)+)\b/gi, (token) => token.replace(/_/g, ' '))
}

export function prepareSpeechText(text: string): string {
  let result = stripMarkdownForSpeech(text.trim())

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }

  result = expandRotationLists(result)
  result = expandRotations(result)
  result = spellAcronyms(result)
  result = softenCodeTokens(result)
  result = result.replace(/\s+/g, ' ').trim()

  return result
}
