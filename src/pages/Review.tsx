import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { ArrowLeftIcon, CheckIcon } from '../components/icons'
import { buildSession, getSettings, getWord, submitReview } from '../db/repo'
import { RATINGS, ratingIntervals, makeCloze } from '../srs/fsrs'
import { gradeTyped, type GradeVerdict } from '../srs/grade'
import { AI_GRADED_CARD_TYPES, TYPED_CARD_TYPES, type Card as CardModel, type Settings } from '../db/types'
import { checkSentence, fetchExampleSentence } from '../ai/deepseek'
import type { Grade } from 'ts-fsrs'

type Phase = 'loading' | 'reviewing' | 'done' | 'empty'

const ratingStyles: Record<string, string> = {
  again: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
  hard: 'bg-neutral-400 text-white dark:bg-neutral-500 dark:text-white',
  good: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100',
  easy: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
}

export function Review() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [queue, setQueue] = useState<CardModel[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [reviewedCount, setReviewedCount] = useState(0)

  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState('')
  const [verdict, setVerdict] = useState<GradeVerdict | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const [freshPrompt, setFreshPrompt] = useState<string | null>(null)
  const [sentenceFetching, setSentenceFetching] = useState(false)

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setSettings(s)
      const cards = await buildSession(s)
      setQueue(cards)
      setPhase(cards.length ? 'reviewing' : 'empty')
    })()
  }, [])

  const card = queue[index]
  const isTyped = card ? TYPED_CARD_TYPES.includes(card.type) : false
  const isCompose = card ? AI_GRADED_CARD_TYPES.includes(card.type) : false
  const needsInput = isTyped || isCompose
  const displayPrompt = card && card.type === 'usage' ? freshPrompt ?? card.prompt : card?.prompt

  // Usage cards get a freshly generated example sentence for every review
  // instead of reusing the cloze baked in at card-creation time.
  useEffect(() => {
    setFreshPrompt(null)
    if (!card || card.type !== 'usage') {
      setSentenceFetching(false)
      return
    }
    let cancelled = false
    setSentenceFetching(true)
    ;(async () => {
      const word = await getWord(card.wordId)
      if (!word) throw new Error('missing word')
      const sentence = await fetchExampleSentence(word.term, {
        model: settings?.deepseekModel,
        language: word.language,
        avoid: word.examples,
      })
      const cloze = makeCloze(sentence, word.term)
      if (!cloze) throw new Error('unusable sentence')
      if (!cancelled) setFreshPrompt(cloze)
    })()
      .catch(() => {
        // Fall back to the cached prompt on any failure (offline, no API key, etc.)
      })
      .finally(() => {
        if (!cancelled) setSentenceFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [card?.id])

  const intervals = useMemo(
    () => (card && settings ? ratingIntervals(card, settings.desiredRetention) : null),
    [card, settings],
  )

  const total = queue.length
  const progress = total ? Math.round((reviewedCount / total) * 100) : 0

  const resetCardState = () => {
    setRevealed(false)
    setTyped('')
    setVerdict(null)
    setFeedback(null)
    setChecking(false)
  }

  const handleCheck = async () => {
    if (!card) return
    if (isCompose) {
      setChecking(true)
      setFeedback(null)
      try {
        const result = await checkSentence(card.answer, typed, {
          definition: card.hint,
          model: settings?.deepseekModel,
        })
        setVerdict(result.correct ? 'correct' : 'wrong')
        setFeedback(result.feedback)
      } catch {
        setVerdict(null)
        setFeedback('Could not check your sentence right now. Rate yourself honestly.')
      } finally {
        setChecking(false)
        setRevealed(true)
      }
      return
    }
    setVerdict(gradeTyped(typed, card.answer))
    setRevealed(true)
  }

  const handleRate = async (grade: Grade) => {
    if (!card || !settings) return
    await submitReview(card, grade, settings.desiredRetention)
    const next = index + 1
    setReviewedCount((c) => c + 1)
    if (next >= queue.length) {
      setPhase('done')
    } else {
      setIndex(next)
      resetCardState()
    }
  }

  if (phase === 'loading') {
    return <CenteredMessage title="Loading your session..." />
  }

  if (phase === 'empty') {
    return (
      <CenteredMessage
        title="Nothing due right now"
        body="You are all caught up. Add new words or come back later when cards are due."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/')}>
              Home
            </Button>
            <Button onClick={() => navigate('/add')}>Add a word</Button>
          </div>
        }
      />
    )
  }

  if (phase === 'done') {
    return (
      <CenteredMessage
        title="Session complete"
        body={`You reviewed ${reviewedCount} ${reviewedCount === 1 ? 'card' : 'cards'}. Nicely done.`}
        action={<Button onClick={() => navigate('/')}>Back to home</Button>}
        celebrate
      />
    )
  }

  return (
    <div className="flex min-h-[100svh] flex-col pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Header: progress + exit */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          aria-label="Exit review"
          className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted active:scale-95"
        >
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted">
          {reviewedCount}/{total}
        </span>
      </div>

      {/* Card */}
      <div className="flex flex-1 flex-col justify-center py-6">
        <div key={card.id} className="animate-pop-in">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {cardTypeLabel(card.type)}
          </p>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-6 py-10 text-center">
            <p className="text-balance text-2xl font-bold leading-snug">{displayPrompt}</p>
            {card.type === 'usage' && sentenceFetching ? (
              <p className="mt-2 text-xs font-medium text-muted">Fetching a new sentence…</p>
            ) : null}

            {needsInput && !revealed ? (
              isCompose ? (
                <textarea
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  rows={3}
                  placeholder="Write your own sentence using the word above"
                  className="mt-6 w-full resize-none rounded-[var(--radius-btn)] border border-border bg-bg px-4 py-3 text-center text-lg outline-none focus:border-accent"
                />
              ) : (
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  placeholder="Type your answer"
                  className="mt-6 w-full rounded-[var(--radius-btn)] border border-border bg-bg px-4 py-3 text-center text-lg outline-none focus:border-accent"
                />
              )
            ) : null}

            {revealed ? (
              <div className="mt-6 border-t border-border pt-5 text-left">
                {verdict ? (
                  <p
                    className={[
                      'mb-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                      ratingStyles[verdict === 'correct' ? 'good' : verdict === 'almost' ? 'hard' : 'again'],
                    ].join(' ')}
                  >
                    {verdict === 'correct' ? 'Correct' : verdict === 'almost' ? 'Almost' : 'Not quite'}
                  </p>
                ) : null}
                {isCompose ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Your sentence
                    </p>
                    <p className="mt-1 text-lg font-semibold">{typed || '—'}</p>
                    {feedback ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted">{feedback}</p>
                    ) : null}
                    {card.hint ? (
                      <p className="mt-3 text-xs leading-relaxed text-muted opacity-80">{card.hint}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Answer
                    </p>
                    <p className="mt-1 text-xl font-bold text-accent">{card.answer}</p>
                    {card.hint ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted">{card.hint}</p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {!revealed ? (
          needsInput ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setRevealed(true)} disabled={checking}>
                Skip
              </Button>
              <Button block onClick={handleCheck} disabled={!typed.trim() || checking}>
                <CheckIcon width={20} height={20} />
                {checking ? 'Checking...' : 'Check'}
              </Button>
            </div>
          ) : (
            <Button block onClick={() => setRevealed(true)}>
              Show answer
            </Button>
          )
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map(({ grade, label, key }) => (
              <button
                key={key}
                onClick={() => handleRate(grade)}
                className={[
                  'flex flex-col items-center gap-0.5 rounded-[var(--radius-btn)] py-3 font-semibold transition-transform active:scale-95',
                  ratingStyles[key],
                ].join(' ')}
              >
                <span className="text-sm">{label}</span>
                {intervals ? (
                  <span className="text-[11px] font-medium opacity-80">
                    {intervals[key]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function cardTypeLabel(type: CardModel['type']): string {
  switch (type) {
    case 'meaning':
      return 'What does this mean?'
    case 'reverse':
      return 'Which word fits?'
    case 'typed':
      return 'Type the word'
    case 'usage':
      return 'Fill in the blank'
    case 'compose':
      return 'Write a sentence'
  }
}

function CenteredMessage({
  title,
  body,
  action,
  celebrate,
}: {
  title: string
  body?: string
  action?: React.ReactNode
  celebrate?: boolean
}) {
  return (
    <div className="flex min-h-[80svh] flex-col items-center justify-center text-center">
      {celebrate ? <div className="mb-4 text-5xl">🎉</div> : null}
      <h2 className="text-xl font-bold">{title}</h2>
      {body ? <p className="mt-2 max-w-xs text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
