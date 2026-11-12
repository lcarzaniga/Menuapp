// Ornamenti SVG originali del menù stampato. I colori vengono dalle variabili della palette,
// così stampano anche senza «Grafica di sfondo».
import type { CSSProperties } from 'react'

const A: CSSProperties = { fill: 'var(--accento)' }
const S: CSSProperties = { fill: 'var(--secondario)' }
const linea = (colore: string, spessore = 1): CSSProperties => ({ fill: 'none', stroke: colore, strokeWidth: spessore, strokeLinecap: 'round' })

/** Fregio tipografico: due volute simmetriche con un rombo al centro. */
export function Fregio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 16" className={className} aria-hidden>
      <path d="M2 8 H40 M80 8 H118" style={linea('var(--secondario)', 0.6)} />
      <path d="M44 8 C48 2 54 2 55 6 C56 9 52 10 51 8 M76 8 C72 2 66 2 65 6 C64 9 68 10 69 8" style={linea('var(--accento)', 1)} />
      <path d="M60 3 L64 8 L60 13 L56 8 Z" style={A} />
      <circle cx="42" cy="8" r="1.2" style={S} />
      <circle cx="78" cy="8" r="1.2" style={S} />
    </svg>
  )
}

/** Ramoscello d'ulivo: stelo curvo con foglie alterne e qualche oliva. */
export function Ramoscello({ className, specchio }: { className?: string; specchio?: boolean }) {
  const foglie = [
    [14, 13, -38],
    [24, 11, 32],
    [34, 10.5, -34],
    [44, 10.2, 30],
    [54, 10.5, -30],
    [63, 11.5, 28],
  ] as const
  return (
    <svg viewBox="0 0 80 24" className={className} aria-hidden style={specchio ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 16 Q36 7 74 12" style={linea('var(--secondario)', 1)} />
      {foglie.map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y + (r < 0 ? -3.2 : 3.2)} rx="5.4" ry="1.9" transform={`rotate(${r} ${x} ${y})`} style={S} />
      ))}
      <ellipse cx="72" cy="12" rx="4.6" ry="1.7" transform="rotate(-8 72 12)" style={S} />
      <circle cx="30" cy="16" r="2" style={A} />
      <circle cx="49" cy="15" r="1.8" style={A} />
    </svg>
  )
}

/** Coppia di rami d'ulivo che incorniciano un'etichetta. */
export function Ghirlanda({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden style={{ display: 'flex', justifyContent: 'center', gap: '0.4em' }}>
      <Ramoscello className="orn-ramo" specchio />
      <Ramoscello className="orn-ramo" />
    </span>
  )
}

const FOGLIA_AGRIFOGLIO =
  'M0 0 Q4 -6 9 -4 Q11 -9 16 -6 Q19 -11 24 -6 Q28 -9 31 -4 Q37 -4 40 0 Q37 4 31 4 Q28 9 24 6 Q19 11 16 6 Q11 9 9 4 Q4 6 0 0 Z'

/** Rametto di agrifoglio: due foglie e tre bacche. */
export function Agrifoglio({ className }: { className?: string }) {
  return (
    <svg viewBox="-44 -22 88 34" className={className} aria-hidden>
      <g transform="rotate(-18) translate(2 -2)">
        <path d={FOGLIA_AGRIFOGLIO} style={S} />
        <path d="M2 0 H36" style={linea('var(--carta-menu)', 0.6)} />
      </g>
      <g transform="scale(-1 1) rotate(-18) translate(2 -2)">
        <path d={FOGLIA_AGRIFOGLIO} style={S} />
        <path d="M2 0 H36" style={linea('var(--carta-menu)', 0.6)} />
      </g>
      <circle cx="-4" cy="2" r="4" style={A} />
      <circle cx="4" cy="2.5" r="4" style={A} />
      <circle cx="0" cy="-4" r="4" style={A} />
      <circle cx="-5.2" cy="0.8" r="1" style={{ fill: 'var(--carta-menu)', opacity: 0.6 }} />
    </svg>
  )
}

/** Stellina a quattro punte. */
export function Stellina({ className, colore = 'var(--secondario)' }: { className?: string; colore?: string }) {
  return (
    <svg viewBox="-8 -8 16 16" className={className} aria-hidden>
      <path d="M0 -7 L1.6 -1.6 L7 0 L1.6 1.6 L0 7 L-1.6 1.6 L-7 0 L-1.6 -1.6 Z" style={{ fill: colore }} />
    </svg>
  )
}

/** Festone di bandierine lungo il bordo superiore. */
export function Festone({ className }: { className?: string }) {
  const colori = ['var(--accento)', 'var(--secondario)', 'var(--inchiostro-tenue)']
  const archi = [
    [0, 100],
    [100, 200],
  ] as const
  const bandiere: { x: number; y: number; c: string; r: number }[] = []
  archi.forEach(([x0, x1], k) => {
    for (let i = 1; i < 8; i++) {
      const t = i / 8
      const x = x0 + (x1 - x0) * t
      const y = 4 + 4 * 14 * t * (1 - t) // parabola: y = 4 + 14·4t(1−t)
      const pendenza = (14 * 4 * (1 - 2 * t)) / (x1 - x0)
      bandiere.push({ x, y, c: colori[(i + k) % 3]!, r: (Math.atan(pendenza) * 180) / Math.PI })
    }
  })
  return (
    <svg viewBox="0 0 200 34" preserveAspectRatio="none" className={className} aria-hidden>
      <path d="M0 4 Q50 32 100 4 Q150 32 200 4" style={linea('var(--inchiostro-tenue)', 0.5)} />
      {bandiere.map((b, i) => (
        <path key={i} d="M-4.5 0 L4.5 0 L0 10 Z" transform={`translate(${b.x} ${b.y}) rotate(${b.r})`} style={{ fill: b.c }} />
      ))}
    </svg>
  )
}

/** Coriandoli sparsi (posizioni fisse: il menù deve venire uguale a ogni stampa). */
export function Coriandoli({ className }: { className?: string }) {
  const pezzi: [number, number, number, number][] = []
  let seme = 7
  const caso = () => {
    seme = (seme * 9301 + 49297) % 233280
    return seme / 233280
  }
  for (let i = 0; i < 26; i++) pezzi.push([caso() * 200, caso() * 30, caso() * 180, Math.floor(caso() * 3)])
  const colori = ['var(--accento)', 'var(--secondario)', 'var(--inchiostro-tenue)']
  return (
    <svg viewBox="0 0 200 30" preserveAspectRatio="none" className={className} aria-hidden>
      {pezzi.map(([x, y, r, c], i) =>
        i % 3 === 0 ? (
          <circle key={i} cx={x} cy={y} r="1.1" style={{ fill: colori[c] }} />
        ) : (
          <rect key={i} x={x} y={y} width="3" height="1.3" rx="0.4" transform={`rotate(${r} ${x} ${y})`} style={{ fill: colori[c] }} />
        ),
      )}
    </svg>
  )
}
