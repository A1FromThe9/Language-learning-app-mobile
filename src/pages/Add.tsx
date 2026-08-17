import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, PageTitle } from '../components/ui'
import { ArrowLeftIcon, SparklesIcon, TrashIcon } from '../components/icons'
import { addWord, getSettings, getCardsForWord, updateWord } from '../db/repo'
import { db } from '../db/db'
import type { CardType } from '../db/types'
import { enrichWord, DeepSeekError } from '../ai/deepseek'

const CARD_TYPES: { type: CardType; label: string; hint: string }[] = [
  { type: 'meaning', label: 'Meaning', hint: 'word to definition' },
  { type: 'reverse', label: 'Reverse', hint: 'definition to word' },
  { type: 'typed', label: 'Typed recall', hint: 'type the word' },
  { type: 'usage', label: 'In a sentence', hint: 'fill the blank' },
  { type: 'compose', label: 'Write it', hint: 'write your own sentence' },
  { type: 'fit', label: 'Word fit', hint: 'pick the right sentence' },
]

export function Add() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)

  const [term, setTerm] = useState(searchParams.get('term') ?? '')
  const [definition, setDefinition] = useState('')
  const [examples, setExamples] = useState<string[]>([''])
  const [synonyms, setSynonyms] = useState('')
  const [notes, setNotes] = useState('')
  const [types, setTypes] = useState<CardType[]>(['meaning', 'reverse', 'typed', 'usage'])
  const [source, setSource] = useState<'manual' | 'ai'>('manual')

  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Load existing word when editing.
  useEffect(() => {
    if (!id) return
    let active = true
    ;(async () => {
      const word = await db.words.get(id)
      if (!word || !active) return
      setTerm(word.term)
      setDefinition(word.definition)
      setExamples(word.examples.length ? word.examples : [''])
      setSynonyms(word.synonyms.join(', '))
      setNotes(word.notes ?? '')
      setSource(word.source)
      const cards = await getCardsForWord(id)
      if (cards.length) setTypes([...new Set(cards.map((c) => c.type))])
    })()
    return () => {
      active = false
    }
  }, [id])

  const toggleType = (t: CardType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const handleGenerate = async () => {
    setError('')
    if (!term.trim()) {
      setError('Type a word first, then generate.')
      return
    }
    setAiBusy(true)
    try {
      const settings = await getSettings()
      const result = await enrichWord(term.trim(), {
        model: settings.deepseekModel,
      })
      setDefinition(result.definition)
      setExamples(result.examples.length ? result.examples : [''])
      setSynonyms(result.synonyms.join(', '))
      setSource('ai')
    } catch (e) {
      setError(e instanceof DeepSeekError ? e.message : 'AI enrichment failed. Try again.')
    } finally {
      setAiBusy(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!term.trim() || !definition.trim()) {
      setError('A word and a definition are required.')
      return
    }
    if (types.length === 0) {
      setError('Pick at least one card type.')
      return
    }
    setSaving(true)
    const payload = {
      term,
      definition,
      examples: examples.map((e) => e.trim()).filter(Boolean),
      synonyms: synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      notes,
      source,
    }
    try {
      if (isEdit && id) {
        await updateWord(id, payload, types)
      } else {
        await addWord(payload, types)
      }
      navigate(isEdit ? '/words' : '/')
    } catch {
      setError('Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-muted active:scale-95"
        >
          <ArrowLeftIcon width={22} height={22} />
        </button>
      </div>
      <PageTitle title={isEdit ? 'Edit word' : 'Add a word'} />

      <div className="space-y-4">
        <Field label="Word or phrase">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoFocus={!isEdit}
            placeholder="e.g. ephemeral"
            className={inputClass}
          />
        </Field>

        <Button
          variant="soft"
          block
          onClick={handleGenerate}
          disabled={aiBusy}
        >
          <SparklesIcon width={20} height={20} />
          {aiBusy ? 'Generating...' : 'Generate with AI'}
        </Button>

        <Field label="Definition">
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={2}
            placeholder="What does it mean?"
            className={inputClass}
          />
        </Field>

        <Field label="Example sentences" hint="Used to build fill-in-the-blank cards">
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={ex}
                  onChange={(e) =>
                    setExamples((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  rows={2}
                  placeholder={`Example ${i + 1}`}
                  className={inputClass}
                />
                {examples.length > 1 ? (
                  <button
                    onClick={() => setExamples((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Remove example"
                    className="grid w-10 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-surface-2 text-muted active:scale-95"
                  >
                    <TrashIcon width={18} height={18} />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              onClick={() => setExamples((prev) => [...prev, ''])}
              className="text-sm font-medium text-accent"
            >
              + Add another example
            </button>
          </div>
        </Field>

        <Field label="Synonyms" hint="Comma separated">
          <input
            value={synonyms}
            onChange={(e) => setSynonyms(e.target.value)}
            placeholder="fleeting, transient, momentary"
            className={inputClass}
          />
        </Field>

        <Field label="Notes" hint="Optional, just for you">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything that helps it stick"
            className={inputClass}
          />
        </Field>

        <Field label="Card types">
          <div className="grid grid-cols-2 gap-2">
            {CARD_TYPES.map(({ type, label, hint }) => {
              const active = types.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={[
                    'rounded-[var(--radius-btn)] border px-3 py-3 text-left transition-colors',
                    active
                      ? 'border-accent bg-accent-soft text-accent-on-soft'
                      : 'border-border bg-surface text-fg',
                  ].join(' ')}
                >
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs opacity-70">{hint}</span>
                </button>
              )
            })}
          </div>
        </Field>

        {error ? (
          <p className="rounded-[var(--radius-btn)] bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <Button block onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Save word'}
        </Button>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent resize-none'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
    </label>
  )
}
