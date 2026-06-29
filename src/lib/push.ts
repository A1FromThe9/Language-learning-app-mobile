const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function pushSupported(): boolean {
  return 'PushManager' in window && 'serviceWorker' in navigator
}

async function getReg(): Promise<ServiceWorkerRegistration | null> {
  // serviceWorker.ready hangs if no SW is active; race with a timeout
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
  ])
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await getReg()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function subscribe(): Promise<PushSubscription | null> {
  if (!pushSupported() || !PUBLIC_KEY) return null
  const reg = await getReg()
  if (!reg) throw new Error('Service worker not ready. Close and reopen the app, then try again.')
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
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
