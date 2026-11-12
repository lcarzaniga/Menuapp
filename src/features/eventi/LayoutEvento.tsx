// Evento: intestazione e schede (SPEC §5).
import { NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { useEvento } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { ErroreRichiesta } from '@/api/client'
import type { Evento } from '@/domain/tipi.ts'
import { dataLunga } from '@/domain/tempo.ts'
import { cn } from '@/lib/utils'

const SCHEDE = [
  { a: '', etichetta: 'Panoramica', fine: true },
  { a: 'menu', etichetta: 'Menù' },
  { a: 'spesa', etichetta: 'Spesa' },
  { a: 'piano', etichetta: 'Piano' },
]

export function useEventoCorrente(): Evento {
  return useOutletContext<Evento>()
}

export function LayoutEvento() {
  const { id = '' } = useParams()
  const q = useEvento(id)
  if (q.isPending) return <Caricamento />
  if (q.isError || !q.data) {
    const assente = q.error instanceof ErroreRichiesta && q.error.stato === 404
    return (
      <Pagina titolo={assente ? 'Evento non trovato' : 'Evento'} indietro="/">
        <Vuoto titolo={assente ? 'Questo evento non esiste più' : 'Impossibile caricare l\'evento'} testo={assente ? 'Forse è stato eliminato da un altro dispositivo.' : 'Controlla la connessione al server.'} />
      </Pagina>
    )
  }
  const e = q.data
  return (
    <div>
      <div className="non-stampare sticky top-0 z-20 border-b border-bordo bg-sfondo/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="flex items-center gap-2">
            <NavLink to={e.stato === 'archiviato' ? '/eventi/archivio' : '/'} className="text-sm text-testo-tenue hover:text-testo">
              ← Eventi
            </NavLink>
            {e.stato === 'archiviato' ? <Badge variante="info">Archiviato · sola lettura</Badge> : e.stato === 'concluso' ? <Badge>Concluso</Badge> : null}
          </div>
          <h1 className="mt-1 truncate text-xl font-semibold leading-tight">{e.nome}</h1>
          <p className="text-sm text-testo-tenue first-letter:uppercase">
            {dataLunga(e.data)}
            {e.oraServizio ? ` · ore ${e.oraServizio}` : ''}
          </p>
          <nav aria-label="Schede dell'evento" className="-mx-1 mt-2 flex gap-1 overflow-x-auto">
            {SCHEDE.map((s) => (
              <NavLink
                key={s.a}
                to={s.a ? `/eventi/${e.id}/${s.a}` : `/eventi/${e.id}`}
                end={s.fine}
                className={({ isActive }) =>
                  cn('whitespace-nowrap border-b-2 border-transparent px-3 pb-2.5 pt-1.5 text-sm font-medium text-testo-tenue', isActive && 'border-primario text-primario')
                }
              >
                {s.etichetta}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <Outlet context={e} />
    </div>
  )
}

/** Contenitore delle schede: stessa larghezza dell'intestazione. */
export function CorpoScheda({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-12', className)}>{children}</div>
}
