import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { getSettings } from './db/repo.ts'
import { applyTheme } from './lib/theme.ts'

// Apply the saved theme as early as possible to avoid a flash.
getSettings().then((s) => applyTheme(s.theme))

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
