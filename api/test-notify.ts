import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import webpush from 'web-push'

const KEY = 'push:subscriptions'
type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Check env vars first so missing ones give a clear error
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return res.status(500).json({ error: 'Missing Upstash env vars (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)' })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'Missing VAPID env vars (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)' })

  const redis = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })

  try {
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL ?? 'admin@example.com'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (e) {
    return res.status(500).json({ error: `Invalid VAPID keys: ${e instanceof Error ? e.message : String(e)}` })
  }

  const subs: Sub[] = (await redis.get<Sub[]>(KEY)) ?? []
  if (!subs.length) return res.status(400).json({ error: 'No subscriptions registered — enable reminders in Settings first' })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        sub as webpush.PushSubscription,
        JSON.stringify({ title: 'Test notification', body: 'Push notifications are working!' }),
      ),
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  const errs = results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason?.message)
  res.status(200).json({ sent, total: subs.length, errors: errs.length ? errs : undefined })
}
