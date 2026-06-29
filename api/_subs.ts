export type Sub = { endpoint: string; keys?: { p256dh: string; auth: string } }

const KEY = 'push_subs'

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(
      'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN — ' +
      'go to your Upstash dashboard → your Redis database → REST API, ' +
      'copy those two values, and add them as environment variables in Vercel project settings.',
    )
  }
  return { url, token }
}

export async function loadSubs(): Promise<Sub[]> {
  try {
    const { url, token } = getRedis()
    const res = await fetch(`${url}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const { result } = (await res.json()) as { result: string | null }
    if (!result) return []
    return JSON.parse(result) as Sub[]
  } catch {
    return []
  }
}

export async function saveSubs(subs: Sub[]): Promise<void> {
  const { url, token } = getRedis()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', KEY, JSON.stringify(subs)]),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redis save failed (${res.status}): ${text.slice(0, 200)}`)
  }
}
