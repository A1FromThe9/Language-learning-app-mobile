import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, PageTitle } from '../components/ui'
import { FlameIcon, PlusIcon, SparklesIcon } from '../components/icons'
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
    <div>
      <PageTitle
        title="Today"
        subtitle="A few minutes of recall keeps words from slipping away."
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted">
            <FlameIcon width={18} height={18} />
            <span className="text-xs font-medium">Streak</span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {stats?.streak ?? 0}
            <span className="ml-1 text-sm font-medium text-muted">days</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted">Reviewed today</div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {stats?.reviewedToday ?? 0}
          </p>
        </Card>
      </div>

      <Card className="mb-5 overflow-hidden">
        <div className="bg-accent-soft px-5 py-6">
          <p className="text-sm font-medium text-accent-on-soft">Due now</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-accent-on-soft">
            {totalDue}
            <span className="ml-2 text-base font-medium">
              {totalDue === 1 ? 'card' : 'cards'}
            </span>
          </p>
          {counts ? (
            <p className="mt-1 text-xs text-accent-on-soft/80">
              {counts.newCards} new · {counts.due} review
            </p>
          ) : null}
        </div>
        <div className="p-4">
          <Button
            block
            disabled={!counts || totalDue === 0}
            onClick={() => navigate('/review')}
          >
            {nothingToReview ? 'All caught up' : 'Start review'}
          </Button>
        </div>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const term = quick.trim()
          if (!term) return
          navigate(`/add?term=${encodeURIComponent(term)}`)
        }}
      >
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Quick add a word..."
          className="min-w-0 flex-1 rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
        />
        <Button type="submit" variant="soft" aria-label="Add word">
          <PlusIcon width={20} height={20} />
        </Button>
      </form>

      <button
        onClick={() => navigate('/add')}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] border border-dashed border-border py-3 text-sm font-medium text-muted active:scale-[0.99]"
      >
        <SparklesIcon width={18} height={18} />
        Add a word with AI definitions
      </button>
    </div>
  )
}
