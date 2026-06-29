import type { ThemePref } from '../db/types'

/**
 * Apply the theme preference. We use the CSS-variable strategy keyed on
 * `color-scheme`; forcing a mode just pins `color-scheme` so the media queries
 * and form controls follow. "system" lets prefers-color-scheme decide.
 */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'system') {
    root.style.colorScheme = 'light dark'
    root.removeAttribute('data-theme')
  } else {
    root.style.colorScheme = pref
    root.setAttribute('data-theme', pref)
  }
}
