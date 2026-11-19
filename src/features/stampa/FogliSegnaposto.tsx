// Segnaposto stampati (SPEC §42): stesso DOM per anteprima e stampa, misure in mm. Ogni modello del
// menù ha una sua composizione per il cartoncino, con gli stessi colori, caratteri e ornamenti.
import type { CSSProperties, ReactNode } from 'react'
import { dueRighe, FACCIA, type FormatoSegnaposto, fogliDi, griglia, misuraNome, type StileSegnaposto } from '@/domain/segnaposto.ts'
import { type ModelloStampa, PALETTE } from '@/domain/stampa.ts'
import { FAMIGLIE } from './caratteri'
import { Agrifoglio, Festone, Fregio, Ghirlanda, Stellina } from './Ornamenti'
import './stampa.css'
import './segnaposto.css'

export interface CartoncinoStampa {
  chiave: string
  testo: string
}

export interface ImpostazioniFogli {
  formato: FormatoSegnaposto
  stile: StileSegnaposto
  /** Testo dell'evento sotto il nome; null = non mostrato. */
  evento: string | null
  secondaFaccia: boolean
  lineeTaglio: boolean
}

/** Zone fisse della faccia (mm): il nome ha sempre lo spazio che resta, senza sovrapposizioni. */
export const ZONE = { margineV: 5, margineO: 7, ornamento: 7, evento: 6 } as const

export function areaNome(deco: boolean, evento: boolean): { larghezza: number; altezza: number } {
  return {
    larghezza: FACCIA.larghezza - 2 * ZONE.margineO,
    altezza: FACCIA.altezza - 2 * ZONE.margineV - (deco ? ZONE.ornamento : 0) - (evento ? ZONE.evento : 0),
  }
}

function variabili(s: StileSegnaposto): CSSProperties {
  const f = FAMIGLIE[s.caratteri]
  const p = PALETTE[s.palette]
  return {
    '--f-titoli': f.titoli,
    '--f-testo': f.testo,
    '--f-etichette': f.etichette,
    '--inchiostro': p.inchiostro,
    '--accento': p.accento,
    '--secondario': p.secondario,
    '--tenue': p.tenue,
  } as CSSProperties
}

function Ornamento({ m }: { m: ModelloStampa }) {
  switch (m) {
    case 'elegante':
      return <Fregio className="sp-fregio" />
    case 'minimal':
      return <span className="sp-barra" />
    case 'rustico':
      return <Ghirlanda className="sp-ghirlanda" />
    case 'festivo':
      return <Festone className="sp-festone" />
    case 'natale':
      return <Agrifoglio className="sp-agrifoglio" />
  }
}

function Cornice({ m }: { m: ModelloStampa }) {
  if (m === 'minimal' || m === 'festivo') return null
  return (
    <span className="sp-cornice" aria-hidden>
      {m === 'elegante' ? <span className="sp-cornice-interna" /> : null}
      {m === 'natale'
        ? (['basso-sx', 'basso-dx'] as const).map((a) => <Stellina key={a} className={`sp-angolo ${a}`} colore="var(--secondario)" />)
        : null}
    </span>
  )
}

/** Una faccia da 90 × 50 mm: ornamento in alto, nome al centro, evento in basso. */
export function Faccia({ testo, imp }: { testo: string | null; imp: ImpostazioniFogli }) {
  const { stile } = imp
  const deco = stile.decorazioni
  const area = areaNome(deco, imp.evento !== null)
  const misura = testo ? misuraNome(testo, stile.caratteri, area.larghezza, area.altezza) : null
  const righe = testo && misura?.righe === 2 ? dueRighe(testo.split(/\s+/)) : [testo ?? '']
  return (
    <div
      className="sp-faccia"
      data-modello={stile.modello}
      data-decorazioni={deco ? '' : undefined}
      data-titoli-corsivi={FAMIGLIE[stile.caratteri].titoliCorsivi ? '' : undefined}
      data-testid="faccia-segnaposto"
      style={variabili(stile)}
    >
      {deco ? <Cornice m={stile.modello} /> : null}
      {deco ? (
        <div className="sp-zona-ornamento" aria-hidden>
          <Ornamento m={stile.modello} />
        </div>
      ) : null}
      <div className="sp-zona-nome" style={{ height: `${area.altezza}mm` }}>
        {testo ? (
          <p className="sp-nome" style={{ fontSize: `${misura!.pt}pt` }} data-righe={righe.length}>
            {righe.map((r, i) => (
              <span key={i}>{r}</span>
            ))}
          </p>
        ) : null}
      </div>
      {imp.evento !== null ? (
        <div className="sp-zona-evento">
          <p className="sp-evento">{testo ? imp.evento : ''}</p>
        </div>
      ) : null}
    </div>
  )
}

/** Il cartoncino intero: una faccia (piatto) o due con la piega in mezzo (cavalletto). */
export function Cartoncino({ testo, imp }: { testo: string; imp: ImpostazioniFogli }) {
  const g = griglia(imp.formato)
  return (
    <div className="sp-cartoncino" data-formato={imp.formato} style={{ width: `${g.larghezza}mm`, height: `${g.altezza}mm` }} data-testid="segnaposto" aria-label={testo}>
      {imp.formato === 'cavalletto' ? (
        <>
          {/* Faccia posteriore: capovolta, così dopo la piega si legge dritta dall'altro lato. */}
          <div className="sp-retro" data-testid="retro-segnaposto" data-vuota={imp.secondaFaccia ? undefined : ''}>
            {imp.secondaFaccia ? <Faccia testo={testo} imp={imp} /> : null}
          </div>
          <Faccia testo={testo} imp={imp} />
          <span className="sp-piega sx" aria-hidden />
          <span className="sp-piega dx" aria-hidden />
        </>
      ) : (
        <Faccia testo={testo} imp={imp} />
      )}
      {imp.lineeTaglio ? <span className="sp-taglio" aria-hidden /> : null}
    </div>
  )
}

/** I fogli A4: cartoncini accostati e centrati (girati se così ce ne stanno di più), mai a cavallo fra due pagine. */
export function FogliSegnaposto({ cartoncini, imp, solo }: { cartoncini: CartoncinoStampa[]; imp: ImpostazioniFogli; solo?: number }) {
  const g = griglia(imp.formato)
  const fogli = fogliDi(cartoncini, imp.formato)
  return (
    <>
      {fogli.map((foglio, i) =>
        solo === undefined || solo === i ? (
          <Foglio key={i} numero={i}>
            {foglio.map((c, k) => (
              <div
                key={c.chiave}
                className="sp-posto"
                data-ruotato={g.ruotato ? '' : undefined}
                style={{
                  left: `${g.margineX + (k % g.colonne) * g.passoX}mm`,
                  top: `${g.margineY + Math.floor(k / g.colonne) * g.passoY}mm`,
                  width: `${g.passoX}mm`,
                  height: `${g.passoY}mm`,
                  // Girato di 90° in senso orario attorno all'angolo in alto a sinistra, poi riportato nel suo posto.
                  ...(g.ruotato ? { '--spostamento': `${g.passoX}mm` } : {}),
                } as CSSProperties}
              >
                <Cartoncino testo={c.testo} imp={imp} />
              </div>
            ))}
          </Foglio>
        ) : null,
      )}
    </>
  )
}

function Foglio({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <div className="menu-foglio sp-foglio" data-formato="A4" data-testid="foglio-segnaposto" data-numero={numero + 1} style={{ width: '210mm', height: '297mm', '--altezza-foglio': '297mm' } as CSSProperties}>
      {children}
    </div>
  )
}
