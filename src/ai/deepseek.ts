/**
 * DeepSeek enrichment client. DeepSeek exposes an OpenAI-compatible REST API, so
 * we call it directly from the browser with the user's key (stored locally in
 * Settings). For a personal local-first app this is fine; if the app is ever
 * hosted for others, route this through a small server-side proxy to hide the key.
 */

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

export interface EnrichResult {
  definition: string
  examples: string[]
  synonyms: string[]
  partOfSpeech?: string
}

export class DeepSeekError extends Error {}

const SYSTEM_PROMPT = `You are a precise lexicographer helping someone learn vocabulary.
Given a single word or short phrase, return a concise, accurate entry as strict JSON.
Rules:
- "definition": one clear sentence, plain language, no restating the word itself.
- "examples": 3 natural example sentences that USE the word in context. Each sentence must literally contain the word so it can be turned into a fill-in-the-blank.
- "synonyms": up to 5 close synonyms (empty array if none fit).
- "partOfSpeech": e.g. noun, verb, adjective.
Do not use em dashes anywhere. Respond with JSON only.`

export async function enrichWord(
  term: string,
  opts: { apiKey: string; model?: string; language?: string; signal?: AbortSignal },
): Promise<EnrichResult> {
  if (!opts.apiKey) {
    throw new DeepSeekError('Add your DeepSeek API key in Settings to use AI enrichment.')
  }

  const userPrompt = opts.language
    ? `Word: "${term}" (language: ${opts.language})`
    : `Word: "${term}"`

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })
  } catch {
    throw new DeepSeekError('Network error reaching DeepSeek. Check your connection.')
  }

  if (res.status === 401) {
    throw new DeepSeekError('DeepSeek rejected the API key. Check it in Settings.')
  }
  if (!res.ok) {
    throw new DeepSeekError(`DeepSeek request failed (${res.status}). Try again shortly.`)
  }

  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) throw new DeepSeekError('DeepSeek returned an empty response.')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new DeepSeekError('Could not parse the AI response. Try again.')
  }

  return normalizeResult(parsed)
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
