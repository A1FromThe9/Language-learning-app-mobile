import { Rating } from 'ts-fsrs'
import type { Grade } from 'ts-fsrs'

export type GradeVerdict = 'correct' | 'almost' | 'wrong'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(a|an|the|to)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

/**
 * Compare a typed answer against the expected one. Tolerant of case, accents,
 * articles, and small typos so a single slip is not punished as "wrong".
 */
export function gradeTyped(input: string, expected: string): GradeVerdict {
  const a = normalize(input)
  const b = normalize(expected)
  if (!a) return 'wrong'
  if (a === b) return 'correct'
  const distance = levenshtein(a, b)
  const tolerance = b.length <= 4 ? 1 : 2
  if (distance <= tolerance) return 'almost'
  return 'wrong'
}

/** Map a self-assessment or typed verdict to an FSRS grade. */
export function verdictToGrade(verdict: GradeVerdict): Grade {
  if (verdict === 'correct') return Rating.Good
  if (verdict === 'almost') return Rating.Hard
  return Rating.Again
}
