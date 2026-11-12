import { BookOpen, CalendarDays, Carrot, Settings } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { controllaRevisione } from '@/connessione/sorveglianza'
import { BannerConnessione } from '@/connessione/BannerConnessione'
import { cn } from '@/lib/utils'
import { Tavola } from '@/components/Illustrazioni'

const SEZIONI = [
  { a: '/', etichetta: 'Eventi', icona: CalendarDays, attiva: (p: string) => p === '/' || p.startsWith('/eventi') },
  { a: '/ricettario', etichetta: 'Ricettario', icona: BookOpen, attiva: (p: string) => p.startsWith('/ricettario') },
  { a: '/ingredienti', etichetta: 'Ingredienti', icona: Carrot, attiva: (p: string) => p.startsWith('/ingredienti') },
  { a: '/impostazioni', etichetta: 'Impostazioni', icona: Settings, attiva: (p: string) => p.startsWith('/impostazioni') },
]

export function Layout() {
  const { pathname } = useLocation()
  const client = useQueryClient()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-dvh md:pl-56">
      <BannerConnessione onRiprova={() => void controllaRevisione(client)} />
      <nav aria-label="Sezioni" className="non-stampare fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-1 border-r border-bordo/70 bg-carta/90 p-3 backdrop-blur md:flex">
        <div className="mb-6 flex flex-col items-center gap-1 px-3 pt-3 text-center">
          <Tavola className="h-16 w-auto" />
          <span className="titolo text-2xl font-semibold text-primario">Menù &amp; Co.</span>
          <span className="filetto mt-1 w-24" />
        </div>
        {SEZIONI.map((s) => (
          <NavLink
            key={s.a}
            to={s.a}
            className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-tenue', s.attiva(pathname) && 'bg-primario-tenue text-primario')}
          >
            <s.icona className="size-5" /> {s.etichetta}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
      <nav
        aria-label="Sezioni"
        className="non-stampare fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-bordo bg-carta/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {SEZIONI.map((s) => (
          <NavLink
            key={s.a}
            to={s.a}
            className={cn('flex h-16 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-testo-tenue', s.attiva(pathname) && 'text-primario')}
          >
            <s.icona className="size-6" />
            {s.etichetta}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
