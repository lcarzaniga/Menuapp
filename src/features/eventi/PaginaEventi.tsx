// Eventi, la pagina iniziale: prossimo evento, «Per te», in programma, conclusi, archivio (SPEC §5, §31.3).
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarPlus, ChefHat, ChevronRight, Copy, HandHelping, House, ShoppingBasket, Users, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { api } from '@/api/client'
import { useEventi, usePerTe } from '@/api/query'
import { Segmenti } from '@/components/Navigazione'
import { Campo, Select } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import type { Evento, StatoEvento } from '@/domain/tipi.ts'
import { DuplicaEvento } from './Edizioni'
import { BloccoData } from '@/components/BloccoData'
import { IllustrazioneEvento } from '@/components/Illustrazioni'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RiepilogoEvento } from '@/contratto/eventi.ts'
import { daConcludere } from '@/domain/regole/evento.ts'
import { dataBreve, differenzaGiorni, oggiISO } from '@/domain/tempo.ts'
import { plurale } from '@/lib/formato'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'

function quando(data: string): string {
  const giorni = differenzaGiorni(oggiISO(), data)
  if (giorni === 0) return 'oggi'
  if (giorni === 1) return 'domani'
  if (giorni > 1 && giorni < 60) return `tra ${giorni} giorni`
  if (giorni < 0) return 'passato'
  return ''
}

/** «14 persone» (adulti e bambini; con i coperti automatici, i confermati). Vuoto se non indicate. */
function persone(e: RiepilogoEvento): string {
  const n = e.adulti + e.bambini
  return n > 0 ? plurale(n, 'persona', 'persone') : ''
}

export function SchedaEvento({ e }: { e: RiepilogoEvento }) {
  const tra = quando(e.data)
  const chi = persone(e)
  return (
    <Link to={`/eventi/${e.id}`} className="group flex items-center gap-3 rounded-2xl border border-bordo/70 bg-carta p-3 shadow-carta transition-colors hover:bg-tenue/50">
      <BloccoData data={e.data} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="titolo min-w-0 text-lg font-semibold leading-snug break-words">{e.nome}</h2>
          {e.stato === 'concluso' ? <Badge>Concluso</Badge> : null}
          {e.stato === 'archiviato' ? <Badge variante="info">Archiviato</Badge> : null}
          {daConcludere(e, oggiISO()) ? <Badge variante="avviso">Da concludere</Badge> : null}
          <BadgeCondiviso e={e} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem] text-testo-tenue">
          {e.oraServizio ? <span className="whitespace-nowrap">ore {e.oraServizio}</span> : null}
          {chi ? (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Users className="size-3.5" aria-hidden /> {chi}
            </span>
          ) : null}
          <span className="flex items-center gap-1 whitespace-nowrap">
            <UtensilsCrossed className="size-3.5" aria-hidden /> {plurale(e.numeroVoci, 'piatto', 'piatti')}
          </span>
        </p>
        {tra && tra !== 'passato' ? <p className="mt-0.5 text-xs text-testo-tenue">{tra}</p> : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-testo-tenue transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

/** «di Anna · sola lettura»: l'evento non è mio ma condiviso con me. */
function BadgeCondiviso({ e }: { e: RiepilogoEvento }) {
  if (e.permesso === 'proprietario') return null
  return (
    <Badge variante={e.permesso === 'lettura' ? 'info' : 'primario'} data-testid="evento-condiviso">
      di {e.proprietario.nome}
      {e.permesso === 'lettura' ? ' · sola lettura' : ' · puoi modificare'}
    </Badge>
  )
}

/** L'evento più vicino, in evidenza: blocco data, conto alla rovescia, illustrazione piccola, scorciatoie. */
function Prossimo({ e }: { e: RiepilogoEvento }) {
  const giorni = differenzaGiorni(oggiISO(), e.data)
  const quanto = giorni === 0 ? 'Oggi' : giorni === 1 ? 'Domani' : giorni > 1 ? `Tra ${giorni} giorni` : 'Passato'
  const chi = persone(e)
  return (
    <section aria-label="Prossimo evento" className="rounded-3xl border border-bordo/70 bg-carta p-4 shadow-carta sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <BloccoData data={e.data} evidenza className="self-start" />
        <div className="min-w-0 flex-1">
          <Link to={`/eventi/${e.id}`} className="titolo block text-[1.625rem] font-semibold leading-tight break-words hover:text-primario sm:text-[2rem]">
            {e.nome}
          </Link>
          <p className="mt-1 text-sm text-testo-tenue">
            {[e.oraServizio ? `ore ${e.oraServizio}` : '', chi].filter(Boolean).join(' · ')}
          </p>
          {/* L'illustrazione sta nella riga del conto alla rovescia: il titolo ha tutta la larghezza. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Il conto alla rovescia in evidenza: più grande degli altri badge, con il contorno ottanio. */}
            <Badge variante="tempo" className="px-2.5 py-1 text-sm">
              {quanto}
            </Badge>
            <BadgeCondiviso e={e} />
            <IllustrazioneEvento evento={e} className="ml-auto h-10 w-auto shrink-0 sm:h-14" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/eventi/${e.id}/menu`}>
                <ChefHat /> Menù
              </Link>
            </Button>
            <Button asChild variante="contorno">
              <Link to={`/eventi/${e.id}/partecipanti`}>
                <Users /> Persone
              </Link>
            </Button>
            <Button asChild variante="contorno">
              <Link to={`/eventi/${e.id}/spesa`}>
                <ShoppingBasket /> Prepara
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

type Vista = 'programma' | 'conclusi' | 'archivio'
const VISTE: { vista: Vista; etichetta: string; stato: StatoEvento }[] = [
  { vista: 'programma', etichetta: 'In programma', stato: 'attivo' },
  { vista: 'conclusi', etichetta: 'Conclusi', stato: 'concluso' },
  { vista: 'archivio', etichetta: 'Archivio', stato: 'archiviato' },
]

/**
 * Pagina iniziale (SPEC §31.3): prossimo evento, «Per te», eventi in programma, conclusi e
 * archivio della Famiglia attiva; creazione e duplicazione subito a portata di mano.
 */
export function PaginaEventi() {
  const [parametri] = useSearchParams()
  const vista = VISTE.find((v) => v.vista === parametri.get('vista')) ?? VISTE[0]!
  const { attiva, famiglie, multiple, scegli } = useFamigliaAttiva()
  const eventi = useEventi(vista.stato, attiva?.id)
  // Gli stessi eventi in tutte le Famiglie: per dire quanti ce ne sono nelle altre.
  const tutti = useEventi(vista.stato)
  const [duplica, setDuplica] = useState(false)
  const lista = vista.vista === 'archivio' ? [...(eventi.data ?? [])].reverse() : (eventi.data ?? [])
  // Un solo elenco in ordine di data, propri e condivisi insieme: i condivisi si riconoscono dal
  // badge «di …». Il prossimo evento può essere anche uno condiviso.
  const prossimo = vista.vista === 'programma' ? (lista.find((x) => x.data >= oggiISO()) ?? lista[0]) : undefined
  const altre = multiple && attiva ? altreFamiglie(tutti.data ?? [], attiva.id, famiglie) : []
  return (
    <Pagina
      titolo="Eventi"
      azioni={
        <>
          <Button variante="contorno" onClick={() => setDuplica(true)} aria-label="Duplica un evento">
            <Copy /> <span className="max-sm:sr-only">Duplica</span>
          </Button>
          <Button asChild>
            <Link to="/eventi/nuovo">
              <CalendarPlus /> Nuovo
            </Link>
          </Button>
        </>
      }
    >
      <Segmenti
        etichetta="Quali eventi"
        className="mb-4"
        voci={VISTE.map((v) => ({ a: v.vista === 'programma' ? '/' : `/?vista=${v.vista}`, etichetta: v.etichetta, attiva: () => v.vista === vista.vista }))}
      />
      {eventi.isPending ? (
        <Caricamento />
      ) : eventi.isError ? (
        <Vuoto titolo="Impossibile caricare gli eventi" testo="Controlla la connessione al server." />
      ) : (
        <div className="flex flex-col gap-3">
          {vista.vista === 'programma' ? <PerTe /> : null}
          {lista.length === 0 ? (
            <Vuoto
              illustrazione={vista.vista === 'archivio' ? 'taccuino' : 'tavola'}
              titolo={
                vista.vista === 'programma'
                  ? multiple && attiva ? `Nessun evento in programma in «${attiva.nome}»` : 'Crea il tuo primo evento'
                  : vista.vista === 'conclusi' ? 'Nessun evento concluso' : 'Nessun evento archiviato'
              }
              testo={
                vista.vista === 'programma'
                  ? 'Un pranzo, una cena, una festa: indica quando e quanti siete, poi componi il menù.'
                  : vista.vista === 'conclusi' ? 'Gli eventi passati compaiono qui finché non li archivi.' : 'Archivia un evento concluso per conservarne menù, ricette e spesa.'
              }
              azione={
                vista.vista === 'programma' ? (
                  <Button asChild>
                    <Link to="/eventi/nuovo">Nuovo evento</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {prossimo ? <Prossimo e={prossimo} /> : null}
          {lista
            .filter((x) => x.id !== prossimo?.id)
            .map((e) => (
              <SchedaEvento key={e.id} e={e} />
            ))}
          {altre.length ? (
            <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-dashed border-bordo p-3 text-sm" data-testid="altre-famiglie">
              {altre.map((f) => (
                <p key={f.id} className="flex flex-wrap items-center gap-2">
                  <House className="size-4 text-testo-tenue" aria-hidden />
                  <span className="flex-1">
                    {plurale(f.eventi, 'evento', 'eventi')} in «{f.nome}»
                  </span>
                  <Button variante="contorno" misura="piccolo" onClick={() => scegli(f.id)}>
                    Passa a «{f.nome}»
                  </Button>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {duplica ? <ScegliDaDuplicare gruppoId={attiva?.id} onChiudi={() => setDuplica(false)} /> : null}
    </Pagina>
  )
}

/** Quanti eventi ci sono nelle altre Famiglie dell'utente (per non farli «sparire»). */
function altreFamiglie(eventi: RiepilogoEvento[], attiva: string, famiglie: { id: string; nome: string }[]) {
  return famiglie
    .filter((f) => f.id !== attiva)
    .map((f) => ({ id: f.id, nome: f.nome, eventi: eventi.filter((e) => e.gruppo?.id === f.id).length }))
    .filter((f) => f.eventi > 0)
}

/** «Per te»: cose da portare affidate a me e sondaggi a cui non ho risposto. */
function PerTe() {
  const q = usePerTe()
  const d = q.data
  if (!d || (!d.incarichi.length && !d.sondaggi.length)) return null
  return (
    <section aria-label="Per te" className="rounded-2xl border border-bordo/70 bg-carta p-3 shadow-carta">
      <h2 className="mb-1 px-1 text-sm font-semibold">Per te</h2>
      <ul className="flex flex-col">
        {d.incarichi.map((i) => (
          <li key={`${i.tipo}-${i.id}`}>
            <Link to={i.collegamento} className="flex min-h-11 items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-tenue">
              <HandHelping className="size-4 shrink-0 text-primario" aria-hidden />
              <span className="min-w-0 flex-1">
                Porti <strong>{i.nome}</strong>
                <span className="block text-xs text-testo-tenue">
                  {i.evento} · {dataBreve(i.data)}
                </span>
              </span>
              <ChevronRight className="size-4 text-testo-tenue" aria-hidden />
            </Link>
          </li>
        ))}
        {d.sondaggi.map((x) => (
          <li key={x.id}>
            <Link to={x.collegamento} className="flex min-h-11 items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-tenue">
              <BarChart3 className="size-4 shrink-0 text-primario" aria-hidden />
              <span className="min-w-0 flex-1 break-words">
                Sondaggio: {x.testo}
                <span className="block text-xs text-testo-tenue">{x.dove} · non hai ancora risposto</span>
              </span>
              <ChevronRight className="size-4 text-testo-tenue" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Duplica dalla pagina iniziale: si sceglie l'evento (anche concluso o archiviato), poi la solita finestra. */
function ScegliDaDuplicare({ gruppoId, onChiudi }: { gruppoId?: string; onChiudi: () => void }) {
  const eventi = useEventi(undefined, gruppoId)
  const [scelto, setScelto] = useState('')
  const [conferma, setConferma] = useState(false)
  const evento = useQuery({ queryKey: ['evento', scelto], queryFn: () => api.leggi<Evento>(`/eventi/${scelto}`), enabled: conferma && Boolean(scelto) })
  if (conferma && evento.data) return <DuplicaEvento evento={evento.data} onChiudi={onChiudi} />
  const elenco = [...(eventi.data ?? [])].sort((a, b) => b.data.localeCompare(a.data))
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Duplica un evento"
      descrizione="Scegli l'evento da cui partire, anche dell'anno scorso o archiviato: menù, porzioni e piano si copiano nel nuovo."
      piede={
        <Button disabled={!scelto} onClick={() => setConferma(true)}>
          Continua
        </Button>
      }
    >
      <Campo etichetta="Evento da duplicare" htmlFor="dup-scegli">
        <Select id="dup-scegli" value={scelto} onChange={(ev) => setScelto(ev.target.value)}>
          <option value="">Scegli…</option>
          {elenco.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome} · {dataBreve(e.data)}
              {e.stato === 'archiviato' ? ' (archiviato)' : e.stato === 'concluso' ? ' (concluso)' : ''}
            </option>
          ))}
        </Select>
      </Campo>
    </Finestra>
  )
}

/** Vecchio indirizzo dell'archivio: ora è una vista della pagina Eventi. */
export function PaginaArchivio() {
  return <Navigate to="/?vista=archivio" replace />
}
