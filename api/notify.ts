import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: rows, error } = await supabase.from('push_subscriptions').select('endpoint, subscription')
  if (error) return res.status(500).json({ error: error.message })

  const results = await Promise.allSettled(
    (rows ?? []).map((row) => webpush.sendNotification(row.subscription as webpush.PushSubscription, PAYLOAD)),
  )

  // Prune dead subscriptions
  const dead = (rows ?? []).filter((_, i) => results[i].status === 'rejected').map((r) => r.endpoint)
  if (dead.length) await supabase.from('push_subscriptions').delete().in('endpoint', dead)

  res.status(200).json({ sent: results.filter((r) => r.status === 'fulfilled').length, pruned: dead.length })
}
