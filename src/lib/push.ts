const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function pushSupported(): boolean {
  return 'PushManager' in window && 'serviceWorker' in navigator
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribe(): Promise<PushSubscription | null> {
  if (!pushSupported() || !PUBLIC_KEY) return null
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  // Browsers accept the raw base64url VAPID public key as a string
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: PUBLIC_KEY,
  })
}

export async function unsubscribe(): Promise<void> {
  const sub = await getSubscription()
  if (!sub) return
  await fetch('/api/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}

export async function saveSubscription(sub: PushSubscription): Promise<void> {
  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
}
