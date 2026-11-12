// Designer del menù da tavola: modello, testi, colori, caratteri, formato; anteprima fedele,
// stampa o PDF dal browser. Lo stile si salva per evento sul server (SPEC F8).
import { ArrowLeft, Check, CloudOff, Loader2, Maximize2, Minus, Plus, Printer, RotateCcw, X } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMenu, useStileStampa } from '@/api/query'
import { Caricamento } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Casella, Input, Textarea } from '@/components/ui/campi'
import { usePuoScrivere } from '@/connessione/stato'
import type { Menu } from '@/contratto/eventi.ts'
import {
  CARATTERI,
  CARATTERI_STAMPA,
  conModello,
  type FormatoStampa,
  LIMITI_STAMPA,
  MODELLI,
  MODELLI_STAMPA,
  type OpzioniStampa,
  opzioniPredefinite,
  PALETTE,
  PALETTE_STAMPA,
} from '@/domain/stampa.ts'
import { cn } from '@/lib/utils'
import { caricaTuttiICaratteri, FAMIGLIE } from './caratteri'
import { FogliMenu, type Impaginazione, PaginaMenu, tuttoInUnaPagina, useImpaginazione } from './FogliMenu'
import { type ContenutoStampa, contenutoDa, geometria, PX_PER_MM } from './impaginazione'
import { type StatoSalvataggio, useStile } from './useStile'

const FORMATI: { id: FormatoStampa; nome: string; descrizione: string }[] = [
  { id: 'A4', nome: 'A4', descrizione: 'Un menù per foglio' },
  { id: 'A5', nome: 'A5', descrizione: 'Formato piccolo, carta A5' },
  { id: 'A5x2', nome: '2 × A5', descrizione: 'Due menù su un A4, da tagliare' },
]

export function PaginaStampa() {
  const { id = '' } = useParams()
  const menu = useMenu(id)
  const stile = useStileStampa(id)
  if (menu.isPending || stile.isPending) return <Caricamento />
  if (!menu.data || !stile.data) return <p className="p-6">Menù non disponibile.</p>
  return <Designer menu={menu.data} stile={stile.data} />
}

function Designer({ menu, stile }: { menu: Menu; stile: NonNullable<ReturnType<typeof useStileStampa>['data']> }) {
  const { evento } = menu
  const puoScrivere = usePuoScrivere()
  const archiviato = evento.stato === 'archiviato'
  const modificabile = puoScrivere && !archiviato
  const s = useStile(evento.id, stile, modificabile)
  const opzioni = s.opzioni ?? stile.opzioni
  const contenuto = useMemo(() => contenutoDa(menu, opzioni), [menu, opzioni])
  const { impaginazione, misuratore } = useImpaginazione(contenuto, opzioni)
  const [ingrandita, setIngrandita] = useState(false)
  const g = geometria(opzioni.formato)

  useEffect(() => {
    document.title = `Menù · ${contenuto.titolo}`
  }, [contenuto.titolo])
  // Carta e orientamento per il browser; margini a zero: quelli di sicurezza sono nel foglio.
  useEffect(() => {
    const st = document.createElement('style')
    st.dataset.stampaMenu = ''
    st.textContent = `@page { size: ${opzioni.formato === 'A5' ? 'A5' : 'A4'} ${g.foglio.orientamento}; margin: 0; }`
    document.head.appendChild(st)
    return () => st.remove()
  }, [opzioni.formato, g.foglio.orientamento])
  useEffect(() => {
    void caricaTuttiICaratteri()
  }, [])

  const imposta = (parziale: Partial<OpzioniStampa>) => s.cambia({ ...opzioni, ...parziale })
  async function stampa() {
    await s.salvaOra()
    window.print()
  }

  const pagine = impaginazione.pagine.length
  const vuoto = menu.portate.every((p) => p.voci.length === 0)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 md:pb-12 print:m-0 print:max-w-none print:p-0">
      <header className="non-stampare sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-bordo/70 bg-sfondo/90 px-4 py-2.5 backdrop-blur">
        <Link to={`/eventi/${evento.id}`} aria-label="Indietro" className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-tenue">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="titolo truncate text-xl font-semibold leading-tight sm:text-2xl">Stampa menù</h1>
          <p className="truncate text-[0.8125rem] text-testo-tenue">
            {evento.nome} · <StatoStile stato={s.stato} modificabile={modificabile} archiviato={archiviato} onRiprova={() => void s.riprova()} />
          </p>
        </div>
        <Button variante="contorno" misura="icona" aria-label="Ingrandisci l'anteprima" title="Ingrandisci l'anteprima" onClick={() => setIngrandita(true)}>
          <Maximize2 />
        </Button>
        <Button onClick={() => void stampa()} className="shrink-0">
          <Printer /> <span className="hidden sm:inline">Stampa / Salva PDF</span>
          <span className="sm:hidden">Stampa</span>
        </Button>
      </header>

      {archiviato ? (
        <p className="non-stampare mb-4 rounded-2xl bg-info-tenue px-4 py-3 text-sm text-info">
          Evento archiviato: lo stile è quello salvato all'archiviazione e non si può cambiare. Puoi comunque stampare.
        </p>
      ) : null}

      <div className="non-stampare grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <Sezione titolo="Modello" className="lg:col-start-1 lg:row-start-1">
          <div role="radiogroup" aria-label="Modello grafico" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
            {MODELLI_STAMPA.map((m) => (
              <Miniatura key={m} attiva={opzioni.modello === m} disabled={!modificabile} onClick={() => s.cambia(conModello(opzioni, m))} nome={MODELLI[m].nome} descrizione={MODELLI[m].descrizione}>
                <PaginaMenu contenuto={contenuto} opzioni={{ ...conModello(opzioni, m), formato: 'A4' }} pezzi={tuttoInUnaPagina(contenuto).pagine[0]!} livello={0} />
              </Miniatura>
            ))}
          </div>
        </Sezione>

        <section aria-label="Anteprima" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-2 lg:sticky lg:top-20">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-testo-tenue">
              <span>
                Anteprima · {FORMATI.find((f) => f.id === opzioni.formato)?.nome} · {pagine === 1 ? '1 pagina' : `${pagine} pagine`}
              </span>
              <button type="button" className="text-primario underline-offset-4 hover:underline" onClick={() => setIngrandita(true)}>
                Ingrandisci
              </button>
            </div>
            {vuoto ? <p className="rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso">Il menù non ha ancora piatti: aggiungili dalla scheda Menù.</p> : null}
            {pagine > 1 ? (
              <p className="rounded-xl bg-tenue px-3 py-2 text-sm">
                Il menù è lungo e occupa {pagine} pagine{opzioni.formato === 'A4' ? '' : ': in A4 potrebbe stare in una'}. Il testo non viene rimpicciolito oltre la soglia di leggibilità.
              </p>
            ) : null}
            <Anteprima contenuto={contenuto} opzioni={opzioni} impaginazione={impaginazione} adattaAltezza />
            <ConsigliStampa formato={opzioni.formato} />
          </div>
        </section>

        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
          <Sezione titolo="Testi">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Titolo
              <Input value={opzioni.titolo ?? ''} placeholder={evento.nome} maxLength={LIMITI_STAMPA.titolo} disabled={!modificabile} onChange={(e) => imposta({ titolo: e.target.value || null })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Sottotitolo <span className="sr-only">(facoltativo)</span>
              <Input value={opzioni.sottotitolo} placeholder="Facoltativo, es. «Casa Rossi»" maxLength={LIMITI_STAMPA.sottotitolo} disabled={!modificabile} onChange={(e) => imposta({ sottotitolo: e.target.value })} />
            </label>
            <Interruttore etichetta="Mostra la data" checked={opzioni.mostraData} disabled={!modificabile} onChange={(v) => imposta({ mostraData: v })} />
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nota finale
              <Textarea
                className="min-h-20"
                value={opzioni.nota}
                placeholder="Facoltativa, es. «Buone feste!»"
                maxLength={LIMITI_STAMPA.nota}
                disabled={!modificabile}
                onChange={(e) => imposta({ nota: e.target.value })}
              />
            </label>
          </Sezione>

          <Sezione titolo="Colori">
            <div role="radiogroup" aria-label="Palette" className="grid grid-cols-2 gap-2">
              {PALETTE_STAMPA.map((p) => (
                <Scelta key={p} attiva={opzioni.palette === p} disabled={!modificabile} onClick={() => imposta({ palette: p })}>
                  <span className="flex -space-x-1" aria-hidden>
                    {[PALETTE[p].accento, PALETTE[p].secondario, PALETTE[p].inchiostro].map((c, i) => (
                      <span key={i} className="size-5 rounded-full border-2 border-carta" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="min-w-0 leading-tight">{PALETTE[p].nome}</span>
                </Scelta>
              ))}
            </div>
          </Sezione>

          <Sezione titolo="Caratteri">
            <div role="radiogroup" aria-label="Caratteri" className="grid grid-cols-2 gap-2">
              {CARATTERI_STAMPA.map((c) => (
                <Scelta key={c} attiva={opzioni.caratteri === c} disabled={!modificabile} onClick={() => imposta({ caratteri: c })}>
                  <span className="w-9 shrink-0 text-center text-2xl leading-none" style={{ fontFamily: FAMIGLIE[c].titoli }} aria-hidden>
                    Aa
                  </span>
                  <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span>{CARATTERI[c].nome}</span>
                    <span className="text-xs text-testo-tenue">{CARATTERI[c].esempio}</span>
                  </span>
                </Scelta>
              ))}
            </div>
            <Interruttore etichetta="Decorazioni" aiuto="Cornici, fregi e ornamenti del modello" checked={opzioni.decorazioni} disabled={!modificabile} onChange={(v) => imposta({ decorazioni: v })} />
          </Sezione>

          <Sezione titolo="Contenuto">
            <Interruttore etichetta="Nascondi le portate vuote" checked={opzioni.nascondiPortateVuote} disabled={!modificabile} onChange={(v) => imposta({ nascondiPortateVuote: v })} />
            <Interruttore
              etichetta="Mostra le note dei piatti"
              aiuto="Le note scritte sulle voci del menù, sotto il nome del piatto"
              checked={opzioni.mostraNote}
              disabled={!modificabile}
              onChange={(v) => imposta({ mostraNote: v })}
            />
          </Sezione>

          <Sezione titolo="Formato">
            <div role="radiogroup" aria-label="Formato" className="grid grid-cols-3 gap-2">
              {FORMATI.map((f) => (
                <Scelta key={f.id} attiva={opzioni.formato === f.id} disabled={!modificabile} onClick={() => imposta({ formato: f.id })} verticale>
                  <IconaFormato formato={f.id} />
                  <span className="font-semibold">{f.nome}</span>
                  <span className="text-center text-xs leading-tight text-testo-tenue">{f.descrizione}</span>
                </Scelta>
              ))}
            </div>
          </Sezione>

          <Button variante="contorno" disabled={!modificabile} onClick={() => s.cambia(opzioniPredefinite(evento))} className="self-start">
            <RotateCcw /> Ripristina stile predefinito
          </Button>
        </div>
      </div>

      {/* Solo in stampa: i fogli a grandezza reale, senza interfaccia. */}
      <div className="menu-stampa">
        <FogliMenu contenuto={contenuto} opzioni={opzioni} impaginazione={impaginazione} />
      </div>
      {misuratore}
      {ingrandita ? <AnteprimaIngrandita contenuto={contenuto} opzioni={opzioni} impaginazione={impaginazione} onChiudi={() => setIngrandita(false)} /> : null}
    </div>
  )
}

// ── Anteprima ───────────────────────────────────────────────

function useLarghezza<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [larghezza, setLarghezza] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const aggiorna = () => setLarghezza(el.clientWidth)
    aggiorna()
    const ro = new ResizeObserver(aggiorna)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, larghezza }
}

function FogliScalati({ contenuto, opzioni, impaginazione, scala }: { contenuto: ContenutoStampa; opzioni: OpzioniStampa; impaginazione: Impaginazione; scala: number }) {
  const g = geometria(opzioni.formato)
  const w = g.foglio.larghezza * PX_PER_MM
  const h = g.foglio.altezza * PX_PER_MM
  return (
    <div className="flex flex-col items-center gap-4">
      {impaginazione.pagine.map((pezzi, i) => (
        <div key={i} className="relative shrink-0 overflow-hidden rounded-[2px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.18),0_12px_30px_-12px_rgb(60_40_20/0.35)]" style={{ width: w * scala, height: h * scala }} aria-label={`Foglio ${i + 1}`} role="img">
          <div style={{ transform: `scale(${scala})`, transformOrigin: '0 0', width: w, height: h }}>
            <FogliMenu contenuto={contenuto} opzioni={opzioni} impaginazione={{ livello: impaginazione.livello, pagine: [pezzi] }} primoNumero={i} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Anteprima(props: { contenuto: ContenutoStampa; opzioni: OpzioniStampa; impaginazione: Impaginazione; adattaAltezza?: boolean }) {
  const { ref, larghezza } = useLarghezza<HTMLDivElement>()
  const g = geometria(props.opzioni.formato)
  const w = g.foglio.larghezza * PX_PER_MM
  const h = g.foglio.altezza * PX_PER_MM
  const [altezzaFinestra, setAltezzaFinestra] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight))
  useEffect(() => {
    const f = () => setAltezzaFinestra(window.innerHeight)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  // Su schermi larghi la pagina intera sta nell'altezza della finestra; sul telefono nella larghezza.
  const largo = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches
  let scala = larghezza ? Math.min(1, (larghezza - 2) / w) : 0
  if (props.adattaAltezza && largo) scala = Math.min(scala, Math.max(0.3, (altezzaFinestra - 190) / h))
  return (
    <div ref={ref} data-testid="anteprima-menu" className="w-full rounded-2xl bg-[#e9e2d8] p-3 dark:bg-[#3a322c] sm:p-5">
      {scala > 0 ? <FogliScalati {...props} scala={scala} /> : null}
    </div>
  )
}

function AnteprimaIngrandita(props: { contenuto: ContenutoStampa; opzioni: OpzioniStampa; impaginazione: Impaginazione; onChiudi: () => void }) {
  const { ref, larghezza } = useLarghezza<HTMLDivElement>()
  const [zoom, setZoom] = useState(1)
  const g = geometria(props.opzioni.formato)
  const adatta = larghezza ? (larghezza - 32) / (g.foglio.larghezza * PX_PER_MM) : 0
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && props.onChiudi()
    window.addEventListener('keydown', esc)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = overflow
    }
  }, [props])
  return (
    <div role="dialog" aria-modal="true" aria-label="Anteprima ingrandita" className="non-stampare fixed inset-0 z-50 flex flex-col bg-[#3d3631]">
      <div className="flex items-center gap-2 bg-black/30 px-3 py-2 text-white">
        <span className="flex-1 text-sm">{Math.round(zoom * 100)}%</span>
        <Button variante="fantasma" misura="iconaPiccola" className="text-white hover:bg-white/15" aria-label="Riduci" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          <Minus />
        </Button>
        <Button variante="fantasma" misura="iconaPiccola" className="text-white hover:bg-white/15" aria-label="Ingrandisci" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
          <Plus />
        </Button>
        <Button variante="fantasma" misura="piccolo" className="text-white hover:bg-white/15" onClick={() => setZoom(1)}>
          Adatta
        </Button>
        <Button variante="fantasma" misura="iconaPiccola" className="text-white hover:bg-white/15" aria-label="Chiudi l'anteprima" onClick={props.onChiudi}>
          <X />
        </Button>
      </div>
      <div ref={ref} className="flex-1 overflow-auto p-4">
        {adatta > 0 ? (
          <div className="mx-auto w-max">
            <FogliScalati contenuto={props.contenuto} opzioni={props.opzioni} impaginazione={props.impaginazione} scala={adatta * zoom} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Controlli ───────────────────────────────────────────────

function Sezione({ titolo, children, className }: { titolo: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={titolo} className={cn('flex flex-col gap-3 rounded-2xl border border-bordo/70 bg-carta p-4 shadow-carta', className)}>
      <h2 className="titolo text-lg font-semibold">{titolo}</h2>
      {children}
    </section>
  )
}

function Scelta({ attiva, disabled, onClick, children, verticale }: { attiva: boolean; disabled: boolean; onClick: () => void; children: ReactNode; verticale?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={attiva}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60',
        verticale && 'flex-col justify-center gap-1 px-2',
        attiva ? 'border-primario bg-primario-tenue/60 ring-1 ring-primario' : 'border-bordo bg-carta hover:bg-tenue',
      )}
    >
      {children}
    </button>
  )
}

function Miniatura({ attiva, disabled, onClick, nome, descrizione, children }: { attiva: boolean; disabled: boolean; onClick: () => void; nome: string; descrizione: string; children: ReactNode }) {
  const { ref, larghezza } = useLarghezza<HTMLSpanElement>()
  const scala = larghezza / (210 * PX_PER_MM)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={attiva}
      aria-label={`${nome}: ${descrizione}`}
      title={descrizione}
      disabled={disabled}
      onClick={onClick}
      className={cn('flex flex-col items-stretch gap-1.5 rounded-xl p-1.5 text-center text-sm font-medium transition-colors disabled:opacity-60', attiva ? 'bg-primario-tenue text-primario ring-2 ring-primario' : 'hover:bg-tenue')}
    >
      <span ref={ref} className="relative block aspect-[210/297] w-full overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)]" aria-hidden>
        {scala > 0 ? (
          <span className="pointer-events-none absolute left-0 top-0 block" style={{ transform: `scale(${scala})`, transformOrigin: '0 0' }}>
            {children}
          </span>
        ) : null}
      </span>
      <span className="flex items-center justify-center gap-1">
        {attiva ? <Check className="size-3.5" /> : null}
        {nome}
      </span>
    </button>
  )
}

function Interruttore({ etichetta, aiuto, checked, disabled, onChange }: { etichetta: string; aiuto?: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 py-0.5 text-sm">
      <Casella className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col">
        <span className="font-medium">{etichetta}</span>
        {aiuto ? <span className="text-[0.8125rem] text-testo-tenue">{aiuto}</span> : null}
      </span>
    </label>
  )
}

function IconaFormato({ formato }: { formato: FormatoStampa }) {
  const base = 'fill-carta stroke-current'
  return (
    <svg viewBox="0 0 34 26" className="h-7 w-9 text-testo-tenue" aria-hidden>
      {formato === 'A4' ? <rect x="10" y="1" width="14" height="24" rx="1" className={base} /> : null}
      {formato === 'A5' ? <rect x="12" y="6" width="10" height="17" rx="1" className={base} /> : null}
      {formato === 'A5x2' ? (
        <>
          <rect x="1" y="4" width="32" height="20" rx="1" className={base} />
          <path d="M17 4 V24" className="stroke-current" strokeDasharray="2 2" />
        </>
      ) : null}
    </svg>
  )
}

function StatoStile({ stato, modificabile, archiviato, onRiprova }: { stato: StatoSalvataggio; modificabile: boolean; archiviato: boolean; onRiprova: () => void }) {
  if (archiviato) return <span>sola lettura</span>
  if (!modificabile) return <span>sola lettura (server non raggiungibile)</span>
  if (stato === 'errore')
    return (
      <button type="button" className="inline-flex items-center gap-1 text-pericolo underline" onClick={onRiprova}>
        <CloudOff className="size-3.5" /> non salvato, riprova
      </button>
    )
  if (stato === 'salvato')
    return (
      <span className="inline-flex items-center gap-1" aria-live="polite">
        <Check className="size-3.5" /> stile salvato
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1" aria-live="polite">
      <Loader2 className="size-3.5 animate-spin" /> salvataggio…
    </span>
  )
}

function ConsigliStampa({ formato }: { formato: FormatoStampa }) {
  const carta = formato === 'A5' ? 'A5, verticale' : formato === 'A5x2' ? 'A4, orizzontale' : 'A4, verticale'
  return (
    <details className="rounded-xl bg-tenue/70 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Consigli per la stampa e il PDF</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-testo-tenue">
        <li>
          Carta: <strong className="text-testo">{carta}</strong>; scala <strong className="text-testo">100%</strong> (non «Adatta alla pagina»); margini «Predefiniti» o «Nessuno».
        </li>
        <li>Per i fondi colorati attiva «Grafica di sfondo» (Chrome) o «Stampa sfondi» (Firefox, Safari). Testi, cornici e ornamenti escono comunque.</li>
        <li>Per il PDF scegli «Salva come PDF» come stampante.</li>
        {formato === 'A5x2' ? <li>Taglia il foglio a metà seguendo i segni tratteggiati in alto e in basso.</li> : null}
      </ul>
    </details>
  )
}
