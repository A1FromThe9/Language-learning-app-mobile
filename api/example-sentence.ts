import type { VercelRequest, VercelResponse } from '@vercel/node'

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `You are a precise lexicographer helping someone learn vocabulary.
Given a single word or short phrase, return one fresh, natural example sentence as strict JSON: {"sentence": "..."}.
Rules:
- The sentence must literally contain the word (or a natural inflection of it) so it can be turned into a fill-in-the-blank.
- Keep it different from any sentences the caller says it has already seen.
- One sentence only, concise and natural.
- Do not use em dashes anywhere. Respond with JSON only.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured on the server.' })

    const { term, model, language, avoid } = req.body as {
      term?: string
      model?: string
      language?: string
      avoid?: string[]
    }
    if (!term?.trim()) return res.status(400).json({ error: 'Missing term' })

    const avoidList = Array.isArray(avoid) ? avoid.filter((s): s is string => typeof s === 'string') : []
    const userPrompt = [
      language ? `Word: "${term}" (language: ${language})` : `Word: "${term}"`,
      avoidList.length ? `Already seen: ${avoidList.map((s) => `"${s}"`).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
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

    const sentence = (parsed as { sentence?: unknown })?.sentence
    if (typeof sentence !== 'string' || !sentence.trim()) {
      return res.status(502).json({ error: 'The AI response was missing a sentence.' })
    }

    return res.status(200).json({ sentence: sentence.trim() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
