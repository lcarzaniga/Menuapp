// Segnaposto nominativi (SPEC §42): formato, nomi con copie e ordine, nome dell'evento, stile
// coordinato al menù (o proprio), anteprima dei fogli A4, stampa o PDF dal browser. Si salvano per
// evento accanto allo stile del menù; i partecipanti dell'evento non cambiano mai da qui.
import { ArrowDown, ArrowLeft, ArrowUp, Minus, Plus, Printer, Trash2, UserPlus, UtensilsCrossed } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { nuovoId } from '@/api/client'
import { useEvento, useSegnaposto } from '@/api/query'
import { Caricamento } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Casella, Input } from '@/components/ui/campi'
import { usePuoScrivere } from '@/connessione/stato'
import type { Evento } from '@/domain/tipi.ts'
import type { Segnaposto } from '@/contratto/segnaposto.ts'
import {
  aggiungiNomi,
  cartonciniDa,
  chiaveNome,
  fogliDi,
  type FormatoSegnaposto,
  griglia,
  LIMITI_SEGNAPOSTO,
  type NomeSegnaposto,
  type OpzioniSegnaposto,
  spostaNome,
  type StileSegnaposto,
} from '@/domain/segnaposto.ts'
import { CARATTERI, CARATTERI_STAMPA, MODELLI, MODELLI_STAMPA, PALETTE, PALETTE_STAMPA } from '@/domain/stampa.ts'
import { cn } from '@/lib/utils'
import { caricaCaratteri, caricaTuttiICaratteri, FAMIGLIE } from './caratteri'
import { Interruttore, Scelta, Sezione, StatoStile, useLarghezza } from './controlli'
import { Cartoncino, FogliSegnaposto, type ImpostazioniFogli } from './FogliSegnaposto'
import { PX_PER_MM } from './impaginazione'
import { useSalvaSegnaposto } from './useStile'

const FORMATI: { id: FormatoSegnaposto; nome: string; descrizione: string }[] = [
  { id: 'cavalletto', nome: 'A cavalletto', descrizione: `Si piega e sta in piedi · ${griglia('cavalletto').perFoglio} per foglio` },
  { id: 'piatto', nome: 'Piatto', descrizione: `Sul piatto o sul tovagliolo · ${griglia('piatto').perFoglio} per foglio` },
]

export function PaginaSegnaposto() {
  const { id = '' } = useParams()
  const evento = useEvento(id)
  const dati = useSegnaposto(id)
  if (evento.isPending || dati.isPending) return <Caricamento />
  if (!evento.data || !dati.data) return <p className="p-6">Segnaposto non disponibili.</p>
  return <Designer evento={evento.data} dati={dati.data} />
}

function Designer({ evento, dati }: { evento: Evento; dati: Segnaposto }) {
  const puoScrivere = usePuoScrivere()
  const archiviato = evento.stato === 'archiviato'
  const modificabile = puoScrivere && !archiviato
  const s = useSalvaSegnaposto(evento.id, dati, modificabile)
  const o = s.opzioni ?? dati.opzioni
  const stile = o.stile ?? dati.stileMenu
  const imp: ImpostazioniFogli = useMemo(
    () => ({ formato: o.formato, stile, evento: o.mostraEvento ? o.testoEvento?.trim() || evento.nome : null, secondaFaccia: o.secondaFaccia, lineeTaglio: o.lineeTaglio }),
    [o.formato, stile, o.mostraEvento, o.testoEvento, evento.nome, o.secondaFaccia, o.lineeTaglio],
  )
  const cartoncini = useMemo(() => cartonciniDa(o.nomi), [o.nomi])
  const fogli = fogliDi(cartoncini, o.formato).length
  // Caratteri caricati: prima l'anteprima userebbe quelli di riserva (per i test e le verifiche).
  const [caricati, setCaricati] = useState<string | null>(null)
  const pronti = caricati === stile.caratteri

  useEffect(() => {
    document.title = `Segnaposto · ${evento.nome}`
  }, [evento.nome])
  // Foglio A4 verticale, margini a zero: quelli di sicurezza sono già nel foglio.
  useEffect(() => {
    const st = document.createElement('style')
    st.dataset.stampaSegnaposto = ''
    st.textContent = '@page { size: A4 portrait; margin: 0; }'
    document.head.appendChild(st)
    return () => st.remove()
  }, [])
  useEffect(() => {
    let vivo = true
    void caricaCaratteri(stile.caratteri).then(() => {
      if (vivo) setCaricati(stile.caratteri)
    })
    return () => {
      vivo = false
    }
  }, [stile.caratteri])
  useEffect(() => {
    void caricaTuttiICaratteri()
  }, [])

  const imposta = (parziale: Partial<OpzioniSegnaposto>) => s.cambia({ ...o, ...parziale })
  const impostaNomi = (nomi: NomeSegnaposto[]) => imposta({ nomi })
  async function stampa() {
    await s.salvaOra()
    window.print()
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 md:pb-12 print:m-0 print:max-w-none print:p-0">
      <header className="non-stampare sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-bordo/70 bg-sfondo/90 px-4 py-2.5 backdrop-blur">
        <Link to={`/eventi/${evento.id}`} aria-label="Indietro" className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-tenue">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="titolo truncate text-xl font-bold leading-tight sm:text-2xl">Stampa segnaposto</h1>
          <p className="truncate text-[0.8125rem] text-testo-tenue">
            {evento.nome} · <StatoStile stato={s.stato} modificabile={modificabile} archiviato={archiviato} onRiprova={() => void s.riprova()} salvato="salvati" />
          </p>
        </div>
        <Button variante="contorno" asChild className="shrink-0">
          <Link to={`/eventi/${evento.id}/stampa`} aria-label="Stampa menù" title="Stampa menù">
            <UtensilsCrossed /> <span className="hidden sm:inline">Stampa menù</span>
            <span className="sm:hidden">Menù</span>
          </Link>
        </Button>
        <Button onClick={() => void stampa()} disabled={cartoncini.length === 0} className="shrink-0">
          <Printer /> <span className="hidden sm:inline">Stampa / Salva PDF</span>
          <span className="sm:hidden">Stampa</span>
        </Button>
      </header>

      {archiviato ? (
        <p className="non-stampare mb-4 rounded-2xl bg-info-tenue px-4 py-3 text-sm text-info">
          Evento archiviato: i segnaposto sono quelli salvati all'archiviazione e non si possono cambiare. Puoi comunque stamparli.
        </p>
      ) : null}

      <div className="non-stampare grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <Sezione titolo="Formato" className="lg:col-start-1 lg:row-start-1">
          <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 gap-2">
            {FORMATI.map((f) => (
              <Scelta key={f.id} attiva={o.formato === f.id} disabled={!modificabile} onClick={() => imposta({ formato: f.id })} verticale>
                <IconaFormato formato={f.id} />
                <span className="font-semibold">{f.nome}</span>
                <span className="text-center text-xs leading-tight text-testo-tenue">{f.descrizione}</span>
              </Scelta>
            ))}
          </div>
          {o.formato === 'cavalletto' ? (
            <Interruttore
              etichetta="Nome anche sul retro"
              aiuto="Si legge da entrambi i lati del tavolo"
              checked={o.secondaFaccia}
              disabled={!modificabile}
              onChange={(v) => imposta({ secondaFaccia: v })}
            />
          ) : null}
        </Sezione>

        <section aria-label="Anteprima" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-3 lg:sticky lg:top-20">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-testo-tenue">
              <span data-testid="conteggio-segnaposto">
                Anteprima · {cartoncini.length === 1 ? '1 segnaposto' : `${cartoncini.length} segnaposto`} · {fogli === 1 ? '1 foglio A4' : `${fogli} fogli A4`}
              </span>
            </div>
            {cartoncini.length === 0 ? (
              <p className="rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso">
                {o.nomi.length === 0 ? 'Nessun nome: aggiungi gli ospiti nella sezione «Nomi».' : 'Nessun nome selezionato: spunta quelli da stampare.'}
              </p>
            ) : (
              <>
                <Esempio testo={cartoncini[0]!.testo} imp={imp} pronti={pronti} />
                <AnteprimaFogli cartoncini={cartoncini} imp={imp} pronti={pronti} />
              </>
            )}
            <ConsigliSegnaposto formato={o.formato} />
          </div>
        </section>

        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
          <Nomi dati={dati} nomi={o.nomi} modificabile={modificabile} onCambia={impostaNomi} />

          <Sezione titolo="Nome dell'evento">
            <Interruttore etichetta="Mostra nome dell'evento" aiuto="Più piccolo, sotto il nome di ogni ospite" checked={o.mostraEvento} disabled={!modificabile} onChange={(v) => imposta({ mostraEvento: v })} />
            {o.mostraEvento ? (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Testo
                <Input value={o.testoEvento ?? ''} placeholder={evento.nome} maxLength={LIMITI_SEGNAPOSTO.testoEvento} disabled={!modificabile} onChange={(e) => imposta({ testoEvento: e.target.value || null })} />
              </label>
            ) : null}
          </Sezione>

          <SezioneStile o={o} stileMenu={dati.stileMenu} modificabile={modificabile} onCambia={(stile) => imposta({ stile })} />

          <Sezione titolo="Taglio">
            <Interruttore etichetta="Linee di taglio" aiuto="Tratteggio sottile attorno a ogni segnaposto" checked={o.lineeTaglio} disabled={!modificabile} onChange={(v) => imposta({ lineeTaglio: v })} />
          </Sezione>
        </div>
      </div>

      {/* Solo in stampa: i fogli a grandezza reale, senza interfaccia. */}
      <div className="menu-stampa">
        <FogliSegnaposto cartoncini={cartoncini} imp={imp} />
      </div>
    </div>
  )
}

// ── Nomi ────────────────────────────────────────────────────

function Nomi({ dati, nomi, modificabile, onCambia }: { dati: Segnaposto; nomi: NomeSegnaposto[]; modificabile: boolean; onCambia: (n: NomeSegnaposto[]) => void }) {
  const [nuovo, setNuovo] = useState('')
  const presenti = new Set(nomi.map((n) => chiaveNome(n.testo)))
  const mancanti = dati.nomiPartecipanti.filter((n) => !presenti.has(chiaveNome(n)))
  const pieno = nomi.length >= LIMITI_SEGNAPOSTO.nomi
  const modifica = (id: string, parziale: Partial<NomeSegnaposto>) => onCambia(nomi.map((n) => (n.id === id ? { ...n, ...parziale } : n)))
  function aggiungi() {
    // Un nome per riga: si può incollare un elenco. I doppioni non si aggiungono.
    const righe = nuovo.split(/\r?\n/)
    const r = aggiungiNomi(nomi, righe, nuovoId)
    if (r.aggiunti) onCambia(r.nomi)
    setNuovo('')
  }
  const tuttiSelezionati = nomi.length > 0 && nomi.every((n) => n.stampa)

  return (
    <Sezione titolo="Nomi">
      {!dati.salvati && nomi.length > 0 ? (
        <p className="rounded-xl bg-tenue px-3 py-2 text-[0.8125rem] text-testo-tenue">Proposti dai partecipanti dell'evento: modificali liberamente, l'elenco dei partecipanti non cambia.</p>
      ) : null}
      {nomi.length === 0 ? (
        <p className="text-sm text-testo-tenue">
          {dati.nomiPartecipanti.length ? 'Nessun nome nei segnaposto.' : 'L\'evento non ha partecipanti con il nome: scrivi qui gli ospiti, uno per riga.'}
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <Casella checked={tuttiSelezionati} disabled={!modificabile} onChange={(e) => onCambia(nomi.map((n) => ({ ...n, stampa: e.target.checked })))} />
            <span>{tuttiSelezionati ? 'Tutti da stampare' : `${nomi.filter((n) => n.stampa).length} di ${nomi.length} da stampare`}</span>
          </label>
          <ol className="flex flex-col gap-2" aria-label="Nomi dei segnaposto">
            {nomi.map((n, i) => (
              <li key={n.id} className={cn('flex flex-col gap-2 rounded-xl border border-bordo/70 p-2 sm:flex-row sm:items-center', !n.stampa && 'opacity-60')} data-testid="nome-segnaposto">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Casella aria-label={`Stampa ${n.testo || 'questo nome'}`} checked={n.stampa} disabled={!modificabile} onChange={(e) => modifica(n.id, { stampa: e.target.checked })} />
                  <Input
                    aria-label={`Nome ${i + 1}`}
                    className="min-w-0 flex-1"
                    value={n.testo}
                    maxLength={LIMITI_SEGNAPOSTO.nome}
                    disabled={!modificabile}
                    onChange={(e) => modifica(n.id, { testo: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-end gap-1">
                  <span className="mr-auto text-xs text-testo-tenue sm:mr-0">Copie</span>
                  <Button variante="fantasma" misura="iconaPiccola" aria-label={`Una copia in meno di ${n.testo}`} disabled={!modificabile || n.copie <= 1} onClick={() => modifica(n.id, { copie: n.copie - 1 })}>
                    <Minus />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums" aria-label={`Copie di ${n.testo}`}>
                    {n.copie}
                  </span>
                  <Button
                    variante="fantasma"
                    misura="iconaPiccola"
                    aria-label={`Una copia in più di ${n.testo}`}
                    disabled={!modificabile || n.copie >= LIMITI_SEGNAPOSTO.copie}
                    onClick={() => modifica(n.id, { copie: n.copie + 1 })}
                  >
                    <Plus />
                  </Button>
                  <Button variante="fantasma" misura="iconaPiccola" aria-label={`Sposta su ${n.testo}`} disabled={!modificabile || i === 0} onClick={() => onCambia(spostaNome(nomi, n.id, -1))}>
                    <ArrowUp />
                  </Button>
                  <Button variante="fantasma" misura="iconaPiccola" aria-label={`Sposta giù ${n.testo}`} disabled={!modificabile || i === nomi.length - 1} onClick={() => onCambia(spostaNome(nomi, n.id, 1))}>
                    <ArrowDown />
                  </Button>
                  <Button variante="fantasma" misura="iconaPiccola" aria-label={`Togli ${n.testo}`} disabled={!modificabile} onClick={() => onCambia(nomi.filter((x) => x.id !== n.id))}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {modificabile ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            aggiungi()
          }}
        >
          <Input
            aria-label="Nuovo nome"
            placeholder={pieno ? `Al massimo ${LIMITI_SEGNAPOSTO.nomi} nomi` : 'Nome dell\'ospite'}
            value={nuovo}
            maxLength={LIMITI_SEGNAPOSTO.nome * 50}
            disabled={pieno}
            onChange={(e) => setNuovo(e.target.value)}
            onPaste={(e) => {
              const testo = e.clipboardData.getData('text')
              if (!/\n/.test(testo)) return
              e.preventDefault()
              const r = aggiungiNomi(nomi, testo.split(/\r?\n/), nuovoId)
              if (r.aggiunti) onCambia(r.nomi)
            }}
          />
          <Button type="submit" variante="contorno" disabled={pieno || !nuovo.trim()}>
            <Plus /> Aggiungi
          </Button>
        </form>
      ) : null}
      {modificabile && mancanti.length ? (
        <Button variante="contorno" misura="piccolo" className="self-start" onClick={() => onCambia(aggiungiNomi(nomi, mancanti, nuovoId).nomi)}>
          <UserPlus /> Aggiungi dai partecipanti ({mancanti.length})
        </Button>
      ) : null}
    </Sezione>
  )
}

// ── Stile ───────────────────────────────────────────────────

function SezioneStile({ o, stileMenu, modificabile, onCambia }: { o: OpzioniSegnaposto; stileMenu: StileSegnaposto; modificabile: boolean; onCambia: (s: StileSegnaposto | null) => void }) {
  const proprio = o.stile !== null
  const stile = o.stile ?? stileMenu
  const imposta = (parziale: Partial<StileSegnaposto>) => onCambia({ ...stile, ...parziale })
  return (
    <Sezione titolo="Stile">
      <div role="radiogroup" aria-label="Stile dei segnaposto" className="grid grid-cols-2 gap-2">
        <Scelta attiva={!proprio} disabled={!modificabile} onClick={() => onCambia(null)}>
          <span className="leading-tight">
            Come il menù
            <span className="block text-xs text-testo-tenue">{MODELLI[stileMenu.modello].nome}, si aggiorna con il menù</span>
          </span>
        </Scelta>
        <Scelta attiva={proprio} disabled={!modificabile} onClick={() => onCambia(stile)}>
          <span className="leading-tight">
            Personalizzato
            <span className="block text-xs text-testo-tenue">Solo per i segnaposto</span>
          </span>
        </Scelta>
      </div>
      {proprio ? (
        <>
          <div role="radiogroup" aria-label="Modello grafico dei segnaposto" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MODELLI_STAMPA.map((m) => (
              <Scelta key={m} attiva={stile.modello === m} disabled={!modificabile} onClick={() => imposta({ modello: m, palette: MODELLI[m].palette, caratteri: MODELLI[m].caratteri })}>
                <span className="leading-tight">{MODELLI[m].nome}</span>
              </Scelta>
            ))}
          </div>
          <div role="radiogroup" aria-label="Palette dei segnaposto" className="grid grid-cols-2 gap-2">
            {PALETTE_STAMPA.map((p) => (
              <Scelta key={p} attiva={stile.palette === p} disabled={!modificabile} onClick={() => imposta({ palette: p })}>
                <span className="flex -space-x-1" aria-hidden>
                  {[PALETTE[p].accento, PALETTE[p].secondario, PALETTE[p].inchiostro].map((c, i) => (
                    <span key={i} className="size-5 rounded-full border-2 border-carta" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 leading-tight">{PALETTE[p].nome}</span>
              </Scelta>
            ))}
          </div>
          <div role="radiogroup" aria-label="Caratteri dei segnaposto" className="grid grid-cols-2 gap-2">
            {CARATTERI_STAMPA.map((c) => (
              <Scelta key={c} attiva={stile.caratteri === c} disabled={!modificabile} onClick={() => imposta({ caratteri: c })}>
                <span className="w-9 shrink-0 text-center text-2xl leading-none" style={{ fontFamily: FAMIGLIE[c].titoli }} aria-hidden>
                  Aa
                </span>
                <span className="min-w-0 leading-tight">{CARATTERI[c].nome}</span>
              </Scelta>
            ))}
          </div>
          <Interruttore etichetta="Decorazioni" aiuto="Cornici e ornamenti del modello" checked={stile.decorazioni} disabled={!modificabile} onChange={(v) => imposta({ decorazioni: v })} />
        </>
      ) : (
        <p className="text-[0.8125rem] text-testo-tenue">Stessi modello, colori, caratteri e decorazioni del menù stampato: cambiando il menù cambiano anche i segnaposto.</p>
      )}
    </Sezione>
  )
}

// ── Anteprima ───────────────────────────────────────────────

/** Un segnaposto in grande: com'è sul tavolo (il cavalletto con la faccia anteriore). */
function Esempio({ testo, imp, pronti }: { testo: string; imp: ImpostazioniFogli; pronti: boolean }) {
  const { ref, larghezza } = useLarghezza<HTMLDivElement>()
  const g = griglia(imp.formato)
  const w = g.larghezza * PX_PER_MM
  const scala = larghezza ? Math.min(1.6, (larghezza - 2) / w) : 0
  return (
    <div ref={ref} className="flex w-full justify-center rounded-2xl bg-[#e9e2d8] p-3 dark:bg-[#3a322c] sm:p-5" data-testid="esempio-segnaposto" data-pronto={pronti ? '' : undefined}>
      {scala > 0 ? (
        <div className="overflow-hidden rounded-[2px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.18),0_12px_30px_-12px_rgb(60_40_20/0.35)]" style={{ width: w * scala, height: g.altezza * PX_PER_MM * scala }}>
          <div style={{ transform: `scale(${scala})`, transformOrigin: '0 0', width: w }}>
            <Cartoncino testo={testo} imp={imp} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AnteprimaFogli({ cartoncini, imp, pronti }: { cartoncini: { chiave: string; testo: string }[]; imp: ImpostazioniFogli; pronti: boolean }) {
  const { ref, larghezza } = useLarghezza<HTMLDivElement>()
  const w = 210 * PX_PER_MM
  const h = 297 * PX_PER_MM
  const scala = larghezza ? Math.min(0.75, (larghezza - 2) / w) : 0
  const fogli = fogliDi(cartoncini, imp.formato)
  return (
    <div ref={ref} data-testid="anteprima-segnaposto" data-pronto={pronti ? '' : undefined} className="flex w-full flex-col items-center gap-4 rounded-2xl bg-[#e9e2d8] p-3 dark:bg-[#3a322c] sm:p-5">
      {scala > 0
        ? fogli.map((_, i) => (
            <div key={i} className="relative shrink-0 overflow-hidden rounded-[2px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.18),0_12px_30px_-12px_rgb(60_40_20/0.35)]" style={{ width: w * scala, height: h * scala }} aria-label={`Foglio ${i + 1}`} role="img">
              <div style={{ transform: `scale(${scala})`, transformOrigin: '0 0', width: w, height: h }}>
                <FogliSegnaposto cartoncini={cartoncini} imp={imp} solo={i} />
              </div>
            </div>
          ))
        : null}
    </div>
  )
}

function IconaFormato({ formato }: { formato: FormatoSegnaposto }) {
  return (
    <svg viewBox="0 0 34 26" className="h-7 w-9 text-testo-tenue" aria-hidden>
      {formato === 'cavalletto' ? (
        <>
          <path d="M5 23 L13 5 H21 L29 23" className="fill-carta stroke-current" strokeLinejoin="round" />
          <path d="M13 5 H21" className="stroke-current" strokeWidth="1.6" />
        </>
      ) : (
        <rect x="4" y="8" width="26" height="13" rx="1" className="fill-carta stroke-current" />
      )}
    </svg>
  )
}

function ConsigliSegnaposto({ formato }: { formato: FormatoSegnaposto }) {
  return (
    <details className="rounded-xl bg-tenue/70 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Consigli per la stampa e il PDF</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-testo-tenue">
        <li>
          Carta: <strong className="text-testo">A4, verticale</strong>; scala <strong className="text-testo">100%</strong> (non «Adatta alla pagina»), altrimenti i segnaposto non misurano 9 cm; margini «Predefiniti» o «Nessuno».
        </li>
        <li>Un cartoncino leggero (160–220 g/m²) sta in piedi meglio della carta normale, se la stampante lo accetta.</li>
        <li>Per i colori di fondo attiva «Grafica di sfondo» (Chrome) o «Stampa sfondi» (Firefox, Safari). Nomi, cornici e ornamenti escono comunque.</li>
        <li>Per il PDF scegli «Salva come PDF» come stampante; aprendolo con un altro programma controlla che stampi al 100%.</li>
        {formato === 'cavalletto' ? <li>Piega a metà seguendo le due tacche sui bordi, con il nome verso l'esterno.</li> : null}
        <li>Taglia lungo il tratteggio grigio (se attivo): i segnaposto vicini hanno il bordo in comune.</li>
      </ul>
    </details>
  )
}
