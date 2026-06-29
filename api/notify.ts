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

const PAYLOAD = JSON.stringify({
  title: 'Time to review',
  body: 'Your daily vocabulary session is ready.',
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const subs: Sub[] = (await kv.get<Sub[]>(KEY)) ?? []
  const results = await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub as webpush.PushSubscription, PAYLOAD)),
  )

  // Prune subscriptions that are gone (410 Gone / 404)
  const alive = subs.filter((_, i) => results[i].status === 'fulfilled')
  if (alive.length !== subs.length) await kv.set(KEY, alive)

  res.status(200).json({ sent: alive.length, pruned: subs.length - alive.length })
}
