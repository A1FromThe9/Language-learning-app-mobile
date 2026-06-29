import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { HomeIcon, PlusIcon, CardsIcon, SettingsIcon } from './icons'
import type { ComponentType, SVGProps } from 'react'

const tabs: { to: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/add', label: 'Add', Icon: PlusIcon },
  { to: '/words', label: 'Words', Icon: CardsIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export function Layout() {
  const { pathname } = useLocation()
  // The review screen is full-bleed and hides the tab bar for focus.
  const immersive = pathname.startsWith('/review')

  return (
    <div className="mx-auto flex h-[100svh] w-full max-w-md flex-col overflow-hidden bg-bg">
      <main
        className="flex-1 overflow-y-auto px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <Outlet />
      </main>

      {immersive ? null : (
        <nav
          className="shrink-0 border-t border-border bg-surface"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="grid grid-cols-4">
            {tabs.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors',
                      isActive ? 'text-accent' : 'text-muted',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        width={22}
                        height={22}
                        strokeWidth={isActive ? 2.4 : 2}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
