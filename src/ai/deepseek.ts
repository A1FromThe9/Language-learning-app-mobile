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
