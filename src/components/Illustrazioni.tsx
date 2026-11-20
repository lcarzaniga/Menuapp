// Illustrazioni a tratto, nei colori del tema (incluse nell'app: funzionano offline).
import type { ReactNode, SVGProps } from 'react'
import { norm } from '@/domain/testo.ts'
import type { TipoEvento } from '@/domain/tipi.ts'

type Props = SVGProps<SVGSVGElement> & { titolo?: string }

const T = { stroke: 'var(--testo)', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const tenue = 'var(--primario-tenue)'
// Dettagli caldi (bacche, candeline, pomodori): terracotta, non il colore delle azioni.
const primario = 'var(--accento-caldo)'
const salvia = 'var(--salvia)'
const salviaTenue = 'var(--salvia-tenue)'
const oro = 'var(--oro)'
const carta = 'var(--carta)'

function Svg({ titolo, children, ...p }: Props & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 160" role={titolo ? 'img' : undefined} aria-hidden={titolo ? undefined : true} {...p}>
      {titolo ? <title>{titolo}</title> : null}
      {children}
    </svg>
  )
}

/** Tavola apparecchiata: piatto, posate, tovagliolo e rametto. */
export function Tavola(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="138" rx="96" ry="10" fill={tenue} opacity="0.55" />
      <path {...T} d="M44 96 l20 -50 h16 l-10 50 z" fill={salviaTenue}/>
      <path {...T} d="M58 70 h14"/>
      <circle {...T} cx="120" cy="88" r="44" fill={carta}/>
      <circle cx="120" cy="88" r="32" fill={tenue} stroke={oro} strokeWidth="1.5" />
      <circle cx="120" cy="88" r="38" fill="none" stroke={oro} strokeWidth="1" strokeDasharray="2 5" />
      <path {...T} d="M180 48 v80 M174 48 v20 a6 6 0 0 0 12 0 v-20 M180 48 v20"/>
      <path {...T} d="M200 48 c10 10 8 32 0 40 v40"/>
      <path {...T} d="M200 88 h0"/>
      <path d="M112 76 c6 -10 14 -12 22 -10 c-4 8 -12 12 -22 10 z" fill={salvia} opacity="0.85" />
      <path d="M106 96 c4 -8 10 -10 16 -8 c-3 6 -9 9 -16 8 z" fill={salvia} opacity="0.6" />
      <circle cx="128" cy="96" r="4" fill={primario} />
    </Svg>
  )
}

/** Agrifoglio con bacche e nastro: Natale e inverno. */
export function Agrifoglio(p: Props) {
  const foglia = 'M0 0 c8 -6 10 -14 22 -16 c-2 6 2 10 8 10 c-4 4 -4 10 0 14 c-6 0 -10 4 -8 10 c-12 -2 -14 -10 -22 -18 z'
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="80" ry="8" fill={tenue} opacity="0.5" />
      <g transform="translate(118 84) rotate(-150)">
        <path d={foglia} fill={salvia} stroke="var(--testo)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M2 0 L28 0" stroke={salviaTenue} strokeWidth="1.2" />
      </g>
      <g transform="translate(122 84) rotate(-30)">
        <path d={foglia} fill={salvia} stroke="var(--testo)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M2 0 L28 0" stroke={salviaTenue} strokeWidth="1.2" />
      </g>
      <g transform="translate(120 88) rotate(80)">
        <path d={foglia} fill={salvia} opacity="0.85" stroke="var(--testo)" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <circle cx="112" cy="80" r="8" fill={primario} stroke="var(--testo)" strokeWidth="1.6" />
      <circle cx="128" cy="78" r="8" fill={primario} stroke="var(--testo)" strokeWidth="1.6" />
      <circle cx="120" cy="92" r="8" fill={primario} stroke="var(--testo)" strokeWidth="1.6" />
      <circle cx="109" cy="77" r="2" fill={carta} opacity="0.8" />
      <circle cx="125" cy="75" r="2" fill={carta} opacity="0.8" />
      <circle cx="117" cy="89" r="2" fill={carta} opacity="0.8" />
      <path d="M60 30 l4 8 8 1 -6 6 2 8 -8 -4 -8 4 2 -8 -6 -6 8 -1 z" fill={oro} opacity="0.7" />
      <path d="M186 40 l3 6 6 1 -4 4 1 6 -6 -3 -6 3 1 -6 -4 -4 6 -1 z" fill={oro} opacity="0.55" />
      <circle cx="176" cy="104" r="2.5" fill={oro} />
      <circle cx="64" cy="108" r="2" fill={oro} />
    </Svg>
  )
}

/** Torta a due piani con candeline: compleanni e anniversari. */
export function Torta(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="84" ry="8" fill={tenue} opacity="0.55" />
      <path {...T} d="M58 132 h124"/>
      <rect {...T} x="70" y="92" width="100" height="40" rx="6" fill={carta}/>
      <path d="M70 104 c10 8 16 -6 25 2 c9 8 16 -6 25 2 c9 8 16 -6 25 2 c9 8 16 -4 25 0" fill="none" stroke={primario} strokeWidth="3" strokeLinecap="round" />
      <rect {...T} x="88" y="62" width="64" height="30" rx="5" fill={tenue}/>
      <path d="M88 72 c8 6 12 -4 20 2 c8 6 12 -4 20 2 c8 6 12 -4 24 0" fill="none" stroke={carta} strokeWidth="3" strokeLinecap="round" />
      {[104, 120, 136].map((x, i) => (
        <g key={x}>
          <rect x={x - 2.5} y="42" width="5" height="20" rx="2" fill={i === 1 ? salvia : oro} stroke="var(--testo)" strokeWidth="1.2" />
          <path d={`M${x} 40 c-5 -6 0 -12 0 -14 c0 2 5 8 0 14 z`} fill={primario} />
        </g>
      ))}
      <circle cx="60" cy="50" r="3" fill={oro} />
      <circle cx="184" cy="60" r="3" fill={salvia} />
      <circle cx="176" cy="38" r="2" fill={primario} />
    </Svg>
  )
}

/** Due calici che brindano: aperitivi, Capodanno, festeggiamenti. */
export function Calici(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="70" ry="8" fill={tenue} opacity="0.55" />
      <g transform="rotate(-12 96 90)">
        <path {...T} d="M78 40 h36 c0 26 -6 40 -18 42 c-12 -2 -18 -16 -18 -42 z" fill={carta}/>
        <path d="M80 54 h32 c-1 14 -6 24 -16 26 c-10 -2 -15 -12 -16 -26 z" fill={oro} opacity="0.75" />
        <path {...T} d="M96 82 v40 M84 124 h24"/>
      </g>
      <g transform="rotate(12 144 90)">
        <path {...T} d="M126 40 h36 c0 26 -6 40 -18 42 c-12 -2 -18 -16 -18 -42 z" fill={carta}/>
        <path d="M128 54 h32 c-1 14 -6 24 -16 26 c-10 -2 -15 -12 -16 -26 z" fill={primario} opacity="0.7" />
        <path {...T} d="M144 82 v40 M132 124 h24"/>
      </g>
      <path d="M120 22 v-8 M108 26 l-6 -6 M132 26 l6 -6" stroke={oro} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="98" cy="62" r="2" fill={carta} />
      <circle cx="104" cy="70" r="1.5" fill={carta} />
      <circle cx="142" cy="66" r="2" fill={carta} />
    </Svg>
  )
}

/** Pentola con vapore ed erbe: cucina e vista cucina. */
export function Pentola(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="84" ry="8" fill={tenue} opacity="0.55" />
      <path d="M100 30 c-8 -8 8 -14 0 -22 M120 34 c-8 -8 8 -14 0 -22 M140 30 c-8 -8 8 -14 0 -22" stroke={oro} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M70 62 h100 v52 a16 16 0 0 1 -16 16 h-68 a16 16 0 0 1 -16 -16 z" fill={primario} stroke="var(--testo)" strokeWidth="2" strokeLinejoin="round" />
      <path {...T} d="M66 56 h108 a4 4 0 0 1 0 8 h-108 a4 4 0 0 1 0 -8 z" fill={carta}/>
      <path {...T} d="M70 76 h-14 M170 76 h14" strokeWidth="5"/>
      <path d="M84 88 h72" stroke={carta} strokeWidth="2" opacity="0.5" />
      <path {...T} d="M150 56 c10 -24 30 -30 44 -26"/>
      <path d="M176 34 c6 -6 14 -6 18 -2 c-4 6 -12 6 -18 2 z M186 44 c6 -4 12 -2 14 2 c-4 4 -10 4 -14 -2 z" fill={salvia} />
    </Svg>
  )
}

/** Cesto della spesa con pane, verdure e bottiglia. */
export function Cesto(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="90" ry="8" fill={tenue} opacity="0.55" />
      <path {...T} d="M150 74 l14 -54 h10 l-6 54" fill={salvia} opacity="0.8"/>
      <path {...T} d="M86 70 c-4 -20 6 -36 18 -42 c4 14 0 32 -8 42" fill={salviaTenue}/>
      <path {...T} d="M104 72 l30 -50 c6 -4 12 0 10 6 l-24 46" fill={oro} opacity="0.85"/>
      <path d="M118 44 l8 4 M124 36 l8 4 M112 54 l8 4" stroke="var(--testo)" strokeWidth="1.4" strokeLinecap="round" />
      <circle {...T} cx="80" cy="74" r="12" fill={primario}/>
      <path {...T} d="M80 62 c0 -4 2 -6 4 -8"/>
      <path {...T} d="M54 76 h132 l-12 52 a8 8 0 0 1 -8 6 h-92 a8 8 0 0 1 -8 -6 z" fill={carta}/>
      <path d="M62 92 h116 M66 108 h108 M90 78 l-6 54 M120 78 v54 M150 78 l6 54" stroke={oro} strokeWidth="1.4" />
      <path d="M70 76 c0 -36 100 -36 100 0" fill="none" stroke="var(--testo)" strokeWidth="2" strokeDasharray="0" opacity="0.35" />
    </Svg>
  )
}

/** Ricettario aperto con cucchiaio di legno. */
export function Ricettario(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="92" ry="8" fill={tenue} opacity="0.55" />
      <path {...T} d="M40 40 c26 -8 54 -6 80 8 c26 -14 54 -16 80 -8 v86 c-26 -8 -54 -6 -80 8 c-26 -14 -54 -16 -80 -8 z" fill={carta}/>
      <path {...T} d="M120 48 v86"/>
      <path d="M56 58 c16 -4 34 -2 50 4 M56 72 c16 -4 34 -2 50 4 M56 86 c16 -4 34 -2 50 4" stroke={oro} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M134 62 c16 -6 34 -6 50 -2" stroke={primario} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M134 76 c16 -6 34 -6 50 -2 M134 90 c16 -6 26 -6 36 -4" stroke={oro} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M150 128 l50 -66" stroke="var(--testo)" strokeWidth="5" strokeLinecap="round" />
      <ellipse {...T} cx="204" cy="56" rx="8" ry="13" transform="rotate(37 204 56)" fill={oro}/>
      <path d="M74 112 c6 -10 16 -12 24 -10 c-4 8 -14 12 -24 10 z" fill={salvia} />
    </Svg>
  )
}

/** Taccuino con spunte: piano delle preparazioni. */
export function Taccuino(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="70" ry="8" fill={tenue} opacity="0.55" />
      <rect {...T} x="76" y="24" width="88" height="110" rx="8" fill={carta}/>
      <rect {...T} x="102" y="16" width="36" height="14" rx="4" fill={oro}/>
      {[52, 76, 100].map((y, i) => (
        <g key={y}>
          <rect {...T} x="90" y={y - 8} width="14" height="14" rx="3" fill={i < 2 ? salviaTenue : carta} strokeWidth="1.6"/>
          {i < 2 ? <path d={`M93 ${y} l3 3 6 -7`} stroke={salvia} strokeWidth="2.4" fill="none" strokeLinecap="round" /> : null}
          <path d={`M112 ${y} h38`} stroke={i < 2 ? 'var(--testo-tenue)' : 'var(--testo)'} strokeWidth="2" strokeLinecap="round" opacity={i < 2 ? 0.5 : 1} />
        </g>
      ))}
      <path {...T} d="M180 120 l18 -60 6 2 -18 60 -8 4 z" fill={primario} strokeWidth="1.6"/>
    </Svg>
  )
}

/** Uova e rametto: Pasqua e brunch. */
export function Uova(p: Props) {
  return (
    <Svg {...p}>
      <ellipse cx="120" cy="140" rx="76" ry="8" fill={tenue} opacity="0.55" />
      <path {...T} d="M96 132 c-22 0 -30 -20 -26 -44 c4 -24 16 -42 26 -42 c10 0 22 18 26 42 c4 24 -4 44 -26 44 z" fill={tenue}/>
      <path d="M74 96 c8 -6 14 6 22 0 c8 -6 14 6 22 0" stroke={primario} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path {...T} d="M150 132 c-18 0 -24 -16 -20 -34 c3 -18 12 -32 20 -32 c8 0 17 14 20 32 c4 18 -2 34 -20 34 z" fill={salviaTenue}/>
      <circle cx="146" cy="96" r="3" fill={oro} />
      <circle cx="156" cy="110" r="3" fill={oro} />
      <circle cx="142" cy="116" r="2.5" fill={oro} />
      <path {...T} d="M176 128 c10 -30 20 -56 34 -70"/>
      <path d="M190 92 c8 -2 14 2 16 8 c-8 2 -14 -2 -16 -8 z M198 74 c8 -2 14 2 16 8 c-8 2 -14 -2 -16 -8 z" fill={salvia} />
    </Svg>
  )
}

export type NomeIllustrazione = 'tavola' | 'agrifoglio' | 'torta' | 'calici' | 'pentola' | 'cesto' | 'ricettario' | 'taccuino' | 'uova'

export const ILLUSTRAZIONI: Record<NomeIllustrazione, (p: Props) => ReactNode> = {
  tavola: Tavola,
  agrifoglio: Agrifoglio,
  torta: Torta,
  calici: Calici,
  pentola: Pentola,
  cesto: Cesto,
  ricettario: Ricettario,
  taccuino: Taccuino,
  uova: Uova,
}

/** Illustrazione adatta all'evento, dall'occasione e dal tipo. */
export function illustrazioneEvento(e: { occasione: string; tipo: TipoEvento; nome?: string }): NomeIllustrazione {
  const testo = norm(`${e.occasione} ${e.nome ?? ''}`)
  if (/natal|vigilia|stefano|epifania|avvento/.test(testo)) return 'agrifoglio'
  if (/capodanno|fine anno|laurea|promozione|brindisi/.test(testo)) return 'calici'
  if (/compleann|anniversar|battesim|comunion|cresima|festa/.test(testo)) return 'torta'
  if (/pasqu|pasquetta/.test(testo)) return 'uova'
  if (e.tipo === 'aperitivo') return 'calici'
  if (e.tipo === 'brunch') return 'uova'
  return 'tavola'
}

export function IllustrazioneEvento({ evento, className }: { evento: { occasione: string; tipo: TipoEvento; nome?: string }; className?: string }) {
  const C = ILLUSTRAZIONI[illustrazioneEvento(evento)]
  return <C className={className} />
}
