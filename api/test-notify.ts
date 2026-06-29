import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadSubs } from './_subs.js'
import webpush from 'web-push'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, BLOB_READ_WRITE_TOKEN } = process.env
  if (!BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'Missing BLOB_READ_WRITE_TOKEN — redeploy after connecting Blob storage' })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY in Vercel env vars' })

  try {
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL ?? 'admin@example.com'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (e) {
    return res.status(500).json({ error: `Invalid VAPID keys: ${e instanceof Error ? e.message : String(e)}` })
  }

  const subs = await loadSubs()
  if (!subs.length) return res.status(400).json({ error: 'No subscriptions yet — tap Enable daily reminders in Settings first' })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({
        title: 'Test notification',
        body: 'Push notifications are working!',
      })),
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason?.message)
  res.status(200).json({ sent, total: subs.length, ...(errors.length && { errors }) })
}
