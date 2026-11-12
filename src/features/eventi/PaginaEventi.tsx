// Home: prossimi eventi, conclusi, archivio (SPEC §5).
import { Archive, CalendarPlus, ChevronRight, Clock, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useEventi } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RiepilogoEvento } from '@/contratto/eventi.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { daConcludere } from '@/domain/regole/evento.ts'
import { dataLunga, differenzaGiorni, oggiISO } from '@/domain/tempo.ts'
import { plurale } from '@/lib/formato'

function quando(data: string): string {
  const giorni = differenzaGiorni(oggiISO(), data)
  if (giorni === 0) return 'oggi'
  if (giorni === 1) return 'domani'
  if (giorni > 1 && giorni < 60) return `tra ${giorni} giorni`
  if (giorni < 0) return 'passato'
  return ''
}

export function SchedaEvento({ e }: { e: RiepilogoEvento }) {
  const tra = quando(e.data)
  return (
    <Link to={`/eventi/${e.id}`} className="flex items-center gap-3 rounded-2xl border border-bordo bg-carta p-4 transition-colors hover:bg-tenue/60">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold">{e.nome}</h2>
          {e.stato === 'concluso' ? <Badge>Concluso</Badge> : null}
          {e.stato === 'archiviato' ? <Badge variante="info">Archiviato</Badge> : null}
          {daConcludere(e, oggiISO()) ? <Badge variante="avviso">Da concludere</Badge> : null}
        </div>
        <p className="mt-0.5 text-sm first-letter:uppercase">
          {dataLunga(e.data)}
          {e.oraServizio ? ` · ${e.oraServizio}` : ''} {tra && tra !== 'passato' ? <span className="text-primario">· {tra}</span> : null}
        </p>
        <p className="mt-1 flex items-center gap-3 text-[13px] text-testo-tenue">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {formattaCoperti(e.copertiEquivalenti)} coperti
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {plurale(e.numeroVoci, 'piatto', 'piatti')} nel menù
          </span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-testo-tenue" />
    </Link>
  )
}

export function PaginaEventi() {
  const attivi = useEventi('attivo')
  const conclusi = useEventi('concluso')
  return (
    <Pagina
      titolo="Eventi"
      azioni={
        <Button asChild>
          <Link to="/eventi/nuovo">
            <CalendarPlus /> Nuovo
          </Link>
        </Button>
      }
    >
      {attivi.isPending ? (
        <Caricamento />
      ) : attivi.isError ? (
        <Vuoto titolo="Impossibile caricare gli eventi" testo="Controlla la connessione al server." />
      ) : attivi.data.length === 0 && !conclusi.data?.length ? (
        <Vuoto
          icona={<CalendarPlus />}
          titolo="Crea il tuo primo evento"
          testo="Un pranzo, una cena, una festa: indica quando e quanti siete, poi componi il menù."
          azione={
            <Button asChild>
              <Link to="/eventi/nuovo">Nuovo evento</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {attivi.data.map((e) => (
            <SchedaEvento key={e.id} e={e} />
          ))}
          {conclusi.data?.length ? (
            <>
              <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-testo-tenue">Conclusi</h2>
              {conclusi.data.map((e) => (
                <SchedaEvento key={e.id} e={e} />
              ))}
            </>
          ) : null}
        </div>
      )}
      <Link to="/eventi/archivio" className="mt-6 flex items-center gap-2 text-sm text-testo-tenue hover:text-testo">
        <Archive className="size-4" /> Eventi archiviati
      </Link>
    </Pagina>
  )
}

export function PaginaArchivio() {
  const archiviati = useEventi('archiviato')
  return (
    <Pagina titolo="Archivio" indietro="/">
      {archiviati.isPending ? (
        <Caricamento />
      ) : !archiviati.data?.length ? (
        <Vuoto icona={<Archive />} titolo="Nessun evento archiviato" testo="Archivia un evento concluso per conservarne menù, ricette e spesa." />
      ) : (
        <div className="flex flex-col gap-3">
          {[...archiviati.data].reverse().map((e) => (
            <SchedaEvento key={e.id} e={e} />
          ))}
        </div>
      )}
    </Pagina>
  )
}
