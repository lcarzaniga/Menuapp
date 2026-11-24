// Evento — Menù: portate, voci, inserimento rapido, riordino (SPEC F2, §7.2).
import { ArrowDown, ArrowUp, BookOpen, ChefHat, CookingPot, FolderInput, Link2, ListOrdered, Pencil, Plus, Printer, ShoppingCart, Trash2, User } from 'lucide-react'
import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useMenu } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/campi'
import { MenuAzioni } from '@/components/ui/menu'
import { usePuoScrivere } from '@/connessione/stato'
import type { Menu, VoceDelMenu } from '@/contratto/eventi.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import type { Evento } from '@/domain/tipi.ts'
import { ValutaVoce } from '@/features/famiglia/ValutaVoce'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { cn } from '@/lib/utils'
import { EditorVoce } from './EditorVoce'
import { GestionePortate } from './GestionePortate'
import { idCampo, PannelloLaterale, RicettarioContestuale, useDestinazione, useRicettarioContestuale } from './RicettarioContestuale'

type Portata = Menu['portate'][number]

/** Divide un testo incollato in nomi di piatti (una riga = una voce). */
export function righeIncollate(testo: string): string[] {
  return testo
    .split(/\r?\n/)
    .map((r) => r.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter((r) => r.length > 0)
    .slice(0, 100)
}

export function PaginaMenu() {
  const e = useEventoCorrente()
  const q = useMenu(e.id)
  const [aperta, setAperta] = useState<VoceDelMenu | null>(null)
  const [portate, setPortate] = useState(false)
  const solaLettura = e.stato === 'archiviato'
  const puoScrivere = usePuoScrivere()

  if (q.isPending) return <Caricamento />
  if (!q.data) return <CorpoScheda><Vuoto illustrazione="tavola" titolo="Impossibile caricare il menù" /></CorpoScheda>
  const menu = q.data
  const totale = menu.portate.reduce((n, p) => n + p.voci.length, 0)

  // Il ricettario contestuale (SPEC §43) c'è solo dove si può aggiungere: non negli archiviati.
  if (solaLettura) return <CorpoScheda>{corpoMenu()}</CorpoScheda>
  return (
    <RicettarioContestuale evento={e} menu={menu}>
      <MenuConPannello>{corpoMenu()}</MenuConPannello>
    </RicettarioContestuale>
  )

  function corpoMenu() {
    return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-testo-tenue">
          {totale === 0 ? 'Scrivi i piatti nelle portate: bastano i nomi.' : `${totale} ${totale === 1 ? 'voce' : 'voci'} · porzioni per ${formattaCoperti(menu.copertiEquivalenti)} coperti`}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {!solaLettura ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => setPortate(true)}>
              <ListOrdered /> Portate
            </Button>
          ) : null}
          <Button variante="fantasma" misura="piccolo" asChild>
            <Link to={`/eventi/${e.id}/stampa`}>
              <Printer /> Stampa
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {menu.portate.map((p, i) => (
          <SezionePortata key={p.id} evento={e} menu={menu} portata={p} indice={i} solaLettura={solaLettura} onApri={setAperta} />
        ))}
      </div>
      {aperta ? <EditorVoce evento={e} menu={menu} voce={aperta} onChiudi={() => setAperta(null)} /> : null}
      <GestionePortate evento={e} menu={menu} aperta={portate} onCambia={setPortate} />
    </>
    )
  }
}

/** Desktop: il menù e, quando è aperto, il ricettario contestuale in una colonna a destra (300–360 px). */
function MenuConPannello({ children }: { children: React.ReactNode }) {
  const c = useRicettarioContestuale()
  const affiancato = c.aperto && c.laterale
  return (
    <CorpoScheda className={cn(affiancato && 'max-w-[calc(48rem+clamp(300px,26vw,360px)+1.5rem)]')}>
      <div className={cn(affiancato && 'grid grid-cols-[minmax(0,1fr)_clamp(300px,26vw,360px)] items-start gap-6')}>
        <div className="min-w-0">{children}</div>
        <PannelloLaterale />
      </div>
    </CorpoScheda>
  )
}

function SezionePortata({
  evento,
  menu,
  portata,
  indice,
  solaLettura,
  onApri,
}: {
  evento: Evento
  menu: Menu
  portata: Portata
  indice: number
  solaLettura: boolean
  onApri: (v: VoceDelMenu) => void
}) {
  return solaLettura ? (
    <section aria-labelledby={`portata-${portata.id}`}>
      <TitoloPortata portata={portata} />
      <ul className="flex flex-col gap-1.5">
        {portata.voci.map((v, j) => (
          <RigaVoce key={v.id} evento={evento} menu={menu} portata={portata} voce={v} posizione={j} solaLettura onApri={onApri} />
        ))}
      </ul>
    </section>
  ) : (
    <PortataModificabile evento={evento} menu={menu} portata={portata} indice={indice} onApri={onApri} />
  )
}

function TitoloPortata({ portata }: { portata: Portata }) {
  return (
    <h2 id={`portata-${portata.id}`} className="mb-2.5 flex items-center gap-3">
      <span className="titolo text-xl font-semibold text-primario">{portata.nome}</span>
      {portata.voci.length ? <span className="text-xs text-testo-tenue">{portata.voci.length}</span> : null}
      <span className="filetto flex-1" />
    </h2>
  )
}

/** Una portata in cui si scrive: anche destinazione delle ricette trascinate dal ricettario contestuale. */
function PortataModificabile({ evento, menu, portata, indice, onApri }: { evento: Evento; menu: Menu; portata: Portata; indice: number; onApri: (v: VoceDelMenu) => void }) {
  const d = useDestinazione({ tipo: 'portata', portata })
  return (
    <section
      aria-labelledby={`portata-${portata.id}`}
      data-destinazione={d.sopra || undefined}
      className={cn('-m-2 rounded-2xl p-2 transition-colors', d.attivo && 'outline-2 outline-dashed outline-primario/25', d.sopra && 'bg-primario-tenue/70 outline-primario')}
      {...d.proprieta}
    >
      <TitoloPortata portata={portata} />
      <ul className="flex flex-col gap-1.5">
        {portata.voci.map((v, j) => (
          <RigaVoceDestinazione key={v.id} evento={evento} menu={menu} portata={portata} voce={v} posizione={j} onApri={onApri} />
        ))}
      </ul>
      {d.sopra && d.ricetta ? (
        <p className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-primario bg-carta px-3 text-sm text-primario-forte">
          <Plus className="size-4 shrink-0" /> Rilascia per aggiungere «{d.ricetta.nome}» a {portata.nome}
        </p>
      ) : null}
      <InserimentoRapido portata={portata} autoFocus={indice === 0 && menu.portate.every((p) => p.voci.length === 0)} />
    </section>
  )
}

/**
 * «Aggiungi a…» di una portata: Invio crea una voce libera, più righe incollate una voce per riga.
 * Il testo filtra anche il ricettario contestuale (§43), che si apre con il fuoco: frecce e Invio
 * scelgono una ricetta, Esc toglie la scelta e poi chiude il pannello (il testo resta).
 */
function InserimentoRapido({ portata, autoFocus }: { portata: Portata; autoFocus: boolean }) {
  const c = useRicettarioContestuale()
  const testo = c.testo(portata.id)
  const qui = c.attiva?.id === portata.id
  const elenco = qui && c.aperto ? c.risultati : []
  const puoScrivere = usePuoScrivere()
  // Il fuoco automatico di un menù vuoto non apre il pannello: lo apre chi tocca il campo o ci scrive.
  const primoFuoco = useRef(autoFocus)

  async function aggiungi(nomi: string[]) {
    const r = await c.aggiungi(portata.id, nomi.map((nome) => ({ nome })))
    if (!r) return
    c.scrivi(portata.id, '')
    // Di nuovo qui solo se nel frattempo non si scrive altrove: con una rete lenta la risposta
    // arriva quando si è già passati a un'altra portata, e l'Invio finirebbe nel campo sbagliato.
    const altrove = document.activeElement
    const campo = document.getElementById(idCampo(portata.id))
    if (!altrove || altrove === document.body || altrove === campo) campo?.focus()
  }

  function tasto(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'Escape' && qui && c.aperto) {
      ev.preventDefault()
      if (c.attivo >= 0) c.setAttivo(-1)
      else c.chiudi()
    } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && elenco.length) {
      ev.preventDefault()
      const passo = ev.key === 'ArrowDown' ? 1 : -1
      // Da -1 (nessuna, si scrive liberamente) alle opzioni e ritorno, in cerchio.
      const n = Math.min(elenco.length, 200) + 1
      c.setAttivo((a) => ((a + 1 + passo + n) % n) - 1)
    } else if (ev.key === 'Enter' && c.attivo >= 0 && elenco[c.attivo]) {
      ev.preventDefault()
      void c.scegli(elenco[c.attivo]!.ricetta, portata.id)
    }
  }

  function incolla(ev: ClipboardEvent<HTMLInputElement>) {
    const righe = righeIncollate(ev.clipboardData.getData('text'))
    if (righe.length > 1) {
      ev.preventDefault()
      void aggiungi(righe)
    }
  }

  return (
    <form
      className="mt-1.5 flex gap-1.5"
      onSubmit={(ev) => {
        ev.preventDefault()
        const nome = testo.trim()
        if (nome) void aggiungi([nome])
      }}
    >
      <Input
        id={idCampo(portata.id)}
        value={testo}
        autoFocus={autoFocus}
        disabled={!puoScrivere}
        aria-label={`Aggiungi a ${portata.nome}`}
        placeholder={`Aggiungi a ${portata.nome.toLowerCase()}…`}
        enterKeyHint="done"
        autoComplete="off"
        className="h-11 border-dashed border-primario/45 bg-transparent placeholder:text-testo-tenue"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={qui && c.aperto}
        aria-controls={qui && c.aperto && elenco.length ? c.idElenco : undefined}
        aria-activedescendant={qui && c.attivo >= 0 && elenco[c.attivo] ? `${c.idElenco}-${c.attivo}` : undefined}
        onKeyDown={tasto}
        onChange={(ev) => {
          c.scrivi(portata.id, ev.target.value)
          if (!qui) c.entra(portata.id)
        }}
        onPaste={incolla}
        onFocus={() => {
          if (!primoFuoco.current) c.entra(portata.id)
          primoFuoco.current = false
        }}
        onBlur={c.esce}
      />
      {/* Riapre o chiude il ricettario senza togliere il fuoco al campo (e la tastiera al telefono). */}
      <Button
        variante="fantasma"
        misura="icona"
        className={cn('shrink-0 text-primario-forte', !qui && 'hidden')}
        aria-label={qui && c.aperto ? `Nascondi le ricette di ${portata.nome}` : `Mostra le ricette di ${portata.nome}`}
        aria-pressed={qui && c.aperto}
        title="Ricettario"
        onPointerDown={(ev) => ev.preventDefault()}
        onClick={() => {
          c.alterna(portata.id)
          document.getElementById(idCampo(portata.id))?.focus()
        }}
      >
        <BookOpen />
      </Button>
      <Button type="submit" variante="secondario" misura="icona" aria-label="Aggiungi" disabled={!testo.trim() || c.inCorso || !puoScrivere}>
        <Plus />
      </Button>
    </form>
  )
}

/** Una voce senza ricetta accoglie una ricetta trascinata dal ricettario contestuale: la collega. */
function RigaVoceDestinazione(props: Omit<Parameters<typeof RigaVoce>[0], 'solaLettura' | 'destinazione'>) {
  const d = useDestinazione({ tipo: 'voce', voce: props.voce })
  return <RigaVoce {...props} solaLettura={false} destinazione={d} />
}

function RigaVoce({
  evento,
  menu,
  portata,
  voce,
  posizione,
  solaLettura,
  onApri,
  destinazione: d,
}: {
  evento: Evento
  menu: Menu
  portata: Portata
  voce: VoceDelMenu
  posizione: number
  solaLettura: boolean
  onApri: (v: VoceDelMenu) => void
  destinazione?: ReturnType<typeof useDestinazione>
}) {
  const puoScrivere = usePuoScrivere()
  const riordina = useScrittura(
    (d: { portataId: string; voci: { id: string; versione: number }[] }) => api.modifica(`/eventi/${evento.id}/voci/ordine`, d),
    { successo: null, oggetto: 'Il menù' },
  )
  const ripristina = useScrittura((v: VoceDelMenu) =>
    api.crea(`/eventi/${evento.id}/voci`, {
      voci: [
        {
          id: v.id,
          portataId: v.portataId,
          nome: v.nome,
          piattoId: v.piattoId,
          porzioni: v.porzioni,
          incaricato: v.incaricato,
          inSpesa: v.inSpesa,
          note: v.note,
          daDefinire: v.daDefinire,
          contributi: v.contributi,
          ordine: v.ordine,
        },
      ],
    }),
    { successo: 'Voce ripristinata' },
  )
  const elimina = useScrittura(() => api.elimina(`/voci/${voce.id}`, voce.versione), {
    oggetto: `«${voce.nome}»`,
    successo: null,
    dopo: () =>
      toast(`«${voce.nome}» eliminata`, {
        duration: 5000,
        action: { label: 'Annulla', onClick: () => void ripristina.esegui(voce) },
      }),
  })

  function sposta(delta: number) {
    const ids = portata.voci.map((v) => ({ id: v.id, versione: v.versione }))
    const [x] = ids.splice(posizione, 1)
    ids.splice(posizione + delta, 0, x!)
    void riordina.esegui({ portataId: portata.id, voci: ids })
  }

  function spostaIn(destinazione: Portata) {
    const voci = [...destinazione.voci.map((v) => ({ id: v.id, versione: v.versione })), { id: voce.id, versione: voce.versione }]
    void riordina.esegui({ portataId: destinazione.id, voci }).then((r) => r && toast.success(`Spostata in ${destinazione.nome}`, { duration: 1800 }))
  }

  const personalizzate = voce.porzioni !== null
  const altre = menu.portate.filter((p) => p.id !== portata.id)
  return (
    <li
      data-destinazione={d?.sopra || undefined}
      className={cn('flex flex-wrap items-center gap-1 rounded-xl border border-bordo/70 bg-carta pl-3 shadow-carta transition-colors', d?.sopra && 'border-oro bg-primario-tenue ring-2 ring-oro/70')}
      {...d?.proprieta}
    >
      <button
        type="button"
        className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center py-2 text-left"
        onClick={() => onApri(voce)}
        aria-label={`${voce.nome}: apri dettagli`}
      >
        <span className="font-medium leading-snug">
          {voce.contributi > 1 ? `${voce.contributi} × ` : ''}
          {voce.nome}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-testo-tenue">
          {d?.sopra && d.ricetta ? (
            <span className="flex items-center gap-1 font-medium text-primario-forte">
              <Link2 className="size-3" /> Rilascia per collegare «{d.ricetta.nome}»
            </span>
          ) : null}
          {/* Contributo a scelta di chi lo porta (SPEC §39): lo stesso incarico di Chi porta. */}
          {voce.daDefinire ? <Badge variante="avviso">da definire</Badge> : null}
          {voce.piattoId ? (
            <Badge variante="successo">
              <ChefHat className="size-3" /> ricetta
            </Badge>
          ) : null}
          {personalizzate ? <Badge variante="primario">{formattaCoperti(voce.porzioni!)} porzioni</Badge> : null}
          {voce.incaricato ? (
            <span className="flex items-center gap-0.5">
              <User className="size-3" /> {voce.incaricato}
            </span>
          ) : null}
          {!voce.inSpesa ? (
            <span className="flex items-center gap-0.5">
              <ShoppingCart className="size-3" /> fuori spesa
            </span>
          ) : null}
        </span>
      </button>
      {!solaLettura ? (
        <MenuAzioni
          etichetta={`Azioni per ${voce.nome}`}
          voci={[
            { etichetta: 'Modifica', icona: <Pencil />, onSelect: () => onApri(voce) },
            { etichetta: 'Sposta su', icona: <ArrowUp />, onSelect: () => sposta(-1), disabilitata: posizione === 0 || !puoScrivere },
            { etichetta: 'Sposta giù', icona: <ArrowDown />, onSelect: () => sposta(1), disabilitata: posizione === portata.voci.length - 1 || !puoScrivere },
            ...altre.map((p) => ({ etichetta: `In ${p.nome}`, icona: <FolderInput />, onSelect: () => spostaIn(p), disabilitata: !puoScrivere })),
            { etichetta: 'Elimina', icona: <Trash2 />, pericolosa: true, onSelect: () => void elimina.esegui(undefined), disabilitata: !puoScrivere },
          ]}
        />
      ) : (
        <span className={cn('w-2')} />
      )}
      {/* Con una ricetta: la vista cucina a un tocco (SPEC §31.2). */}
      {voce.piattoId ? (
        <Button variante="fantasma" misura="iconaPiccola" asChild>
          <Link to={`/eventi/${evento.id}/voci/${voce.id}/cucina`} aria-label={`Vista cucina: ${voce.nome}`} title="Vista cucina">
            <CookingPot />
          </Link>
        </Button>
      ) : null}
      <ValutaVoce eventoId={evento.id} voceId={voce.id} nome={voce.nome} />
    </li>
  )
}
