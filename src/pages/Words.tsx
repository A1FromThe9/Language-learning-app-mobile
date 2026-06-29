import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, Chip, EmptyState, PageTitle } from '../components/ui'
import { CardsIcon, EditIcon, SearchIcon, TrashIcon } from '../components/icons'
import { deleteWord, listWords } from '../db/repo'
import { db } from '../db/db'

export function Words() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const words = useLiveQuery(() => listWords(), [])
  const cardCounts = useLiveQuery(async () => {
    const all = await db.cards.toArray()
    const map: Record<string, number> = {}
    for (const c of all) map[c.wordId] = (map[c.wordId] ?? 0) + 1
    return map
  }, [])

  const filtered = (words ?? []).filter((w) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      w.term.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <PageTitle
        title="Words"
        subtitle={words ? `${words.length} in your collection` : ' '}
      />

      <div className="relative mb-4">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search words..."
          className="w-full rounded-[var(--radius-btn)] border border-border bg-surface py-3 pl-10 pr-4 text-base outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      {words && words.length === 0 ? (
        <EmptyState
          icon={<CardsIcon />}
          title="No words yet"
          body="Add the first word you want to remember and it will show up here."
          action={<Button onClick={() => navigate('/add')}>Add a word</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((w) => (
            <li key={w.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold">{w.term}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                      {w.definition}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconBtn label="Edit" onClick={() => navigate(`/add/${w.id}`)}>
                      <EditIcon width={18} height={18} />
                    </IconBtn>
                    <IconBtn label="Delete" onClick={() => setConfirmId(w.id)}>
                      <TrashIcon width={18} height={18} />
                    </IconBtn>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {w.source === 'ai' ? <Chip>AI</Chip> : null}
                  <Chip>{cardCounts?.[w.id] ?? 0} cards</Chip>
                  {w.synonyms.slice(0, 2).map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>

                {confirmId === w.id ? (
                  <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-btn)] bg-surface-2 p-2">
                    <span className="flex-1 text-sm">Delete this word and its cards?</span>
                    <Button variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await deleteWord(w.id)
                        setConfirmId(null)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
          {filtered.length === 0 && query ? (
            <p className="py-8 text-center text-sm text-muted">
              No words match "{query}".
            </p>
          ) : null}
        </ul>
      )}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-muted active:scale-95 active:bg-surface-2"
    >
      {children}
    </button>
  )
}
