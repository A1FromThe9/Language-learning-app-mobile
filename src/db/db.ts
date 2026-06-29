import Dexie, { type EntityTable } from 'dexie'
import type { Word, Card, ReviewLogEntry, Settings } from './types'

/**
 * Local-first store. Everything lives in the browser via IndexedDB, so the app
 * works fully offline and needs no backend. `cards.fsrs.due` is indexed so the
 * review queue can be queried efficiently with a range scan.
 */
export const db = new Dexie('lexa') as Dexie & {
  words: EntityTable<Word, 'id'>
  cards: EntityTable<Card, 'id'>
  reviewLogs: EntityTable<ReviewLogEntry, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  words: 'id, term, createdAt',
  cards: 'id, wordId, type, fsrs.due, createdAt',
  reviewLogs: 'id, cardId, reviewedAt',
  settings: 'id',
})
