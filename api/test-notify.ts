import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import webpush from 'web-push'

const KEY = 'push:subscriptions'
type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'admin@example.com'}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const subs: Sub[] = (await kv.get<Sub[]>(KEY)) ?? []
  if (subs.length === 0) return res.status(400).json({ error: 'No subscriptions registered' })

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
