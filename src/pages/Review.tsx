import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { ArrowLeftIcon, CheckIcon } from '../components/icons'
import { buildSession, getSettings, submitReview } from '../db/repo'
import { RATINGS, ratingIntervals } from '../srs/fsrs'
import { gradeTyped, type GradeVerdict } from '../srs/grade'
import { TYPED_CARD_TYPES, type Card as CardModel, type Settings } from '../db/types'
import type { Grade } from 'ts-fsrs'

type Phase = 'loading' | 'reviewing' | 'done' | 'empty'

const ratingStyles: Record<string, string> = {
  again: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  hard: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  good: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  easy: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
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
  }

  const handleCheck = () => {
    if (!card) return
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
          <p className="mb-3 text-center text-xs text-muted">
            {cardTypeLabel(card.type)}
          </p>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-6 py-10 text-center">
            <p className="text-balance text-2xl font-bold leading-snug">{card.prompt}</p>

            {isTyped && !revealed ? (
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                placeholder="Type your answer"
                className="mt-6 w-full rounded-[var(--radius-btn)] border border-border bg-bg px-4 py-3 text-center text-lg outline-none focus:border-accent"
              />
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Answer
                </p>
                <p className="mt-1 text-xl font-bold text-accent">{card.answer}</p>
                {card.hint ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted">{card.hint}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {!revealed ? (
          isTyped ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setRevealed(true)}>
                Skip
              </Button>
              <Button block onClick={handleCheck} disabled={!typed.trim()}>
                <CheckIcon width={20} height={20} />
                Check
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
