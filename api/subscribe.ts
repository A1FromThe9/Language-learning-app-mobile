import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadSubs, saveSubs } from './_subs.js'
import type { Sub } from './_subs.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const sub = req.body as Sub
      if (!sub?.endpoint) return res.status(400).json({ error: 'Missing endpoint' })
      const list = await loadSubs()
      await saveSubs([...list.filter((s) => s.endpoint !== sub.endpoint), sub])
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { endpoint } = req.body as { endpoint: string }
      const list = await loadSubs()
      await saveSubs(list.filter((s) => s.endpoint !== endpoint))
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}
