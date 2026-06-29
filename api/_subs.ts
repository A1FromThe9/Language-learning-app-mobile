import { put, list } from '@vercel/blob'

export type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

const FILE = 'push-subscriptions.json'

export async function loadSubs(): Promise<Sub[]> {
  try {
    const { blobs } = await list({ prefix: FILE })
    if (!blobs.length) return []
    const res = await fetch(blobs[0].url)
    return (await res.json()) as Sub[]
  } catch {
    return []
  }
}

export async function saveSubs(subs: Sub[]): Promise<void> {
  await put(FILE, JSON.stringify(subs), { access: 'public', addRandomSuffix: false })
}
