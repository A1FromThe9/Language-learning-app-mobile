import { useEffect, useRef, useState } from 'react'
import { Button, Card, PageTitle } from '../components/ui'
import {
  clearAllData,
  exportData,
  getSettings,
  importData,
  saveSettings,
  type Backup,
} from '../db/repo'
import type { Settings as SettingsModel, ThemePref } from '../db/types'
import { applyTheme } from '../lib/theme'
import { getSubscription, pushSupported, saveSubscription, subscribe, unsubscribe } from '../lib/push'

export function Settings() {
  const [form, setForm] = useState<SettingsModel | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  type NotifState = 'checking' | 'unsupported' | 'subscribed' | 'unsubscribed' | 'denied'
  const [notif, setNotif] = useState<NotifState>('checking')
  const [notifBusy, setNotifBusy] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  useEffect(() => {
    getSettings().then(setForm)
  }, [])

  useEffect(() => {
    if (!pushSupported()) { setNotif('unsupported'); return }
    if (Notification.permission === 'denied') { setNotif('denied'); return }
    getSubscription().then((sub) => setNotif(sub ? 'subscribed' : 'unsubscribed'))
  }, [])

  const handleNotifToggle = async () => {
    setNotifBusy(true)
    setTestMsg('')
    try {
      if (notif === 'subscribed') {
        await unsubscribe()
        setNotif('unsubscribed')
      } else {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') { setNotif('denied'); return }
        const sub = await subscribe()
        if (sub) { await saveSubscription(sub); setNotif('subscribed') }
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setNotifBusy(false)
    }
  }

  const handleTestNotif = async () => {
    setTestMsg('')
    setNotifBusy(true)
    try {
      const res = await fetch('/api/test-notify', { method: 'POST' })
      const text = await res.text()
      let data: { sent?: number; error?: string } = {}
      try { data = JSON.parse(text) } catch { setTestMsg(`Server error: ${text.slice(0, 120)}`); return }
      setTestMsg(res.ok ? `Sent to ${data.sent} device(s).` : (data.error ?? 'Failed.'))
    } catch (e) {
      setTestMsg(`Network error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setNotifBusy(false)
    }
  }

  if (!form) return null

  const update = (patch: Partial<SettingsModel>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))

  const persist = async (patch: Partial<SettingsModel>) => {
    await saveSettings(patch)
    setSavedAt(Date.now())
  }

  const handleSave = async () => {
    await persist({
      deepseekModel: form.deepseekModel.trim() || 'deepseek-chat',
      dailyNewLimit: clampInt(form.dailyNewLimit, 0, 999),
      dailyReviewLimit: clampInt(form.dailyReviewLimit, 0, 9999),
      desiredRetention: form.desiredRetention,
    })
  }

  const setTheme = (theme: ThemePref) => {
    update({ theme })
    applyTheme(theme)
    persist({ theme })
  }

  const handleExport = async () => {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lexa-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File) => {
    setImportMsg('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Backup
      if (!parsed || !Array.isArray(parsed.words) || !Array.isArray(parsed.cards)) {
        throw new Error('bad shape')
      }
      await importData(parsed, true)
      setImportMsg(`Imported ${parsed.words.length} words.`)
    } catch {
      setImportMsg('That file does not look like a Lexa backup.')
    }
  }

  return (
    <div>
      <PageTitle title="Settings" />

      <div className="space-y-5">
        <Card className="space-y-4 p-4">
          <SectionTitle title="Study limits" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">New / day</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.dailyNewLimit}
                onChange={(e) => update({ dailyNewLimit: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Reviews / day</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.dailyReviewLimit}
                onChange={(e) => update({ dailyReviewLimit: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-semibold">Target retention</span>
              <span className="text-sm tabular-nums text-accent">
                {Math.round(form.desiredRetention * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.8}
              max={0.97}
              step={0.01}
              value={form.desiredRetention}
              onChange={(e) => update({ desiredRetention: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
            <p className="mt-1 text-xs text-muted">
              Higher means more reviews but stronger recall.
            </p>
          </label>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle title="Appearance" />
          <div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={[
                  'rounded-[var(--radius-btn)] border py-2.5 text-sm font-semibold capitalize transition-colors',
                  form.theme === t
                    ? 'border-accent bg-accent-soft text-accent-on-soft'
                    : 'border-border bg-surface text-fg',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle title="Notifications" />
          {notif === 'unsupported' ? (
            <p className="text-sm text-muted">
              To enable daily reminders, add this app to your home screen first: tap the Share
              button in Safari, then "Add to Home Screen". Open the app from there and come back
              here.
            </p>
          ) : notif === 'denied' ? (
            <p className="text-sm text-muted">
              Notifications are blocked. Go to iPhone Settings → Safari → Notifications and allow
              this site.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                Get a daily reminder at 8 am UTC when cards are due.
              </p>
              <Button
                variant={notif === 'subscribed' ? 'ghost' : 'soft'}
                block
                onClick={handleNotifToggle}
                disabled={notifBusy || notif === 'checking'}
              >
                {notifBusy
                  ? 'Working…'
                  : notif === 'subscribed'
                    ? 'Turn off reminders'
                    : 'Enable daily reminders'}
              </Button>
              {notif === 'subscribed' && (
                <Button variant="ghost" block onClick={handleTestNotif} disabled={notifBusy}>
                  Send test notification
                </Button>
              )}
              {testMsg && <p className="text-sm text-muted">{testMsg}</p>}
            </>
          )}
        </Card>

        <Button block onClick={handleSave}>
          {savedAt ? 'Saved' : 'Save settings'}
        </Button>

        <Card className="space-y-3 p-4">
          <SectionTitle title="Backup" />
          <p className="text-sm text-muted">
            Your words live in this browser. Export a file to keep them safe or move
            to another device.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" block onClick={handleExport}>
              Export
            </Button>
            <Button variant="ghost" block onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImport(f)
                e.target.value = ''
              }}
            />
          </div>
          {importMsg ? <p className="text-sm text-accent">{importMsg}</p> : null}
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle title="Danger zone" />
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm">Erase all words, cards and history?</span>
              <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await clearAllData()
                  setConfirmClear(false)
                }}
              >
                Erase
              </Button>
            </div>
          ) : (
            <Button variant="danger" block onClick={() => setConfirmClear(true)}>
              Erase all data
            </Button>
          )}
        </Card>

        <p className="pb-4 text-center text-xs text-muted">
          Lexa stores everything locally. No account, no tracking.
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent'

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}
