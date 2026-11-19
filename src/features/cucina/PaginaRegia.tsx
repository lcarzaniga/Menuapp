// Regia della cucina (SPEC §38): il giorno dell'evento, su tablet o schermo grande (anche da
// telefono), cosa preparare adesso, cosa dopo, cosa è in ritardo e cosa è fatto. Si basa sul piano
// delle attività e sulle ricette del menù: nessun secondo sistema di attività.
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChefHat, Circle, Clock, ListPlus, SunMedium, Type } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Casella, Input } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { PiattoRegia, Regia } from '@/contratto/regia.ts'
import { ATTREZZATURE, type Attrezzatura, fasiRegia, minutiRicetta, oraInizioSuggerita } from '@/domain/regia.ts'
import { adessoInItalia, dataBreve } from '@/domain/tempo.ts'
import { useSchermoAcceso } from '@/lib/schermo'
import { cn } from '@/lib/utils'

type AttivitaRegia = Regia['attivita'][number]

const CHIAVE_GRANDE = 'menuapp.regia.grande'
function useTestoGrande() {
  const [grande, setGrande] = useState(() => {
    try {
      return localStorage.getItem(CHIAVE_GRANDE) === '1'
    } catch {
      return false
    }
  })
  const cambia = () =>
    setGrande((g) => {
      try {
        localStorage.setItem(CHIAVE_GRANDE, g ? '0' : '1')
      } catch {
        // solo per questa visita
      }
      return !g
    })
  return [grande, cambia] as const
}

/** L'ora italiana, aggiornata ogni mezzo minuto: le attività passano da «più tardi» ad «adesso». */
function useAdesso() {
  const [adesso, setAdesso] = useState(() => adessoInItalia())
  useEffect(() => {
    const t = setInterval(() => setAdesso(adessoInItalia()), 30_000)
    return () => clearInterval(t)
  }, [])
  return adesso
}

const tempi = (p: PiattoRegia) =>
  [p.preparazione ? `prep. ${p.preparazione}′` : '', p.cottura ? `cottura ${p.cottura}′` : '', p.riposo ? `riposo ${p.riposo}′` : ''].filter(Boolean).join(' · ')

export function PaginaRegia() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: ['regia', id], queryFn: () => api.leggi<Regia>(`/eventi/${id}/regia`) })
  const adesso = useAdesso()
  const schermo = useSchermoAcceso()
  const [grande, cambiaGrande] = useTestoGrande()
  const [filtro, setFiltro] = useState<Attrezzatura | null>(null)
  const [soloOggi, setSoloOggi] = useState(false)
  const [prepara, setPrepara] = useState(false)
  const puoScrivere = usePuoScrivere()
  if (!q.data) return <Caricamento />
  const r = q.data
  const piatti = new Map(r.piatti.map((p) => [p.voceId, p]))
  const scelte = r.attivita.filter((a) => {
    const p = a.voceMenuId ? piatti.get(a.voceMenuId) : undefined
    return (!filtro || p?.usa.includes(filtro)) && (!soloOggi || a.data === adesso.data)
  })
  const f = fasiRegia(scelte, adesso)
  const colonne: { id: string; titolo: string; voci: AttivitaRegia[]; vuoto: string; tono?: string }[] = [
    { id: 'ritardo', titolo: 'In ritardo', voci: f.inRitardo, vuoto: 'Niente in ritardo', tono: 'text-avviso' },
    { id: 'adesso', titolo: 'Adesso', voci: f.adesso, vuoto: 'Niente per la prossima ora' },
    { id: 'dopo', titolo: 'Più tardi', voci: f.piuTardi, vuoto: 'Nient\'altro in programma' },
    { id: 'fatto', titolo: 'Fatto', voci: f.fatte, vuoto: 'Ancora niente', tono: 'text-successo' },
  ]
  return (
    <div className={cn('min-h-dvh bg-sfondo px-4 pb-10 pt-4 md:px-6', grande && 'text-lg')}>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Button asChild variante="fantasma" misura="iconaPiccola" aria-label="Torna al piano">
          <Link to={`/eventi/${id}/piano`}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="titolo truncate text-2xl font-semibold">Regia della cucina</h1>
          <p className="text-sm text-testo-tenue">
            {r.evento.nome} · {dataBreve(r.evento.data)}
            {r.evento.oraServizio ? ` · servizio alle ${r.evento.oraServizio}` : ''} · ore {adesso.ora}
          </p>
        </div>
        <span className={cn('flex items-center gap-1 text-xs', schermo ? 'text-successo' : 'text-testo-tenue')}>
          <SunMedium className="size-4" /> {schermo ? 'Schermo sempre acceso' : 'Schermo normale'}
        </span>
        <Button variante="contorno" misura="piccolo" aria-pressed={grande} onClick={cambiaGrande}>
          <Type /> {grande ? 'Testo normale' : 'Testo grande'}
        </Button>
      </header>

      <div role="group" aria-label="Filtri" className="mb-4 flex flex-wrap gap-2">
        <Chip attivo={!filtro} onClick={() => setFiltro(null)}>
          Tutte
        </Chip>
        {ATTREZZATURE.map((a) => (
          <Chip key={a.id} attivo={filtro === a.id} onClick={() => setFiltro(filtro === a.id ? null : a.id)}>
            {a.nome}
          </Chip>
        ))}
        <Chip attivo={soloOggi} onClick={() => setSoloOggi(!soloOggi)}>
          Solo oggi
        </Chip>
      </div>

      {r.attivita.length === 0 ? (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-bordo/70 bg-carta p-6 text-center">
          <p className="font-medium">Il piano delle attività è vuoto</p>
          <p className="text-sm text-testo-tenue">La regia mostra le attività del piano. Puoi prepararle dai piatti del menù e poi correggerle nel piano.</p>
          {r.puoModificare ? (
            <Button disabled={!puoScrivere} onClick={() => setPrepara(true)}>
              <ListPlus /> Prepara il piano dai piatti
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {colonne.map((c) => (
            <section key={c.id} aria-label={c.titolo} className="flex flex-col gap-2">
              <h2 className={cn('flex items-center gap-2 text-sm font-semibold uppercase tracking-wide', c.tono ?? 'text-testo-tenue')}>
                {c.titolo} <span className="tabular-nums opacity-70">{c.voci.length}</span>
              </h2>
              {c.voci.length ? (
                c.voci.map((a) => <SchedaAttivita key={a.id} a={a} p={a.voceMenuId ? piatti.get(a.voceMenuId) : undefined} eventoId={id} ritardo={c.id === 'ritardo'} puo={r.puoModificare && puoScrivere} grande={grande} />)
              ) : (
                <p className="rounded-xl border border-dashed border-bordo/70 px-3 py-4 text-center text-sm text-testo-tenue">{c.vuoto}</p>
              )}
            </section>
          ))}
        </div>
      )}
      {prepara ? <PreparaPiano r={r} onChiudi={() => setPrepara(false)} /> : null}
    </div>
  )
}

function Chip({ attivo, onClick, children }: { attivo: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={attivo}
      onClick={onClick}
      className={cn('h-10 rounded-full border px-4 text-sm font-medium', attivo ? 'border-primario bg-primario text-primario-testo' : 'border-bordo bg-carta hover:bg-tenue')}
    >
      {children}
    </button>
  )
}

function SchedaAttivita({ a, p, eventoId, ritardo, puo, grande }: { a: AttivitaRegia; p: PiattoRegia | undefined; eventoId: string; ritardo: boolean; puo: boolean; grande: boolean }) {
  const fatta = a.stato === 'fatto'
  // Stessa scrittura del piano: versione e revisione aggiornano gli altri dispositivi.
  const cambia = useScrittura(
    () => api.modifica(`/attivita/${a.id}`, { titolo: a.titolo, data: a.data, ora: a.ora, voceMenuId: a.voceMenuId, note: a.note, stato: fatta ? 'da_fare' : 'fatto', versione: a.versione }),
    { successo: null, oggetto: 'L\'attività' },
  )
  const t = p ? tempi(p) : ''
  return (
    <article className={cn('flex flex-col gap-2 rounded-2xl border bg-carta p-3 shadow-carta', ritardo ? 'border-avviso/60' : 'border-bordo/70', fatta && 'opacity-70')} data-testid="attivita-regia">
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={!puo || cambia.inCorso}
          onClick={() => void cambia.esegui(undefined)}
          aria-label={fatta ? `${a.titolo}: segna da fare` : `${a.titolo}: segna fatta`}
          className={cn('mt-0.5 shrink-0 rounded-full disabled:opacity-60', grande ? 'size-10' : 'size-8')}
        >
          {fatta ? <CheckCircle2 className="size-full text-successo" /> : <Circle className="size-full text-bordo" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold', grande ? 'text-2xl' : 'text-lg', fatta && 'line-through decoration-1')}>{a.titolo}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-testo-tenue">
            {ritardo ? <AlertTriangle className="size-4 text-avviso" /> : <Clock className="size-4" />}
            {dataBreve(a.data)}
            {a.ora ? ` alle ${a.ora}` : ' · senza ora'}
          </p>
        </div>
      </div>
      {p ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-testo-tenue">
            {p.portata} · <span className="text-testo">{p.nome}</span>
            {t ? ` · ${t}` : ''}
          </p>
          {p.usa.length || p.attrezzature.length ? (
            <p className="flex flex-wrap items-center gap-1.5">
              {p.usa.map((u) => (
                <Badge key={u} variante="info">
                  {ATTREZZATURE.find((x) => x.id === u)!.nome}
                </Badge>
              ))}
              {p.attrezzature.length ? <span className="text-xs text-testo-tenue">{p.attrezzature.join(', ')}</span> : null}
            </p>
          ) : null}
          {p.piattoId ? (
            <Button asChild variante="contorno" misura="piccolo" className="self-start">
              <Link to={`/eventi/${eventoId}/voci/${p.voceId}/cucina`}>
                <ChefHat /> Ricetta in cucina
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {a.note ? <p className="text-sm text-testo-tenue">{a.note}</p> : null}
    </article>
  )
}

/**
 * «Prepara il piano dai piatti» (D11): una proposta da rivedere, mai automatica. Un'attività per
 * piatto scelto, il giorno dell'evento, con l'ora di inizio suggerita dai tempi della ricetta.
 */
function PreparaPiano({ r, onChiudi }: { r: Regia; onChiudi: () => void }) {
  const [righe, setRighe] = useState(() =>
    r.piatti.map((p) => ({
      p,
      scelta: p.piattoId !== null,
      titolo: `Preparare ${p.nome.charAt(0).toLowerCase()}${p.nome.slice(1)}`,
      ora: oraInizioSuggerita(r.evento.data, r.evento.oraServizio, minutiRicetta(p)) ?? '',
    })),
  )
  const crea = useScrittura(
    async () => {
      for (const x of righe.filter((x) => x.scelta && x.titolo.trim())) {
        await api.crea(`/eventi/${r.evento.id}/attivita`, { id: nuovoId(), titolo: x.titolo.trim(), data: r.evento.data, ora: x.ora || null, voceMenuId: x.p.voceId, note: '' })
      }
    },
    { successo: 'Piano preparato: correggilo quando vuoi nel piano', dopo: onChiudi },
  )
  const n = righe.filter((x) => x.scelta).length
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Prepara il piano dai piatti"
      descrizione={`Un'attività per piatto, il ${dataBreve(r.evento.data)}. L'ora è suggerita dai tempi della ricetta${r.evento.oraServizio ? ` per essere pronti alle ${r.evento.oraServizio}` : ''}: controllala.`}
      piede={
        <Button disabled={!n || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
          <ListPlus /> Crea {n} {n === 1 ? 'attività' : 'attività'}
        </Button>
      }
    >
      {righe.length ? (
        <ul className="flex flex-col gap-3">
          {righe.map((x, i) => (
            <li key={x.p.voceId} className="flex items-start gap-3">
              <Casella aria-label={`Includi ${x.p.nome}`} checked={x.scelta} onChange={(e) => setRighe(righe.map((y, j) => (j === i ? { ...y, scelta: e.target.checked } : y)))} className="mt-3" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input aria-label={`Attività per ${x.p.nome}`} value={x.titolo} onChange={(e) => setRighe(righe.map((y, j) => (j === i ? { ...y, titolo: e.target.value } : y)))} />
                <div className="flex items-center gap-2 text-xs text-testo-tenue">
                  <Input type="time" aria-label={`Ora per ${x.p.nome}`} className="w-32" value={x.ora} onChange={(e) => setRighe(righe.map((y, j) => (j === i ? { ...y, ora: e.target.value } : y)))} />
                  <span>{x.p.portata}{tempi(x.p) ? ` · ${tempi(x.p)}` : ''}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-testo-tenue">Il menù è vuoto: aggiungi prima i piatti.</p>
      )}
    </Finestra>
  )
}
