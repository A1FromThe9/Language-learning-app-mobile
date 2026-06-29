import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import webpush from 'web-push'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'push:subscriptions'
type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'admin@example.com'}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const subs: Sub[] = (await redis.get<Sub[]>(KEY)) ?? []
  if (!subs.length) return res.status(400).json({ error: 'No subscriptions registered' })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        sub as webpush.PushSubscription,
        JSON.stringify({ title: 'Test notification', body: 'Push notifications are working!' }),
      ),
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  res.status(200).json({ sent, total: subs.length })
}
