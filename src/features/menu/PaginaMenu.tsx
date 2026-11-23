// Evento — Menù: portate, voci, inserimento rapido, riordino (SPEC F2, §7.2).
import { ArrowDown, ArrowUp, ChefHat, CookingPot, FolderInput, ListOrdered, Pencil, Plus, Printer, ShoppingCart, Trash2, User } from 'lucide-react'
import { type ClipboardEvent, type KeyboardEvent, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
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
import type { Evento, VoceMenu } from '@/domain/tipi.ts'
import { ValutaVoce } from '@/features/famiglia/ValutaVoce'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { SuggerimentiPiatti, usePiattiProposti } from '@/features/ricettario/SuggerimentiPiatti'
import { cn } from '@/lib/utils'
import { EditorVoce } from './EditorVoce'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { GestionePortate } from './GestionePortate'

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

  return (
    <CorpoScheda>
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
  return (
    <section aria-labelledby={`portata-${portata.id}`}>
      <h2 id={`portata-${portata.id}`} className="mb-2.5 flex items-center gap-3">
        <span className="titolo text-xl font-semibold text-primario">{portata.nome}</span>
        {portata.voci.length ? <span className="text-xs text-testo-tenue">{portata.voci.length}</span> : null}
        <span className="filetto flex-1" />
      </h2>
      <ul className="flex flex-col gap-1.5">
        {portata.voci.map((v, j) => (
          <RigaVoce key={v.id} evento={evento} menu={menu} portata={portata} voce={v} posizione={j} solaLettura={solaLettura} onApri={onApri} />
        ))}
      </ul>
      {!solaLettura ? <InserimentoRapido evento={evento} portata={portata} autoFocus={indice === 0 && menu.portate.every((p) => p.voci.length === 0)} /> : null}
    </section>
  )
}

function InserimentoRapido({ evento, portata, autoFocus }: { evento: Evento; portata: Portata; autoFocus: boolean }) {
  const [testo, setTesto] = useState('')
  const [focus, setFocus] = useState(false)
  const [chiusi, setChiusi] = useState(false)
  const [attivo, setAttivo] = useState(-1)
  const rif = useRef<HTMLInputElement>(null)
  const idElenco = useId()
  const famigliaEvento = useAccessoEvento(evento.id).data?.gruppo?.id
  const trovati = usePiattiProposti(testo, focus && !chiusi && testo.trim().length >= 2, famigliaEvento)
  const puoScrivere = usePuoScrivere()
  const crea = useScrittura(
    (voci: { nome: string; piattoId?: string | null }[]) =>
      api.crea<VoceMenu[]>(`/eventi/${evento.id}/voci`, { voci: voci.map((v) => ({ id: nuovoId(), portataId: portata.id, ...v })) }),
    { successo: (r) => (r.length > 1 ? `${r.length} voci aggiunte a ${portata.nome}` : null) },
  )

  async function aggiungi(voci: { nome: string; piattoId?: string | null }[]) {
    if (voci.length === 0) return
    const r = await crea.esegui(voci)
    if (r) setTesto('')
    setAttivo(-1)
    // Di nuovo qui solo se nel frattempo non si scrive altrove: con una rete lenta la risposta
    // arriva quando si è già passati a un'altra portata, e l'Invio finirebbe nel campo sbagliato.
    const altrove = document.activeElement
    if (!altrove || altrove === document.body || altrove === rif.current) rif.current?.focus()
  }

  function tasto(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'Escape' && trovati.length) {
      ev.preventDefault()
      setChiusi(true)
    } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && trovati.length) {
      ev.preventDefault()
      const passo = ev.key === 'ArrowDown' ? 1 : -1
      // Da -1 (nessuna, si scrive liberamente) alle opzioni e ritorno, in cerchio.
      const n = trovati.length + 1
      setAttivo((a) => ((a + 1 + passo + n) % n) - 1)
    } else if (ev.key === 'Enter' && attivo >= 0 && trovati[attivo]) {
      ev.preventDefault()
      const p = trovati[attivo].ricetta
      void aggiungi([{ nome: p.nome, piattoId: p.id }])
    }
  }

  function incolla(ev: ClipboardEvent<HTMLInputElement>) {
    const righe = righeIncollate(ev.clipboardData.getData('text'))
    if (righe.length > 1) {
      ev.preventDefault()
      void aggiungi(righe.map((nome) => ({ nome })))
    }
  }

  return (
    <div className="relative mt-1.5">
      <form
        className="flex gap-1.5"
        onSubmit={(ev) => {
          ev.preventDefault()
          const nome = testo.trim()
          if (nome) void aggiungi([{ nome }])
        }}
      >
        <Input
          ref={rif}
          value={testo}
          autoFocus={autoFocus}
          disabled={!puoScrivere}
          aria-label={`Aggiungi a ${portata.nome}`}
          placeholder={`Aggiungi a ${portata.nome.toLowerCase()}…`}
          enterKeyHint="done"
          className="h-11 border-dashed border-primario/45 bg-transparent placeholder:text-testo-tenue"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={trovati.length > 0}
          aria-controls={idElenco}
          aria-activedescendant={attivo >= 0 && trovati[attivo] ? `${idElenco}-${attivo}` : undefined}
          onKeyDown={tasto}
          onChange={(ev) => {
            setTesto(ev.target.value)
            setChiusi(false)
            setAttivo(-1)
          }}
          onPaste={incolla}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
        />
        <Button type="submit" variante="secondario" misura="icona" aria-label="Aggiungi" disabled={!testo.trim() || crea.inCorso || !puoScrivere}>
          <Plus />
        </Button>
      </form>
      <SuggerimentiPiatti id={idElenco} trovati={trovati} attivo={attivo} onScegli={(p) => void aggiungi([{ nome: p.nome, piattoId: p.id }])} />
    </div>
  )
}

function RigaVoce({
  evento,
  menu,
  portata,
  voce,
  posizione,
  solaLettura,
  onApri,
}: {
  evento: Evento
  menu: Menu
  portata: Portata
  voce: VoceDelMenu
  posizione: number
  solaLettura: boolean
  onApri: (v: VoceDelMenu) => void
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
    <li className="flex flex-wrap items-center gap-1 rounded-xl border border-bordo/70 bg-carta pl-3 shadow-carta">
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
