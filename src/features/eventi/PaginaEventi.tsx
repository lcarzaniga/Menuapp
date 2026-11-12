// Home: prossimi eventi, conclusi, archivio (SPEC §5).
import { Archive, CalendarPlus, ChefHat, ChevronRight, ListTodo, ShoppingBasket, Users, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router'
import { useEventi } from '@/api/query'
import { IllustrazioneEvento } from '@/components/Illustrazioni'
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
    <Link to={`/eventi/${e.id}`} className="group flex items-center gap-4 rounded-2xl border border-bordo/70 bg-carta p-3 pr-4 shadow-carta transition-colors hover:bg-tenue/50">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-tenue/70">
        <IllustrazioneEvento evento={e} className="h-16 w-auto" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="titolo truncate text-lg font-semibold">{e.nome}</h2>
          {e.stato === 'concluso' ? <Badge>Concluso</Badge> : null}
          {e.stato === 'archiviato' ? <Badge variante="info">Archiviato</Badge> : null}
          {daConcludere(e, oggiISO()) ? <Badge variante="avviso">Da concludere</Badge> : null}
        </div>
        <p className="mt-0.5 text-sm first-letter:uppercase">
          {dataLunga(e.data)}
          {e.oraServizio ? ` · ${e.oraServizio}` : ''} {tra && tra !== 'passato' ? <span className="text-primario">· {tra}</span> : null}
        </p>
        <p className="mt-1 flex items-center gap-3 text-[0.8125rem] text-testo-tenue">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {formattaCoperti(e.copertiEquivalenti)} coperti
          </span>
          <span className="flex items-center gap-1">
            <UtensilsCrossed className="size-3.5" /> {plurale(e.numeroVoci, 'piatto', 'piatti')}
          </span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-testo-tenue transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

/** L'evento più vicino, in evidenza: illustrazione, conto alla rovescia, scorciatoie. */
function Prossimo({ e }: { e: RiepilogoEvento }) {
  const giorni = differenzaGiorni(oggiISO(), e.data)
  const quanto = giorni === 0 ? 'Oggi' : giorni === 1 ? 'Domani' : giorni > 1 ? `Tra ${giorni} giorni` : 'Passato'
  return (
    <section aria-label="Prossimo evento" className="relative overflow-hidden rounded-3xl border border-bordo/70 bg-carta shadow-carta">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_100%_0%,var(--primario-tenue),transparent_70%)] opacity-80" />
      <div className="relative grid items-center gap-2 p-5 sm:grid-cols-[1fr_auto] sm:p-7">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-oro">{quanto}</p>
          <Link to={`/eventi/${e.id}`} className="titolo mt-1 block text-[2rem] font-semibold leading-tight hover:text-primario sm:text-[2.5rem]">
            {e.nome}
          </Link>
          <p className="mt-1 text-testo-tenue first-letter:uppercase">
            {dataLunga(e.data)}
            {e.oraServizio ? ` · ore ${e.oraServizio}` : ''} · {formattaCoperti(e.copertiEquivalenti)} coperti
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/eventi/${e.id}/menu`}>
                <ChefHat /> Menù
              </Link>
            </Button>
            <Button asChild variante="contorno">
              <Link to={`/eventi/${e.id}/spesa`}>
                <ShoppingBasket /> Spesa
              </Link>
            </Button>
            <Button asChild variante="contorno">
              <Link to={`/eventi/${e.id}/piano`}>
                <ListTodo /> Piano
              </Link>
            </Button>
          </div>
        </div>
        <IllustrazioneEvento evento={e} className="order-first mx-auto h-36 w-auto sm:order-none sm:h-48" />
      </div>
    </section>
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
          illustrazione="tavola"
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
          {attivi.data.length ? <Prossimo e={attivi.data.find((x) => x.data >= oggiISO()) ?? attivi.data[0]!} /> : null}
          {attivi.data
            .filter((x) => x.id !== (attivi.data.find((y) => y.data >= oggiISO()) ?? attivi.data[0])?.id)
            .map((e) => (
              <SchedaEvento key={e.id} e={e} />
            ))}
          {conclusi.data?.length ? (
            <>
              <h2 className="mt-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-testo-tenue">Conclusi <span className="filetto flex-1" /></h2>
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
        <Vuoto illustrazione="taccuino" titolo="Nessun evento archiviato" testo="Archivia un evento concluso per conservarne menù, ricette e spesa." />
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
