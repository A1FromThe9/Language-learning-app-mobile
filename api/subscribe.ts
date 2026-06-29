import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const KEY = 'push:subscriptions'

type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

async function load(): Promise<Sub[]> {
  return (await kv.get<Sub[]>(KEY)) ?? []
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const sub = req.body as Sub
    if (!sub?.endpoint) return res.status(400).json({ error: 'Missing endpoint' })
    const list = await load()
    const deduped = list.filter((s) => s.endpoint !== sub.endpoint)
    await kv.set(KEY, [...deduped, sub])
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body as { endpoint: string }
    const list = await load()
    await kv.set(KEY, list.filter((s) => s.endpoint !== endpoint))
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
