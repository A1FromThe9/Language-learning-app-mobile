import type { Card as FsrsCard, ReviewLog as FsrsReviewLog } from 'ts-fsrs'

/** The four flavours of card we generate per word. */
export type CardType = 'meaning' | 'reverse' | 'typed' | 'usage'

/** Cards that need keyboard input and are auto-graded. */
export const TYPED_CARD_TYPES: CardType[] = ['typed', 'usage']

export interface Word {
  id: string
  term: string
  language?: string
  definition: string
  examples: string[]
  synonyms: string[]
  notes?: string
  source: 'manual' | 'ai'
  createdAt: number
}

export interface Card {
  id: string
  wordId: string
  type: CardType
  /** What the learner is shown. */
  prompt: string
  /** The expected answer (the term, or its meaning). */
  answer: string
  /** Optional supporting hint shown after a reveal. */
  hint?: string
  /** FSRS scheduling state. `due` is the field we index and query on. */
  fsrs: FsrsCard
  createdAt: number
}

export interface ReviewLogEntry extends FsrsReviewLog {
  id: string
  cardId: string
  reviewedAt: number
}

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  id: number // always 1
  deepseekApiKey: string
  deepseekModel: string
  dailyNewLimit: number
  dailyReviewLimit: number
  desiredRetention: number
  theme: ThemePref
}

export const SETTINGS_ID = 1

export const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  dailyNewLimit: 10,
  dailyReviewLimit: 200,
  desiredRetention: 0.9,
  theme: 'system',
}
