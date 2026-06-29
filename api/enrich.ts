import type { VercelRequest, VercelResponse } from '@vercel/node'

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `You are a precise lexicographer helping someone learn vocabulary.
Given a single word or short phrase, return a concise, accurate entry as strict JSON.
Rules:
- "definition": one clear sentence, plain language, no restating the word itself.
- "examples": 3 natural example sentences that USE the word in context. Each sentence must literally contain the word so it can be turned into a fill-in-the-blank.
- "synonyms": up to 5 close synonyms (empty array if none fit).
- "partOfSpeech": e.g. noun, verb, adjective.
Do not use em dashes anywhere. Respond with JSON only.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured on the server.' })

    const { term, model, language } = req.body as { term?: string; model?: string; language?: string }
    if (!term?.trim()) return res.status(400).json({ error: 'Missing term' })

    const userPrompt = language ? `Word: "${term}" (language: ${language})` : `Word: "${term}"`

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })

    if (upstream.status === 401) return res.status(502).json({ error: 'DeepSeek rejected the API key — check DEEPSEEK_API_KEY in Vercel env vars.' })
    if (!upstream.ok) return res.status(502).json({ error: `DeepSeek request failed (${upstream.status}).` })

    const data = await upstream.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) return res.status(502).json({ error: 'DeepSeek returned an empty response.' })

    let parsed: unknown
    try { parsed = JSON.parse(content) } catch { return res.status(502).json({ error: 'Could not parse AI response.' }) }

    return res.status(200).json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
