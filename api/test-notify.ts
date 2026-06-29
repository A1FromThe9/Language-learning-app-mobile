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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { data: rows, error } = await supabase.from('push_subscriptions').select('subscription')
  if (error) return res.status(500).json({ error: error.message })
  if (!rows?.length) return res.status(400).json({ error: 'No subscriptions registered' })

  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify({ title: 'Test notification', body: 'Push notifications are working!' }),
      ),
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  res.status(200).json({ sent, total: rows.length })
}
