// Pagine e fogli del menù stampato: stesso DOM per anteprima, misure e stampa.
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type ModelloStampa, type OpzioniStampa, PALETTE } from '@/domain/stampa.ts'
import { caricaCaratteri, FAMIGLIE } from './caratteri'
import { type ContenutoStampa, geometria, impagina, LIVELLI, type MisuraBlocco, type Pezzo, type PortataStampa, scegliLivello } from './impaginazione'
import { Agrifoglio, Coriandoli, Festone, Fregio, Ghirlanda, Ramoscello, Stellina } from './Ornamenti'
import './stampa.css'

export interface Impaginazione {
  livello: number
  pagine: Pezzo[][]
}

/** Tutti i blocchi su una pagina: prima delle misure e nelle miniature. */
export function tuttoInUnaPagina(c: ContenutoStampa): Impaginazione {
  return { livello: 0, pagine: [chiaviBlocchi(c).map((chiave) => ({ chiave }))] }
}

function chiaviBlocchi(c: ContenutoStampa): string[] {
  return ['testata', ...c.portate.map((p) => `portata:${p.id}`), ...(c.nota ? ['nota'] : [])]
}

function variabili(o: OpzioniStampa, livello: number): CSSProperties {
  const g = geometria(o.formato)
  const f = FAMIGLIE[o.caratteri]
  const p = PALETTE[o.palette]
  const l = LIVELLI[livello] ?? LIVELLI[0]
  return {
    width: `${g.pagina.larghezza}mm`,
    height: `${g.pagina.altezza}mm`,
    '--k': g.scala,
    '--d': l.carattere,
    '--g': l.spazi,
    '--fk': f.fattoreTesto,
    '--ft': f.fattoreTitoli,
    '--f-titoli': f.titoli,
    '--f-testo': f.testo,
    '--f-etichette': f.etichette,
    '--inchiostro': p.inchiostro,
    '--accento': p.accento,
    '--secondario': p.secondario,
    '--tenue': p.tenue,
  } as CSSProperties
}

// ── Blocchi ─────────────────────────────────────────────────

function Testata({ c, m, deco }: { c: ContenutoStampa; m: ModelloStampa; deco: boolean }) {
  const titolo = <h1 className="menu-titolo">{c.titolo}</h1>
  const sottotitolo = c.sottotitolo ? <p className="menu-sottotitolo">{c.sottotitolo}</p> : null
  const data = c.data ? <p className="menu-data">{c.data}</p> : null
  let corpo: ReactNode
  switch (m) {
    case 'elegante':
      corpo = (
        <>
          <p className="menu-etichetta">Menù</p>
          {titolo}
          {sottotitolo}
          {deco ? <Fregio className="orn-fregio" /> : <span className="menu-filetto" />}
          {data}
        </>
      )
      break
    case 'minimal':
      corpo = (
        <>
          <p className="menu-etichetta">Menù</p>
          {titolo}
          {c.data || c.sottotitolo ? (
            <p className="menu-meta">
              {c.data ? <span>{c.data}</span> : null}
              {c.sottotitolo ? <span>{c.sottotitolo}</span> : null}
            </p>
          ) : null}
          <span className="menu-barra" />
        </>
      )
      break
    case 'rustico':
      corpo = (
        <>
          {deco ? <Ghirlanda className="orn-ghirlanda" /> : null}
          <p className="menu-etichetta">Menù</p>
          {titolo}
          {sottotitolo}
          {data}
        </>
      )
      break
    case 'festivo':
      corpo = (
        <>
          <p className="menu-etichetta">
            {deco ? <Stellina className="orn-stellina" colore="var(--secondario)" /> : null}
            Menù
            {deco ? <Stellina className="orn-stellina" colore="var(--secondario)" /> : null}
          </p>
          {titolo}
          {sottotitolo}
          {data}
        </>
      )
      break
    case 'natale':
      corpo = (
        <>
          {deco ? <Agrifoglio className="orn-agrifoglio" /> : null}
          <p className="menu-etichetta">Menù</p>
          {titolo}
          {sottotitolo}
          {data}
          {deco ? (
            <span className="orn-stelle">
              <Stellina colore="var(--secondario)" />
              <Stellina colore="var(--accento)" />
              <Stellina colore="var(--secondario)" />
            </span>
          ) : (
            <span className="menu-filetto" />
          )}
        </>
      )
      break
  }
  return (
    <header className="menu-blocco menu-testata" data-blocco="testata">
      {corpo}
    </header>
  )
}

function Separatore({ m }: { m: ModelloStampa }) {
  if (m === 'rustico') return <Ramoscello className="orn-separatore" />
  if (m === 'natale') return <Stellina className="orn-separatore" colore="var(--accento)" />
  return null
}

function Portata({ p, m, deco, pezzo, separatore }: { p: PortataStampa; m: ModelloStampa; deco: boolean; pezzo: Pezzo; separatore: boolean }) {
  const voci = p.voci.slice(pezzo.da ?? 0, pezzo.a ?? p.voci.length)
  const conStelle = m === 'festivo' && deco
  return (
    <section className="menu-blocco menu-portata" data-blocco={`portata:${p.id}`} data-segue={pezzo.segue ? '' : undefined}>
      {separatore && deco ? <Separatore m={m} /> : null}
      <h2 className="menu-nome-portata">
        {conStelle ? <Stellina className="orn-stellina" colore="var(--secondario)" /> : null}
        <span>{p.nome}</span>
        {conStelle ? <Stellina className="orn-stellina" colore="var(--secondario)" /> : null}
      </h2>
      <ul className="menu-voci">
        {voci.map((v) => (
          <li key={v.id} className="menu-voce" data-voce>
            <span className="menu-piatto">{v.nome}</span>
            {v.nota ? <span className="menu-nota-voce">{v.nota}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Nota({ testo, m, deco }: { testo: string; m: ModelloStampa; deco: boolean }) {
  return (
    <footer className="menu-blocco menu-nota" data-blocco="nota">
      {deco && m === 'elegante' ? <span className="menu-filetto" /> : null}
      {deco && m === 'rustico' ? <Ramoscello className="orn-separatore" /> : null}
      <p>{testo}</p>
    </footer>
  )
}

function Cornice({ m }: { m: ModelloStampa }) {
  switch (m) {
    case 'elegante':
      return (
        <div className="menu-cornice" aria-hidden>
          <div className="menu-cornice-interna" />
        </div>
      )
    case 'minimal':
      return (
        <div className="menu-verticale" aria-hidden>
          Menù
        </div>
      )
    case 'rustico':
      return (
        <>
          <div className="menu-cornice" aria-hidden />
          {(['alto-sx', 'alto-dx', 'basso-sx', 'basso-dx'] as const).map((a) => (
            <Ramoscello key={a} className={`orn-angolo ${a}`} />
          ))}
        </>
      )
    case 'festivo':
      return (
        <>
          <Festone className="orn-festone" />
          <Coriandoli className="orn-coriandoli" />
        </>
      )
    case 'natale':
      return (
        <>
          <div className="menu-cornice" aria-hidden />
          {(['alto-sx', 'alto-dx', 'basso-sx', 'basso-dx'] as const).map((a) => (
            <Stellina key={a} className={`orn-angolo ${a}`} colore="var(--secondario)" />
          ))}
        </>
      )
  }
}

// ── Pagina e fogli ──────────────────────────────────────────

export function PaginaMenu({
  contenuto: c,
  opzioni: o,
  pezzi,
  livello,
  numero = 0,
  modo,
}: {
  contenuto: ContenutoStampa
  opzioni: OpzioniStampa
  pezzi: Pezzo[]
  livello: number
  numero?: number
  /** «flusso»: altezza libera, per misurare; «vuota»: solo l'area, per la capienza. */
  modo?: 'flusso' | 'vuota'
}) {
  const portate = new Map(c.portate.map((p) => [`portata:${p.id}`, p]))
  return (
    <div
      className="menu-pagina"
      data-modello={o.modello}
      data-formato={o.formato}
      data-decorazioni={o.decorazioni ? '' : undefined}
      data-caratteri={o.caratteri}
      data-titoli-corsivi={FAMIGLIE[o.caratteri].titoliCorsivi ? '' : undefined}
      data-modo={modo}
      data-seguito={numero > 0 ? '' : undefined}
      style={variabili(o, livello)}
    >
      {o.decorazioni && !modo ? <Cornice m={o.modello} /> : null}
      <div className="menu-area">
        {modo === 'vuota'
          ? null
          : pezzi.map((z, i) => {
              if (z.chiave === 'testata') return <Testata key="testata" c={c} m={o.modello} deco={o.decorazioni} />
              if (z.chiave === 'nota') return c.nota ? <Nota key="nota" testo={c.nota} m={o.modello} deco={o.decorazioni} /> : null
              const p = portate.get(z.chiave)
              const primoSullaPagina = i === 0 || (i === 1 && pezzi[0]?.chiave === 'testata')
              return p ? <Portata key={`${z.chiave}:${z.da ?? 0}`} p={p} m={o.modello} deco={o.decorazioni} pezzo={z} separatore={!primoSullaPagina && !z.segue} /> : null
            })}
      </div>
    </div>
  )
}

/** I fogli fisici: in 2×A5 ogni foglio A4 orizzontale porta due copie della stessa pagina. */
export function FogliMenu({
  contenuto,
  opzioni,
  impaginazione,
  primoNumero = 0,
}: {
  contenuto: ContenutoStampa
  opzioni: OpzioniStampa
  impaginazione: Impaginazione
  /** Numero della prima pagina (l'anteprima rende un foglio alla volta). */
  primoNumero?: number
}) {
  const g = geometria(opzioni.formato)
  return (
    <>
      {impaginazione.pagine.map((pezzi, i) => (
        <div
          key={i}
          className="menu-foglio"
          data-formato={opzioni.formato}
          style={{ width: `${g.foglio.larghezza}mm`, height: `${g.foglio.altezza}mm`, '--altezza-foglio': `${g.foglio.altezza}mm` } as CSSProperties}
        >
          {Array.from({ length: g.copiePerFoglio }, (_, k) => (
            <PaginaMenu key={k} contenuto={contenuto} opzioni={opzioni} pezzi={pezzi} livello={impaginazione.livello} numero={primoNumero + i} />
          ))}
          {g.copiePerFoglio === 2 ? (
            <>
              <span className="menu-taglio alto" aria-hidden />
              <span className="menu-taglio basso" aria-hidden />
            </>
          ) : null}
        </div>
      ))}
    </>
  )
}

// ── Misure ──────────────────────────────────────────────────

function misura(radice: HTMLElement, livello: number): Pezzo[][] {
  const vuota = radice.querySelector<HTMLElement>(`[data-misura="vuota-${livello}"] .menu-area`)
  const flusso = radice.querySelector<HTMLElement>(`[data-misura="flusso-${livello}"] .menu-area`)
  if (!vuota || !flusso) return [[]]
  const inizio = flusso.getBoundingClientRect().top
  const blocchi: MisuraBlocco[] = [...flusso.querySelectorAll<HTMLElement>(':scope > [data-blocco]')].map((b) => {
    const r = b.getBoundingClientRect()
    const voci = [...b.querySelectorAll<HTMLElement>('[data-voce]')].map((v) => {
      const rv = v.getBoundingClientRect()
      return { alto: rv.top - inizio, basso: rv.bottom - inizio }
    })
    return { chiave: b.dataset.blocco!, alto: r.top - inizio, basso: r.bottom - inizio, ...(voci.length ? { voci } : {}) }
  })
  return impagina(blocchi, vuota.getBoundingClientRect().height)
}

/**
 * Impagina misurando il contenuto reale (caratteri caricati) a ogni livello di densità e
 * sceglie il più arioso col minor numero di pagine. Il misuratore va reso nella pagina.
 */
export function useImpaginazione(contenuto: ContenutoStampa, opzioni: OpzioniStampa): { impaginazione: Impaginazione; misurato: boolean; misuratore: ReactNode } {
  const [pronti, setPronti] = useState<string | null>(null)
  const [risultato, setRisultato] = useState<(Impaginazione & { chiave: string }) | null>(null)
  const radice = useRef<HTMLDivElement>(null)
  const chiave = JSON.stringify([contenuto, opzioni])

  useEffect(() => {
    let vivo = true
    void caricaCaratteri(opzioni.caratteri).then(() => {
      if (vivo) setPronti(opzioni.caratteri)
    })
    return () => {
      vivo = false
    }
  }, [opzioni.caratteri])

  useLayoutEffect(() => {
    if (pronti !== opzioni.caratteri || !radice.current) return
    const perLivello = LIVELLI.map((_, i) => misura(radice.current!, i))
    const livello = scegliLivello(perLivello)
    setRisultato({ chiave, livello, pagine: perLivello[livello]! })
  }, [chiave, pronti, opzioni.caratteri])

  const tutti = tuttoInUnaPagina(contenuto)
  const misuratore = (
    <div ref={radice} className="menu-misuratore" aria-hidden>
      {LIVELLI.map((_, i) => (
        <div key={i}>
          <div data-misura={`vuota-${i}`}>
            <PaginaMenu contenuto={contenuto} opzioni={opzioni} pezzi={[]} livello={i} modo="vuota" />
          </div>
          <div data-misura={`flusso-${i}`}>
            <PaginaMenu contenuto={contenuto} opzioni={opzioni} pezzi={tutti.pagine[0]!} livello={i} modo="flusso" />
          </div>
        </div>
      ))}
    </div>
  )
  const valido = risultato && risultato.chiave === chiave
  return { impaginazione: risultato ?? tutti, misurato: Boolean(valido), misuratore }
}
