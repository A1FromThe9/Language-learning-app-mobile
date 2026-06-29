export type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

const FILE = 'push-subscriptions.json'
const BASE = 'https://blob.vercel-storage.com'

function token(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN
  if (!t) throw new Error('Missing BLOB_READ_WRITE_TOKEN env var')
  return t
}

export async function loadSubs(): Promise<Sub[]> {
  try {
    const listRes = await fetch(
      `${BASE}?prefix=${encodeURIComponent(FILE)}&limit=1`,
      { headers: { authorization: `Bearer ${token()}` } },
    )
    if (!listRes.ok) return []
    const { blobs } = (await listRes.json()) as { blobs: { url: string }[] }
    if (!blobs.length) return []
    const dataRes = await fetch(blobs[0].url)
    if (!dataRes.ok) return []
    return (await dataRes.json()) as Sub[]
  } catch {
    return []
  }
}

export async function saveSubs(subs: Sub[]): Promise<void> {
  const res = await fetch(`${BASE}/${FILE}?addRandomSuffix=0`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token()}`,
      'content-type': 'application/json',
      'x-content-type': 'application/json',
      'x-allow-overwrite': '1',
    },
    body: JSON.stringify(subs),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Blob save failed (${res.status}): ${text.slice(0, 200)}`)
  }
}
