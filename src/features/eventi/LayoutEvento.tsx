// Evento: intestazione e schede (SPEC §5).
import { NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { useEvento } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { ErroreRichiesta } from '@/api/client'
import type { Evento } from '@/domain/tipi.ts'
import { dataLunga } from '@/domain/tempo.ts'
import { cn } from '@/lib/utils'
import { IllustrazioneEvento } from '@/components/Illustrazioni'
import { SolaLettura } from '@/connessione/stato'
import { useAccessoEvento } from '@/features/accesso/sessione'

/**
 * Permesso dell'utente sull'evento: in sola lettura tutti i comandi di scrittura dentro
 * `children` si disattivano (il server rifiuta comunque).
 */
export function ConPermessoEvento({ children }: { children: React.ReactNode }) {
  const { id = '' } = useParams()
  const accesso = useAccessoEvento(id)
  const motivo = accesso.data?.permesso === 'lettura' ? `Evento di ${accesso.data.proprietario.nome}, condiviso con te in sola lettura` : null
  return <SolaLettura motivo={motivo}>{children}</SolaLettura>
}

const SCHEDE = [
  { a: '', etichetta: 'Panoramica', fine: true },
  { a: 'partecipanti', etichetta: 'Partecipanti' },
  { a: 'menu', etichetta: 'Menù' },
  { a: 'spesa', etichetta: 'Spesa' },
  { a: 'piano', etichetta: 'Piano' },
  { a: 'bacheca', etichetta: 'Bacheca' },
  { a: 'chi-porta', etichetta: 'Chi porta' },
]

export function useEventoCorrente(): Evento {
  return useOutletContext<Evento>()
}

export function LayoutEvento() {
  const { id = '' } = useParams()
  const q = useEvento(id)
  const accesso = useAccessoEvento(id)
  if (q.isPending) return <Caricamento />
  if (q.isError || !q.data) {
    const assente = q.error instanceof ErroreRichiesta && q.error.stato === 404
    return (
      <Pagina titolo={assente ? 'Evento non disponibile' : 'Evento'} indietro="/">
        <Vuoto
          titolo={assente ? 'Questo evento non è disponibile' : 'Impossibile caricare l\'evento'}
          testo={assente ? 'Forse è stato eliminato, oppure non è più condiviso con te.' : 'Controlla la connessione al server.'}
        />
      </Pagina>
    )
  }
  const e = q.data
  return (
    <div>
      <div className="non-stampare sticky top-0 z-20 border-b border-bordo/70 bg-sfondo/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="flex items-center gap-2">
            <NavLink to={e.stato === 'archiviato' ? '/eventi/archivio' : '/'} className="text-sm text-testo-tenue hover:text-testo">
              ← Eventi
            </NavLink>
            {e.stato === 'archiviato' ? <Badge variante="info">Archiviato · sola lettura</Badge> : e.stato === 'concluso' ? <Badge>Concluso</Badge> : null}
            {accesso.data && accesso.data.permesso !== 'proprietario' ? (
              <Badge variante={accesso.data.permesso === 'lettura' ? 'info' : 'primario'} data-testid="permesso-evento">
                Di {accesso.data.proprietario.nome} · {accesso.data.permesso === 'lettura' ? 'sola lettura' : 'puoi modificare'}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="titolo mt-1 truncate text-[1.75rem] font-semibold leading-tight">{e.nome}</h1>
              <p className="text-sm text-testo-tenue first-letter:uppercase">
                {dataLunga(e.data)}
                {e.oraServizio ? ` · ore ${e.oraServizio}` : ''}
              </p>
            </div>
            <IllustrazioneEvento evento={e} className="h-16 w-auto shrink-0 sm:h-20" />
          </div>
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
      <SolaLettura motivo={accesso.data?.permesso === 'lettura' ? `Evento di ${accesso.data.proprietario.nome}, condiviso con te in sola lettura` : null}>
        <Outlet context={e} />
      </SolaLettura>
    </div>
  )
}

/** Contenitore delle schede: stessa larghezza dell'intestazione. */
export function CorpoScheda({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-12', className)}>{children}</div>
}
