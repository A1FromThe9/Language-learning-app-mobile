import type { VercelRequest, VercelResponse } from '@vercel/node'

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT_FITS = `You are a precise language tutor building a multiple-choice quiz.
Given a target word and its definition, write 4 short sentences, each containing exactly one
blank written as "____".
Exactly ONE of the 4 sentences is a natural, correct context where the target word fits the
blank perfectly. The other THREE must be plausible, grammatically fine sentences where the
target word would be semantically wrong or awkward if inserted (a different word belongs there).
Keep sentences short (under 15 words) and varied in topic.
Respond with strict JSON: {"options": ["...", "...", "...", "..."], "correctIndex": <0-3, the
index of the sentence the word DOES fit>}.
Do not use em dashes anywhere. Respond with JSON only.`

const SYSTEM_PROMPT_NOT_FIT = `You are a precise language tutor building a multiple-choice quiz.
Given a target word and its definition, write 4 short sentences, each containing exactly one
blank written as "____".
Exactly ONE of the 4 sentences is one where the target word would be semantically wrong or
awkward if inserted into the blank (a different word belongs there). The other THREE must be
natural, correct contexts where the target word fits the blank perfectly.
Keep sentences short (under 15 words) and varied in topic.
Respond with strict JSON: {"options": ["...", "...", "...", "..."], "correctIndex": <0-3, the
index of the sentence the word does NOT fit>}.
Do not use em dashes anywhere. Respond with JSON only.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured on the server.' })

    const { term, definition, mode, model, language } = req.body as {
      term?: string
      definition?: string
      mode?: string
      model?: string
      language?: string
    }
    if (!term?.trim()) return res.status(400).json({ error: 'Missing term' })
    if (mode !== 'fits' && mode !== 'not-fit') return res.status(400).json({ error: 'Invalid mode' })

    const userPrompt = [
      language ? `Word: "${term}" (language: ${language})` : `Word: "${term}"`,
      definition ? `Definition: ${definition}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: mode === 'fits' ? SYSTEM_PROMPT_FITS : SYSTEM_PROMPT_NOT_FIT },
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

    const obj = parsed as { options?: unknown; correctIndex?: unknown }
    const options = Array.isArray(obj.options)
      ? obj.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map((o) => o.trim())
      : []
    const correctIndex = typeof obj.correctIndex === 'number' ? obj.correctIndex : -1

    if (options.length !== 4 || correctIndex < 0 || correctIndex > 3) {
      return res.status(502).json({ error: 'The AI response was malformed.' })
    }

    return res.status(200).json({ options, correctIndex, mode })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
