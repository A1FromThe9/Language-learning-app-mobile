import type { VercelRequest, VercelResponse } from '@vercel/node'

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `You are a strict but encouraging language tutor.
The learner is given a word and writes their own sentence using it. Judge whether the
sentence is grammatically correct AND uses the word with a correct, natural meaning
given its definition. Minor unrelated typos should not fail the sentence.
Respond with strict JSON: {"correct": boolean, "feedback": "..."}.
"feedback" is one short sentence: if correct, briefly affirm why it works; if incorrect,
briefly say what is wrong (wrong meaning, wrong grammar, or the word is missing/misused).
Do not use em dashes anywhere. Respond with JSON only.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured on the server.' })

    const { term, sentence, definition, model, language } = req.body as {
      term?: string
      sentence?: string
      definition?: string
      model?: string
      language?: string
    }
    if (!term?.trim()) return res.status(400).json({ error: 'Missing term' })
    if (!sentence?.trim()) return res.status(400).json({ error: 'Missing sentence' })

    const userPrompt = [
      language ? `Word: "${term}" (language: ${language})` : `Word: "${term}"`,
      definition ? `Definition: ${definition}` : null,
      `Learner's sentence: "${sentence}"`,
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
        temperature: 0.2,
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

    const obj = parsed as { correct?: unknown; feedback?: unknown }
    if (typeof obj.correct !== 'boolean' || typeof obj.feedback !== 'string' || !obj.feedback.trim()) {
      return res.status(502).json({ error: 'The AI response was malformed.' })
    }

    return res.status(200).json({ correct: obj.correct, feedback: obj.feedback.trim() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
