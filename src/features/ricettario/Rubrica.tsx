// Rubrica alfabetica a lato del ricettario, come le linguette di una vecchia agenda telefonica.
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { ALFABETO, ALTRO_INIZIALE } from '@/domain/ricettario.ts'
import { cn } from '@/lib/utils'

export const idLettera = (l: string) => `rubrica-${l === ALTRO_INIZIALE ? 'altro' : l}`

/**
 * Lettera della sezione in cima allo schermo, aggiornata mentre si scorre. In fondo
 * all'elenco le ultime sezioni non arrivano in cima: vale la lettera scelta, finché è visibile.
 */
function useLetteraVisibile(lettere: string[]) {
  const [attiva, setAttiva] = useState(lettere[0] ?? '')
  const scelta = useRef<string | null>(null)
  useEffect(() => {
    let attesa = 0
    const aggiorna = () => {
      attesa = 0
      let corrente = lettere[0] ?? ''
      for (const l of lettere) {
        const el = document.getElementById(idLettera(l))
        if (el && el.getBoundingClientRect().top <= 24) corrente = l
      }
      const sezioneScelta = scelta.current ? document.getElementById(idLettera(scelta.current))?.getBoundingClientRect() : undefined
      if (sezioneScelta && sezioneScelta.top >= 0 && sezioneScelta.top < window.innerHeight && lettere.indexOf(scelta.current!) > lettere.indexOf(corrente)) {
        corrente = scelta.current!
      } else scelta.current = null
      setAttiva(corrente)
    }
    const suScorri = () => {
      if (!attesa) attesa = requestAnimationFrame(aggiorna)
    }
    aggiorna()
    window.addEventListener('scroll', suScorri, { passive: true })
    return () => {
      window.removeEventListener('scroll', suScorri)
      cancelAnimationFrame(attesa)
    }
  }, [lettere])
  const scegli = (l: string) => {
    scelta.current = l
    setAttiva(l)
  }
  return [attiva, scegli] as const
}

export function Rubrica({ lettere }: { lettere: string[] }) {
  const tasti = lettere.includes(ALTRO_INIZIALE) ? [...ALFABETO, ALTRO_INIZIALE] : ALFABETO
  const [attiva, scegliAttiva] = useLetteraVisibile(lettere)
  const [trascinata, setTrascinata] = useState<string | null>(null)
  const ultima = useRef<string | null>(null)

  // Come in un'agenda: una lettera senza piatti apre la prima lettera piena che segue.
  const salta = (tasto: string) => {
    const da = tasti.indexOf(tasto)
    const meta = tasti.slice(da).find((l) => lettere.includes(l)) ?? lettere.at(-1)
    if (!meta || ultima.current === meta) return meta
    ultima.current = meta
    scegliAttiva(meta)
    document.getElementById(idLettera(meta))?.scrollIntoView({ block: 'start' })
    return meta
  }
  const daPunto = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, Math.min(Math.max(e.clientY, r.top + 1), r.bottom - 1))
    const tasto = el?.closest<HTMLElement>('[data-tasto]')?.dataset.tasto
    if (tasto) setTrascinata(salta(tasto) ?? null)
  }
  const fine = () => {
    ultima.current = null
    setTrascinata(null)
  }

  return (
    <>
      <nav
        aria-label="Rubrica alfabetica"
        className="sticky top-3 -mr-3 flex h-[calc(100dvh-7.5rem)] max-h-[46rem] min-h-[22rem] w-7 shrink-0 touch-none select-none flex-col md:top-6 md:mr-0 md:h-[calc(100dvh-3rem)]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          daPunto(e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) daPunto(e)
        }}
        onPointerUp={fine}
        onPointerCancel={fine}
      >
        {tasti.map((l, i) => {
          const piena = lettere.includes(l)
          return (
            <button
              key={l}
              type="button"
              data-tasto={l}
              tabIndex={piena ? 0 : -1}
              aria-label={l === ALTRO_INIZIALE ? 'Piatti che cominciano con un numero' : `Lettera ${l}`}
              aria-current={l === attiva ? 'true' : undefined}
              onClick={(e) => {
                if (e.detail === 0) {
                  salta(l)
                  ultima.current = null
                }
              }}
              className={cn(
                'titolo -mb-px flex min-h-0 flex-1 items-center justify-center rounded-l-md border border-r-0 border-bordo/80 text-[0.8125rem] font-semibold leading-none shadow-[inset_-3px_0_4px_-3px_rgb(0_0_0/0.12)] transition-colors',
                i % 2 ? 'bg-tenue' : 'bg-carta',
                piena ? 'text-testo' : 'text-testo-tenue/45',
                l === attiva && 'border-primario bg-primario text-primario-testo',
              )}
            >
              {l}
            </button>
          )
        })}
      </nav>
      {trascinata ? (
        <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 z-40 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl bg-primario/90 text-primario-testo shadow-xl">
          <span className="titolo text-5xl font-bold">{trascinata}</span>
        </div>
      ) : null}
    </>
  )
}
