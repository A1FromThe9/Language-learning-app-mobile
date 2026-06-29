import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { getSettings, getStats, queueCounts } from '../db/repo'

export function Home() {
  const navigate = useNavigate()
  const [quick, setQuick] = useState('')

  const settings = useLiveQuery(() => getSettings(), [])
  const stats = useLiveQuery(() => getStats(), [])
  const counts = useLiveQuery(
    async () => (settings ? queueCounts(settings) : undefined),
    [settings],
  )

  const totalDue = counts ? counts.due + counts.newCards : 0
  const nothingToReview = counts && totalDue === 0

  return (
    <div className="flex flex-col pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      <p className="mt-0.5 text-sm text-muted">
        {stats?.streak ?? 0} day streak · {stats?.reviewedToday ?? 0} reviewed
      </p>

      <div className="mt-12 mb-8">
        <p className="text-[5.5rem] font-extrabold tabular-nums leading-none tracking-tight text-fg">
          {counts === undefined ? '—' : totalDue}
        </p>
        <p className="mt-2 text-sm text-muted">
          {counts
            ? nothingToReview
              ? 'all caught up'
              : `${counts.newCards} new · ${counts.due} review`
            : 'loading…'}
        </p>
      </div>

      <Button
        block
        disabled={!counts || totalDue === 0}
        onClick={() => navigate('/review')}
        className="mb-10"
      >
        {nothingToReview ? 'All caught up' : 'Start review'}
      </Button>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const term = quick.trim()
          if (!term) return
          navigate(`/add?term=${encodeURIComponent(term)}`)
          setQuick('')
        }}
      >
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Add a word…"
          className="min-w-0 flex-1 rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
        />
        <Button type="submit" variant="soft" aria-label="Add word">
          <PlusIcon width={20} height={20} />
        </Button>
      </form>
    </div>
  )
}
