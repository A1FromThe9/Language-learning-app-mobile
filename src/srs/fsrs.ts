import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs'
import type { Card, CardType, Word } from '../db/types'

export { Rating, State }

/** The four ratings a learner gives, in display order. */
export const RATINGS: { grade: Grade; label: string; key: string }[] = [
  { grade: Rating.Again, label: 'Again', key: 'again' },
  { grade: Rating.Hard, label: 'Hard', key: 'hard' },
  { grade: Rating.Good, label: 'Good', key: 'good' },
  { grade: Rating.Easy, label: 'Easy', key: 'easy' },
]

/** Build a scheduler tuned to the learner's desired retention. */
export function makeScheduler(desiredRetention: number) {
  return fsrs(
    generatorParameters({
      request_retention: desiredRetention,
      enable_fuzz: true,
    }),
  )
}

/** Replace the term inside an example sentence with a blank for cloze cards. */
export function makeCloze(sentence: string, term: string): string | null {
  const re = new RegExp(`\\b${escapeRegExp(term)}\\w*\\b`, 'i')
  if (!re.test(sentence)) return null
  return sentence.replace(re, '_____')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Generate cards for a word given the chosen card types. One word produces up to
 * four independently scheduled cards (the Anki model). The usage card is skipped
 * when there is no usable example sentence to build a cloze from.
 */
export function createCardsForWord(
  word: Word,
  types: CardType[],
  now: Date = new Date(),
): Card[] {
  const cards: Card[] = []
  const base = () => ({
    id: crypto.randomUUID(),
    wordId: word.id,
    fsrs: createEmptyCard(now),
    createdAt: now.getTime(),
  })

  for (const type of types) {
    if (type === 'meaning') {
      cards.push({
        ...base(),
        type,
        prompt: word.term,
        answer: word.definition,
        hint: word.examples[0],
      })
    } else if (type === 'reverse') {
      cards.push({
        ...base(),
        type,
        prompt: word.definition,
        answer: word.term,
        hint: word.synonyms.length ? `Synonyms: ${word.synonyms.join(', ')}` : undefined,
      })
    } else if (type === 'typed') {
      cards.push({
        ...base(),
        type,
        prompt: word.definition,
        answer: word.term,
        hint: word.synonyms.length ? `Synonyms: ${word.synonyms.join(', ')}` : undefined,
      })
    } else if (type === 'usage') {
      const example = word.examples.find((e) => makeCloze(e, word.term))
      if (example) {
        cards.push({
          ...base(),
          type,
          prompt: makeCloze(example, word.term)!,
          answer: word.term,
          hint: word.definition,
        })
      }
    }
  }
  return cards
}

/** Apply a rating to a card and return the updated FSRS card + log item. */
export function rateCard(
  card: Card,
  grade: Grade,
  desiredRetention: number,
  now: Date = new Date(),
): RecordLogItem {
  const scheduler = makeScheduler(desiredRetention)
  return scheduler.next(card.fsrs, now, grade)
}

/** Human-readable preview of when each rating would next schedule the card. */
export function ratingIntervals(
  card: Card,
  desiredRetention: number,
  now: Date = new Date(),
): Record<string, string> {
  const scheduler = makeScheduler(desiredRetention)
  const preview = scheduler.repeat(card.fsrs, now)
  const out: Record<string, string> = {}
  for (const { grade, key } of RATINGS) {
    out[key] = formatInterval(preview[grade].card.due, now)
  }
  return out
}

function formatInterval(due: Date, now: Date): string {
  const mins = Math.round((due.getTime() - now.getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.round(months / 12)}y`
}
