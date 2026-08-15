import { db } from './db'
import {
  DEFAULT_SETTINGS,
  SETTINGS_ID,
  type Card,
  type CardType,
  type Settings,
  type Word,
} from './types'
import { createCardsForWord, rateCard } from '../srs/fsrs'
import type { Grade } from 'ts-fsrs'

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

/** Read-only: safe to call inside a live query. Falls back to defaults. */
export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID)
  return existing ? { ...DEFAULT_SETTINGS, ...existing } : DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: SETTINGS_ID })
}

/* -------------------------------------------------------------------------- */
/* Words + cards                                                               */
/* -------------------------------------------------------------------------- */

export interface NewWordInput {
  term: string
  definition: string
  examples?: string[]
  synonyms?: string[]
  notes?: string
  language?: string
  source?: Word['source']
}

export async function addWord(
  input: NewWordInput,
  cardTypes: CardType[],
): Promise<Word> {
  const now = new Date()
  const word: Word = {
    id: crypto.randomUUID(),
    term: input.term.trim(),
    definition: input.definition.trim(),
    examples: (input.examples ?? []).map((e) => e.trim()).filter(Boolean),
    synonyms: (input.synonyms ?? []).map((s) => s.trim()).filter(Boolean),
    notes: input.notes?.trim() || undefined,
    language: input.language?.trim() || undefined,
    source: input.source ?? 'manual',
    createdAt: now.getTime(),
  }
  const cards = createCardsForWord(word, cardTypes, now)
  await db.transaction('rw', db.words, db.cards, async () => {
    await db.words.add(word)
    await db.cards.bulkAdd(cards)
  })
  return word
}

/** Update a word's content and rebuild its cards while keeping schedule where possible. */
export async function updateWord(
  wordId: string,
  patch: Partial<NewWordInput>,
  cardTypes: CardType[],
): Promise<void> {
  await db.transaction('rw', db.words, db.cards, async () => {
    const word = await db.words.get(wordId)
    if (!word) return
    const updated: Word = {
      ...word,
      ...patch,
      term: (patch.term ?? word.term).trim(),
      definition: (patch.definition ?? word.definition).trim(),
      examples: (patch.examples ?? word.examples).map((e) => e.trim()).filter(Boolean),
      synonyms: (patch.synonyms ?? word.synonyms).map((s) => s.trim()).filter(Boolean),
    }
    await db.words.put(updated)

    // Keep existing schedule for card types that still exist; add/remove deltas.
    const existing = await db.cards.where('wordId').equals(wordId).toArray()
    const existingByType = new Map(existing.map((c) => [c.type, c]))
    const rebuilt = createCardsForWord(updated, cardTypes)

    const keepTypes = new Set(cardTypes)
    const toDelete = existing.filter((c) => !keepTypes.has(c.type)).map((c) => c.id)
    if (toDelete.length) await db.cards.bulkDelete(toDelete)

    for (const card of rebuilt) {
      const prev = existingByType.get(card.type)
      if (prev) {
        // preserve FSRS state, refresh prompt/answer/hint
        await db.cards.put({ ...prev, prompt: card.prompt, answer: card.answer, hint: card.hint })
      } else {
        await db.cards.add(card)
      }
    }
  })
}

export async function deleteWord(wordId: string): Promise<void> {
  await db.transaction('rw', db.words, db.cards, db.reviewLogs, async () => {
    const cards = await db.cards.where('wordId').equals(wordId).toArray()
    const cardIds = cards.map((c) => c.id)
    await db.cards.bulkDelete(cardIds)
    for (const id of cardIds) {
      await db.reviewLogs.where('cardId').equals(id).delete()
    }
    await db.words.delete(wordId)
  })
}

export async function listWords(): Promise<Word[]> {
  return db.words.orderBy('createdAt').reverse().toArray()
}

export async function getCardsForWord(wordId: string): Promise<Card[]> {
  return db.cards.where('wordId').equals(wordId).toArray()
}

export async function getWord(wordId: string): Promise<Word | undefined> {
  return db.words.get(wordId)
}

/* -------------------------------------------------------------------------- */
/* Review queue                                                                */
/* -------------------------------------------------------------------------- */

export interface QueueCounts {
  due: number
  newCards: number
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Build today's review session, respecting daily new/review limits. New cards
 * (FSRS state New) are capped by `dailyNewLimit`; due review cards by
 * `dailyReviewLimit`. Cards already reviewed today are excluded.
 */
export async function buildSession(settings: Settings): Promise<Card[]> {
  const now = new Date()
  const all = await db.cards.toArray()

  const reviewedTodayIds = await reviewedTodayCardIds()

  const dueNow = all.filter(
    (c) => new Date(c.fsrs.due).getTime() <= now.getTime() && !reviewedTodayIds.has(c.id),
  )
  const isNew = (c: Card) => c.fsrs.reps === 0
  const newCards = dueNow.filter(isNew).slice(0, settings.dailyNewLimit)
  const reviewCards = dueNow.filter((c) => !isNew(c)).slice(0, settings.dailyReviewLimit)

  // Interleave: reviews first (memory priority), then new, lightly shuffled.
  return shuffle([...reviewCards, ...newCards])
}

export async function queueCounts(settings: Settings): Promise<QueueCounts> {
  const now = new Date()
  const all = await db.cards.toArray()
  const reviewedTodayIds = await reviewedTodayCardIds()
  const dueNow = all.filter(
    (c) => new Date(c.fsrs.due).getTime() <= now.getTime() && !reviewedTodayIds.has(c.id),
  )
  const isNew = (c: Card) => c.fsrs.reps === 0
  return {
    newCards: Math.min(dueNow.filter(isNew).length, settings.dailyNewLimit),
    due: Math.min(dueNow.filter((c) => !isNew(c)).length, settings.dailyReviewLimit),
  }
}

async function reviewedTodayCardIds(): Promise<Set<string>> {
  const since = startOfToday().getTime()
  const logs = await db.reviewLogs.where('reviewedAt').aboveOrEqual(since).toArray()
  return new Set(logs.map((l) => l.cardId))
}

/** Record a rating: reschedule the card and append a review log. */
export async function submitReview(
  card: Card,
  grade: Grade,
  desiredRetention: number,
): Promise<void> {
  const now = new Date()
  const { card: nextCard, log } = rateCard(card, grade, desiredRetention, now)
  await db.transaction('rw', db.cards, db.reviewLogs, async () => {
    await db.cards.update(card.id, { fsrs: nextCard })
    await db.reviewLogs.add({
      ...log,
      id: crypto.randomUUID(),
      cardId: card.id,
      reviewedAt: now.getTime(),
    })
  })
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                       */
/* -------------------------------------------------------------------------- */

export interface Stats {
  totalWords: number
  totalCards: number
  reviewedToday: number
  streak: number
}

export async function getStats(): Promise<Stats> {
  const [totalWords, totalCards, logs] = await Promise.all([
    db.words.count(),
    db.cards.count(),
    db.reviewLogs.orderBy('reviewedAt').toArray(),
  ])
  const days = new Set(logs.map((l) => dayKey(l.reviewedAt)))
  const reviewedToday = logs.filter((l) => l.reviewedAt >= startOfToday().getTime()).length
  return { totalWords, totalCards, reviewedToday, streak: streakFromDays(days) }
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Count consecutive days ending today (or yesterday) with at least one review. */
function streakFromDays(days: Set<string>): number {
  let streak = 0
  const cursor = new Date()
  // Allow the streak to still count if the user hasn't reviewed yet today.
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/* -------------------------------------------------------------------------- */
/* Backup (export / import)                                                     */
/* -------------------------------------------------------------------------- */

export interface Backup {
  version: 1
  exportedAt: number
  words: Word[]
  cards: Card[]
}

export async function exportData(): Promise<Backup> {
  const [words, cards] = await Promise.all([db.words.toArray(), db.cards.toArray()])
  return { version: 1, exportedAt: Date.now(), words, cards }
}

export async function importData(backup: Backup, replace: boolean): Promise<void> {
  await db.transaction('rw', db.words, db.cards, async () => {
    if (replace) {
      await db.words.clear()
      await db.cards.clear()
    }
    await db.words.bulkPut(backup.words)
    await db.cards.bulkPut(backup.cards)
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.words, db.cards, db.reviewLogs, async () => {
    await db.words.clear()
    await db.cards.clear()
    await db.reviewLogs.clear()
  })
}

/* -------------------------------------------------------------------------- */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
