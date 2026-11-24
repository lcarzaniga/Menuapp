// Ricettario contestuale del menù (SPEC §43). Mettendo a fuoco «Aggiungi a…» di una portata si
// apre l'elenco delle ricette di quella tipologia, filtrato dal testo dello stesso campo (nome e
// ingredienti): nessuna seconda casella di ricerca. Invio crea come sempre una voce libera; una
// ricetta scelta dal pannello crea una voce collegata (mai anche quella libera).
// - Spazio largo (da 1024 px): colonna a destra. Con il mouse una ricetta si trascina su una
//   portata o su una voce senza ricetta (la collega); in alternativa doppio clic, o frecce e Invio
//   dal campo. Con un puntatore a tocco (tablet) ogni riga ha «+», come sul telefono.
// - Spazio stretto: pannello dal basso, sopra la tastiera virtuale, con «+» su ogni riga.
import { ChefHat, Plus, X } from 'lucide-react'
import { createContext, type DragEvent, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { useImpostazioni, useIncludiPubbliche, usePiatti } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { usePuoScrivere } from '@/connessione/stato'
import type { Menu, VoceDelMenu } from '@/contratto/eventi.ts'
import type { RiepilogoPiatto } from '@/contratto/ricettario.ts'
import type { Risultato } from '@/domain/ricerca.ts'
import { ricetteDellaPortata } from '@/domain/ricettario.ts'
import type { Evento, VoceMenu } from '@/domain/tipi.ts'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { urlFoto } from '@/features/ricettario/FotoPiatto'
import { NotaIngredienti, NotaPubblica, propriePrima } from '@/features/ricettario/SuggerimentiPiatti'
import { altezzaPannelloBasso, scorrimentoPerCampo, useAreaVisibile, useCorrisponde } from '@/lib/dispositivo'
import { cn } from '@/lib/utils'

type Portata = Menu['portate'][number]
type NuovaVoce = { nome: string; piattoId?: string | null }
/** Dove sta per cadere una ricetta trascinata: una portata o una voce senza ricetta. */
type Destinazione = { tipo: 'portata' | 'voce'; id: string } | null

/** Oltre questo numero l'elenco invita a scrivere: con migliaia di ricette resta leggero. */
const MASSIMO = 200
const TIPO_TRASCINAMENTO = 'application/x-menuapp-ricetta'

interface Contesto {
  attiva: Portata | null
  aperto: boolean
  testo: (portataId: string) => string
  scrivi: (portataId: string, testo: string) => void
  /** Il campo di una portata ha il fuoco: diventa quella del pannello, che si apre. */
  entra: (portataId: string) => void
  /** Il campo perde il fuoco: sul telefono il pannello si chiude (a meno che si torni in un campo). */
  esce: () => void
  chiudi: () => void
  alterna: (portataId: string) => void
  risultati: Risultato<RiepilogoPiatto>[]
  attivo: number
  setAttivo: (n: number | ((n: number) => number)) => void
  idElenco: string
  /** Crea voci in una portata (testo libero o ricetta), una richiesta alla volta. */
  aggiungi: (portataId: string, voci: NuovaVoce[]) => Promise<VoceMenu[] | undefined>
  scegli: (ricetta: RiepilogoPiatto, portataId?: string) => Promise<void>
  collega: (voce: VoceDelMenu, ricetta: RiepilogoPiatto) => Promise<void>
  inCorso: boolean
  laterale: boolean
  trascinabile: boolean
  trascinata: RiepilogoPiatto | null
  destinazione: Destinazione
  setDestinazione: (d: Destinazione) => void
}

/** Il campo «Aggiungi a…» di una portata (id stabile, vedi InserimentoRapido). */
export const idCampo = (portataId: string) => `aggiungi-${portataId}`
const campoDi = (portataId: string) => document.getElementById(idCampo(portataId))

const ContestoRicettario = createContext<Contesto | null>(null)

export function useRicettarioContestuale(): Contesto {
  const c = useContext(ContestoRicettario)
  if (!c) throw new Error('useRicettarioContestuale fuori da RicettarioContestuale')
  return c
}

export function RicettarioContestuale({ evento, menu, children }: { evento: Evento; menu: Menu; children: ReactNode }) {
  const [testi, setTesti] = useState<Record<string, string>>({})
  const [attivaId, setAttivaId] = useState<string | null>(null)
  const [aperto, setAperto] = useState(false)
  const [attivo, setAttivo] = useState(-1)
  const [trascinata, setTrascinata] = useState<RiepilogoPiatto | null>(null)
  const [destinazione, setDestinazione] = useState<Destinazione>(null)
  const chiusura = useRef<ReturnType<typeof setTimeout>>(undefined)
  const occupato = useRef(false)
  const idElenco = useId()

  // Lo spazio decide la colonna, il puntatore decide trascinamento e «+» (D: non dedurre il tocco dalla larghezza).
  const laterale = useCorrisponde('(min-width: 1024px)')
  const conMouse = useCorrisponde('(pointer: fine)')
  const puoScrivere = usePuoScrivere()
  const trascinabile = laterale && conMouse && puoScrivere

  // Le stesse ricette della scelta per il menù: personali, della Famiglia dell'evento (§37) e, se
  // l'utente le include, le pubbliche (che collegate diventano una copia, §36).
  const piatti = usePiatti(useIncludiPubbliche() ? 'si' : 'no', useAccessoEvento(evento.id).data?.gruppo?.id)
  const impostazioni = useImpostazioni()
  const predefinite = useMemo(() => (impostazioni.data?.portatePredefinite ?? []).map((p) => p.nome), [impostazioni.data])
  const attiva = menu.portate.find((p) => p.id === attivaId) ?? null
  const testoAttivo = attiva ? (testi[attiva.id] ?? '') : ''
  const risultati = useMemo(
    () => (attiva && aperto ? propriePrima(ricetteDellaPortata(piatti.data ?? [], attiva.nome, testoAttivo, predefinite)) : []),
    [attiva, aperto, piatti.data, testoAttivo, predefinite],
  )

  const crea = useScrittura(
    (x: { portataId: string; voci: NuovaVoce[] }) =>
      api.crea<VoceMenu[]>(`/eventi/${evento.id}/voci`, { voci: x.voci.map((v) => ({ id: nuovoId(), portataId: x.portataId, ...v })) }),
    { successo: null },
  )
  const salvaVoce = useScrittura((v: VoceDelMenu & { piattoId: string }) =>
    api.modifica<VoceMenu>(`/voci/${v.id}`, {
      nome: v.nome,
      piattoId: v.piattoId,
      porzioni: v.porzioni,
      incaricato: v.incaricato,
      inSpesa: v.inSpesa,
      note: v.note,
      daDefinire: v.daDefinire,
      contributi: v.contributi,
      versione: v.versione,
    }),
    { oggetto: 'La voce', successo: null },
  )

  const scrivi = useCallback((portataId: string, testo: string) => {
    setTesti((t) => ({ ...t, [portataId]: testo }))
    setAttivo(-1)
  }, [])

  /** Dopo una scelta dal pannello: testo pulito e di nuovo nel campo, se nel frattempo non si scrive altrove. */
  const dopoScelta = useCallback(() => {
    if (!attivaId) return
    scrivi(attivaId, '')
    const altrove = document.activeElement
    if (!altrove || altrove === document.body || altrove.closest('[data-ricettario-contestuale]')) campoDi(attivaId)?.focus()
  }, [attivaId, scrivi])

  // Un solo invio alla volta: doppio clic, Invio ripetuto o un tocco in più non creano doppioni.
  const aggiungi = useCallback(
    async (portataId: string, voci: NuovaVoce[]) => {
      if (occupato.current || voci.length === 0) return undefined
      occupato.current = true
      try {
        const r = await crea.esegui({ portataId, voci })
        const nome = menu.portate.find((p) => p.id === portataId)?.nome ?? ''
        if (r && r.length > 1) toast.success(`${r.length} voci aggiunte a ${nome}`, { duration: 1800 })
        return r
      } finally {
        occupato.current = false
      }
    },
    [crea, menu.portate],
  )

  const scegli = useCallback(
    async (ricetta: RiepilogoPiatto, portataId = attivaId ?? undefined) => {
      if (!portataId) return
      const r = await aggiungi(portataId, [{ nome: ricetta.nome, piattoId: ricetta.id }])
      if (!r) return
      // Sul telefono la voce compare subito sopra il campo: un avviso coprirebbe il pannello.
      const nome = menu.portate.find((p) => p.id === portataId)?.nome ?? ''
      if (laterale) toast.success(`«${ricetta.nome}» aggiunta a ${nome}`, { duration: 1800 })
      dopoScelta()
    },
    [aggiungi, attivaId, dopoScelta, laterale, menu.portate],
  )

  const collega = useCallback(
    async (voce: VoceDelMenu, ricetta: RiepilogoPiatto) => {
      if (occupato.current) return
      occupato.current = true
      try {
        const r = await salvaVoce.esegui({ ...voce, piattoId: ricetta.id })
        if (!r) return
        toast.success(`«${voce.nome}» collegata a «${ricetta.nome}»`, { duration: 1800 })
        dopoScelta()
      } finally {
        occupato.current = false
      }
    },
    [dopoScelta, salvaVoce],
  )

  const entra = useCallback(
    (portataId: string) => {
      clearTimeout(chiusura.current)
      if (attivaId !== portataId) setAttivo(-1)
      setAttivaId(portataId)
      setAperto(true)
    },
    [attivaId],
  )
  const esce = useCallback(() => {
    if (laterale) return
    clearTimeout(chiusura.current)
    chiusura.current = setTimeout(() => setAperto(false), 150)
  }, [laterale])
  const chiudi = useCallback(() => {
    setAperto(false)
    setAttivo(-1)
  }, [])
  const alterna = useCallback(
    (portataId: string) => {
      if (aperto && attivaId === portataId) chiudi()
      else entra(portataId)
    },
    [aperto, attivaId, chiudi, entra],
  )
  useEffect(() => () => clearTimeout(chiusura.current), [])

  const fineTrascinamento = useCallback(() => {
    setTrascinata(null)
    setDestinazione(null)
  }, [])

  const valore: Contesto = {
    attiva,
    // Una portata eliminata (da un altro dispositivo o da «Portate») chiude il pannello.
    aperto: aperto && attiva !== null,
    testo: (id) => testi[id] ?? '',
    scrivi,
    entra,
    esce,
    chiudi,
    alterna,
    risultati,
    attivo,
    setAttivo,
    idElenco,
    aggiungi,
    scegli,
    collega,
    inCorso: crea.inCorso || salvaVoce.inCorso,
    laterale,
    trascinabile,
    trascinata,
    destinazione,
    setDestinazione,
  }

  return (
    <ContestoRicettario.Provider value={valore}>
      <TrascinamentoRicetta onInizio={setTrascinata} onFine={fineTrascinamento}>
        {children}
      </TrascinamentoRicetta>
      {aperto && attiva !== null && !laterale ? <PannelloBasso /> : null}
    </ContestoRicettario.Provider>
  )
}

/** Chiude il trascinamento anche se la ricetta cade fuori da una destinazione (o si preme Esc). */
function TrascinamentoRicetta({ children, onInizio, onFine }: { children: ReactNode; onInizio: (r: RiepilogoPiatto) => void; onFine: () => void }) {
  const fine = useRef(onFine)
  useEffect(() => {
    fine.current = onFine
  })
  useEffect(() => {
    const f = () => fine.current()
    document.addEventListener('dragend', f)
    document.addEventListener('drop', f)
    return () => {
      document.removeEventListener('dragend', f)
      document.removeEventListener('drop', f)
    }
  }, [])
  return <InizioTrascinamento.Provider value={onInizio}>{children}</InizioTrascinamento.Provider>
}
const InizioTrascinamento = createContext<(r: RiepilogoPiatto) => void>(() => {})

/**
 * Proprietà di una destinazione del trascinamento: una portata (crea una voce collegata) o una
 * voce senza ricetta (la collega, il nome resta). Solo ricette che arrivano dal pannello: le riconosce
 * `trascinata`, impostata all'inizio del trascinamento (il tipo dei dati non sempre arriva).
 */
export function useDestinazione(d: { tipo: 'portata'; portata: Portata } | { tipo: 'voce'; voce: VoceDelMenu }) {
  const c = useRicettarioContestuale()
  const id = d.tipo === 'portata' ? d.portata.id : d.voce.id
  const sopra = c.trascinata !== null && c.destinazione?.tipo === d.tipo && c.destinazione.id === id
  const accetta = c.trascinata !== null && (d.tipo === 'portata' || (d.voce.piattoId === null && !d.voce.daDefinire))
  // dragenter e dragover annullati: il browser la considera una destinazione valida.
  const sopraQui = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = d.tipo === 'portata' ? 'copy' : 'link'
    if (!sopra) c.setDestinazione({ tipo: d.tipo, id })
  }
  return {
    sopra,
    attivo: c.trascinata !== null,
    ricetta: c.trascinata,
    proprieta: accetta
      ? {
          onDragEnter: sopraQui,
          onDragOver: sopraQui,
          onDragLeave: (e: DragEvent) => {
            if (sopra && !(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) c.setDestinazione(null)
          },
          onDrop: (e: DragEvent) => {
            const r = c.trascinata
            if (!r) return
            e.preventDefault()
            e.stopPropagation()
            c.setDestinazione(null)
            if (d.tipo === 'portata') void c.scegli(r, d.portata.id)
            else void c.collega(d.voce, r)
          },
        }
      : {},
  }
}

/** Colonna a destra del menù (desktop): si affianca al menù nella stessa griglia. */
export function PannelloLaterale() {
  const c = useRicettarioContestuale()
  if (!c.aperto || !c.laterale) return null
  return (
    <aside
      data-ricettario-contestuale
      aria-label={`Ricettario: ${c.attiva!.nome}`}
      className="sticky top-4 flex max-h-[calc(100dvh-2rem)] min-h-64 flex-col overflow-hidden rounded-2xl border border-bordo/70 bg-carta shadow-carta"
    >
      <Elenco />
    </aside>
  )
}

/** Pannello dal basso (telefono, finestre strette): sopra la tastiera, senza toglierle il fuoco. */
function PannelloBasso() {
  const c = useRicettarioContestuale()
  const area = useAreaVisibile(true)
  const altezza = altezzaPannelloBasso(area)
  const portataId = c.attiva?.id
  // Il campo in cui si scrive resta visibile sopra il pannello (anche quando la tastiera si apre).
  useEffect(() => {
    const el = portataId ? campoDi(portataId) : null
    if (!el) return
    const delta = scorrimentoPerCampo(el.getBoundingClientRect(), area, altezza)
    if (delta !== 0) window.scrollBy({ top: delta })
  }, [area, altezza, portataId])
  return createPortal(
    <>
      {/* Spazio in fondo alla pagina: anche l'ultima portata può salire sopra il pannello. */}
      <div aria-hidden style={{ height: altezza }} />
      <section
        data-ricettario-contestuale
        aria-label={`Ricettario: ${c.attiva!.nome}`}
        style={{ bottom: area.coperto, height: altezza }}
        className={cn(
          'non-stampare fixed inset-x-0 z-40 flex flex-col overflow-hidden rounded-t-3xl border border-bordo bg-carta shadow-xl animate-in slide-in-from-bottom-8',
          area.coperto === 0 && 'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <Elenco />
      </section>
    </>,
    document.body,
  )
}

function Elenco() {
  const c = useRicettarioContestuale()
  const portata = c.attiva!
  const testo = c.testo(portata.id).trim()
  const iniziaTrascinamento = useContext(InizioTrascinamento)
  const conPiu = !c.trascinabile
  const lista = useRef<HTMLUListElement>(null)
  const visibili = c.risultati.slice(0, MASSIMO)

  // L'opzione scelta con le frecce resta in vista.
  useEffect(() => {
    if (c.attivo >= 0) document.getElementById(`${c.idElenco}-${c.attivo}`)?.scrollIntoView({ block: 'nearest' })
  }, [c.attivo, c.idElenco])

  return (
    <>
      <div className="flex shrink-0 items-start gap-2 border-b border-bordo/60 py-2 pl-4 pr-2">
        <div className="min-w-0 flex-1 py-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primario">
            <ChefHat className="size-4 shrink-0" /> <span className="truncate">Ricettario · {portata.nome}</span>
          </p>
          <p className="mt-0.5 text-xs text-testo-tenue">
            {testo ? `Per «${testo}» · Invio la aggiunge come voce libera` : c.trascinabile ? 'Trascina una ricetta su una portata, o doppio clic' : `Scrivi nel campo per cercare per nome o ingredienti`}
          </p>
        </div>
        <Button
          variante="fantasma"
          misura="iconaPiccola"
          className="shrink-0"
          aria-label="Chiudi il ricettario"
          // Il campo resta il fuoco: sul telefono la tastiera non si chiude e si continua a scrivere.
          onPointerDown={(e) => e.preventDefault()}
          onClick={c.chiudi}
        >
          <X />
        </Button>
      </div>
      {visibili.length === 0 ? (
        <p className="px-4 py-4 text-sm text-testo-tenue" role="status">
          {testo ? `Nessuna ricetta per «${testo}» fra ${portata.nome.toLowerCase()}. Premi Invio per aggiungerla come voce libera.` : `Nessuna ricetta di ${portata.nome.toLowerCase()} nel ricettario. Scrivi per cercare fra le ricette senza portata.`}
        </p>
      ) : (
        <ul ref={lista} role="listbox" id={c.idElenco} aria-label={`Ricette per ${portata.nome}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {visibili.map((r, i) => (
            <Riga
              key={r.ricetta.id}
              id={`${c.idElenco}-${i}`}
              r={r}
              attiva={i === c.attivo}
              conPiu={conPiu}
              onSeleziona={() => c.setAttivo(i)}
              onTrascina={iniziaTrascinamento}
            />
          ))}
          {c.risultati.length > MASSIMO ? <li className="px-3 py-2 text-xs text-testo-tenue">Altre {c.risultati.length - MASSIMO}: scrivi per restringere.</li> : null}
        </ul>
      )}
    </>
  )
}

function Riga({
  id,
  r,
  attiva,
  conPiu,
  onSeleziona,
  onTrascina,
}: {
  id: string
  r: Risultato<RiepilogoPiatto>
  attiva: boolean
  conPiu: boolean
  onSeleziona: () => void
  onTrascina: (r: RiepilogoPiatto) => void
}) {
  const c = useRicettarioContestuale()
  const p = r.ricetta
  const portata = c.attiva!
  const puoScrivere = usePuoScrivere()
  const secondaria = r.ingredientiTrovati.length ? <NotaIngredienti r={r} /> : p.soloPubblica ? <NotaPubblica piatto={p} /> : p.portataSuggerita === null ? <span className="block text-xs text-testo-tenue">senza portata</span> : null
  return (
    <li
      id={id}
      role="option"
      aria-selected={attiva}
      draggable={c.trascinabile}
      title={c.trascinabile ? 'Trascina su una portata o su una voce senza ricetta; doppio clic per aggiungerla' : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO_TRASCINAMENTO, p.id)
        e.dataTransfer.setData('text/plain', p.nome)
        e.dataTransfer.effectAllowed = 'copyLink'
        onTrascina(p)
      }}
      onClick={onSeleziona}
      onDoubleClick={() => {
        if (!conPiu && puoScrivere) void c.scegli(p)
      }}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1 text-sm',
        c.trascinabile && 'cursor-grab active:cursor-grabbing',
        attiva ? 'bg-primario-tenue ring-1 ring-primario/40' : 'hover:bg-tenue',
        c.trascinata?.id === p.id && 'opacity-50',
      )}
    >
      {p.fotoPrincipale ? (
        <img src={urlFoto(p.fotoPrincipale)} alt="" loading="lazy" draggable={false} className="size-9 shrink-0 rounded-lg object-cover" />
      ) : (
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-superficie/70 text-primario/70">
          <ChefHat className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{p.nome}</span>
        {secondaria}
      </span>
      {conPiu ? (
        <Button
          variante="fantasma"
          misura="icona"
          className="-my-1 shrink-0 text-primario-forte"
          aria-label={`Aggiungi «${p.nome}» a ${portata.nome}`}
          disabled={!puoScrivere || c.inCorso}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation()
            void c.scegli(p)
          }}
        >
          <Plus />
        </Button>
      ) : null}
    </li>
  )
}
