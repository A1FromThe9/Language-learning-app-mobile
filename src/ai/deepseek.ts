export interface EnrichResult {
  definition: string
  examples: string[]
  synonyms: string[]
  partOfSpeech?: string
}

export class DeepSeekError extends Error {}

export async function enrichWord(
  term: string,
  opts: { model?: string; language?: string; signal?: AbortSignal },
): Promise<EnrichResult> {
  let res: Response
  try {
    res = await fetch('/api/enrich', {
      method: 'POST',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, model: opts.model, language: opts.language }),
    })
  } catch {
    throw new DeepSeekError('Network error reaching the server. Check your connection.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new DeepSeekError((data as { error?: string }).error ?? `Request failed (${res.status}).`)
  }

  return normalizeResult(data)
}

/** Fetch a single fresh AI-generated example sentence for a word (not cached). */
export async function fetchExampleSentence(
  term: string,
  opts: { model?: string; language?: string; avoid?: string[]; signal?: AbortSignal },
): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/example-sentence', {
      method: 'POST',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, model: opts.model, language: opts.language, avoid: opts.avoid }),
    })
  } catch {
    throw new DeepSeekError('Network error reaching the server. Check your connection.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new DeepSeekError((data as { error?: string }).error ?? `Request failed (${res.status}).`)
  }

  const sentence = (data as { sentence?: unknown }).sentence
  if (typeof sentence !== 'string' || !sentence.trim()) {
    throw new DeepSeekError('The AI response was missing a sentence.')
  }
  return sentence.trim()
}

export interface SentenceCheckResult {
  correct: boolean
  feedback: string
}

/** Ask the AI to judge a learner-written sentence that uses the given word. */
export async function checkSentence(
  term: string,
  sentence: string,
  opts: { definition?: string; model?: string; language?: string; signal?: AbortSignal },
): Promise<SentenceCheckResult> {
  let res: Response
  try {
    res = await fetch('/api/check-sentence', {
      method: 'POST',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term,
        sentence,
        definition: opts.definition,
        model: opts.model,
        language: opts.language,
      }),
    })
  } catch {
    throw new DeepSeekError('Network error reaching the server. Check your connection.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new DeepSeekError((data as { error?: string }).error ?? `Request failed (${res.status}).`)
  }

  const obj = data as { correct?: unknown; feedback?: unknown }
  if (typeof obj.correct !== 'boolean' || typeof obj.feedback !== 'string' || !obj.feedback.trim()) {
    throw new DeepSeekError('The AI response was malformed.')
  }
  return { correct: obj.correct, feedback: obj.feedback.trim() }
}

function normalizeResult(raw: unknown): EnrichResult {
  const obj = (raw ?? {}) as Record<string, unknown>
  const definition = typeof obj.definition === 'string' ? obj.definition.trim() : ''
  const examples = Array.isArray(obj.examples)
    ? obj.examples.filter((e): e is string => typeof e === 'string').map((e) => e.trim())
    : []
  const synonyms = Array.isArray(obj.synonyms)
    ? obj.synonyms.filter((s): s is string => typeof s === 'string').map((s) => s.trim())
    : []
  const partOfSpeech =
    typeof obj.partOfSpeech === 'string' ? obj.partOfSpeech.trim() : undefined

  if (!definition) throw new DeepSeekError('The AI response was missing a definition.')
  return { definition, examples, synonyms, partOfSpeech }
}
