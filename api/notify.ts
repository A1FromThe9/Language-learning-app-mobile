import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadSubs, saveSubs } from './_subs.js'
import webpush from 'web-push'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'Missing VAPID env vars' })

  webpush.setVapidDetails(`mailto:${VAPID_EMAIL ?? 'admin@example.com'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const subs = await loadSubs()
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({
        title: 'Time to review',
        body: 'Your daily vocabulary session is ready.',
      })),
    ),
  )

  const alive = subs.filter((_, i) => results[i].status === 'fulfilled')
  if (alive.length !== subs.length) await saveSubs(alive)

  res.status(200).json({ sent: alive.length, pruned: subs.length - alive.length })
}
