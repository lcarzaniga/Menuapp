import { Bell, BookOpen, CalendarDays, CircleUserRound, Settings, UsersRound } from 'lucide-react'
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { quandoSessionePersa } from '@/connessione/stato'
import { PaginaAccesso } from '@/features/accesso/Attivazione'
import { chiaviAccesso, useSessione } from '@/features/accesso/sessione'
import { useConteggioNotifiche } from '@/features/famiglia/api'
import { SelettoreFamiglia } from '@/features/famiglia/attiva'
import { controllaRevisione } from '@/connessione/sorveglianza'
import { BannerConnessione } from '@/connessione/BannerConnessione'
import { cn } from '@/lib/utils'
import { Tavola } from '@/components/Illustrazioni'

const SEZIONI = [
  { a: '/', etichetta: 'Eventi', icona: CalendarDays, attiva: (p: string) => p === '/' || p.startsWith('/eventi') },
  { a: '/ricettario', etichetta: 'Ricettario', icona: BookOpen, attiva: (p: string) => p.startsWith('/ricettario') || p.startsWith('/ingredienti') },
  { a: '/famiglia', etichetta: 'Famiglia', icona: UsersRound, attiva: (p: string) => p.startsWith('/famiglia') },
  { a: '/notifiche', etichetta: 'Notifiche', icona: Bell, attiva: (p: string) => p.startsWith('/notifiche') },
  { a: '/impostazioni', etichetta: 'Impostazioni', icona: Settings, attiva: (p: string) => p.startsWith('/impostazioni') || p.startsWith('/account') },
]

/** Pagine in cui conta la Famiglia attiva (elenchi), con il selettore in cima sul telefono. */
const CON_SELETTORE = ['/', '/eventi/archivio', '/ricettario', '/famiglia']

/** L'app si apre solo con una sessione valida; altrimenti la schermata di accesso. */
export function Layout() {
  const client = useQueryClient()
  const sessione = useSessione()
  const [revocata, setRevocata] = useState(false)
  useEffect(
    () =>
      quandoSessionePersa(() => {
        // Solo se questo dispositivo era autorizzato: la sessione è stata revocata o è scaduta.
        if (!client.getQueryData(chiaviAccesso.sessione)) return
        // Via tutti i dati in memoria: il dispositivo non deve più mostrarli.
        setRevocata(true)
        client.clear()
        client.setQueryData(chiaviAccesso.sessione, null)
      }),
    [client],
  )
  if (sessione.isPending) return <Caricamento />
  if (sessione.data === null) return <PaginaAccesso revocata={revocata} />
  if (sessione.isError) {
    return (
      <Pagina titolo="Ricette di famiglia & Co.">
        <Vuoto titolo="Server non raggiungibile" testo="Controlla la connessione e riprova tra poco." azione={<button type="button" className="text-primario underline" onClick={() => void sessione.refetch()}>Riprova</button>} />
      </Pagina>
    )
  }
  return <Guscio nome={sessione.data.utente.nome} />
}

/** Pallino con il numero di notifiche non lette. */
function Contatore({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return (
    <span className={cn('flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-primario px-1 text-[0.6875rem] font-semibold leading-none text-primario-testo', className)}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

function Guscio({ nome }: { nome: string }) {
  const { pathname } = useLocation()
  const client = useQueryClient()
  const nonLette = useConteggioNotifiche().data?.nonLette ?? 0
  return (
    <div className="min-h-dvh md:pl-56 print:pl-0">
      {/* Ogni pagina nuova parte dall'alto; tornando indietro (o di nuovo alla stessa pagina) si
          ritrova il punto in cui si era. La chiave è il percorso: filtri e ricerche nell'indirizzo
          non fanno saltare la pagina (SPEC §29.7). */}
      <ScrollRestoration getKey={(l) => l.pathname} />
      <BannerConnessione onRiprova={() => void controllaRevisione(client)} />
      <nav aria-label="Sezioni" className="non-stampare fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-1 border-r border-bordo/70 bg-carta/90 p-3 backdrop-blur md:flex">
        <div className="mb-6 flex flex-col items-center gap-1 px-3 pt-3 text-center">
          <Tavola className="h-16 w-auto" />
          <span className="titolo text-center text-2xl font-semibold leading-tight text-primario">Ricette di famiglia &amp; Co.</span>
          <span className="filetto mt-1 w-24" />
        </div>
        <SelettoreFamiglia className="mb-3" />
        {SEZIONI.map((s) => (
          <NavLink
            key={s.a}
            to={s.a}
            className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-tenue', s.attiva(pathname) && 'bg-primario-tenue text-primario')}
          >
            <s.icona className="size-5" /> {s.etichetta}
            {s.a === '/notifiche' ? <Contatore n={nonLette} className="ml-auto" /> : null}
          </NavLink>
        ))}
        <NavLink
          to="/account"
          className={cn('mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-tenue', pathname.startsWith('/account') && 'bg-primario-tenue text-primario')}
        >
          <CircleUserRound className="size-5" /> <span className="truncate">{nome}</span>
        </NavLink>
      </nav>
      <main>
        {/* Su telefono, chi ha più Famiglie vede in cima quella attiva e la cambia da lì: solo nelle
            pagine principali. Dentro un evento conta la Famiglia dell'evento (SPEC §31.1). */}
        {CON_SELETTORE.includes(pathname) ? (
          <div className="non-stampare mx-auto max-w-3xl px-4 pt-3 md:hidden [&:empty]:hidden">
            <SelettoreFamiglia />
          </div>
        ) : null}
        <Outlet />
      </main>
      <nav
        aria-label="Sezioni"
        className="non-stampare fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-bordo bg-carta/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {SEZIONI.map((s) => (
          <NavLink
            key={s.a}
            to={s.a}
            aria-label={s.a === '/notifiche' && nonLette ? `Notifiche, ${nonLette} da leggere` : undefined}
            className={cn('relative flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 font-medium text-testo-tenue', s.attiva(pathname) && 'text-primario')}
          >
            <s.icona className="size-6" />
            {s.a === '/notifiche' ? <Contatore n={nonLette} className="absolute left-1/2 top-2 ml-1.5" /> : null}
            {/* Etichette a 11 px anche con il testo ingrandito: le icone crescono, le parole restano intere
                («Impostazioni» sta in 1/5 di un telefono da 360 px). Misura fissa voluta, eccezione ai rem. */}
            <span className="max-w-full truncate text-[11px] leading-tight tracking-tight">{s.etichetta}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
