// Elementi di navigazione condivisi (SPEC §31): schede di una sezione, segmenti di una scheda,
// «indietro» che segue la cronologia, titoli di sezione e righe che portano a un'altra pagina.
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

export interface Scheda {
  /** Destinazione del collegamento. */
  a: string
  etichetta: string
  /** La scheda è quella attiva per questo percorso (più percorsi per una scheda raggruppata). */
  attiva: (percorso: string) => boolean
}

/** Schede sempre visibili, larghe uguali: nessuna resta fuori schermo sul telefono. */
export function Schede({ schede, etichetta, className }: { schede: Scheda[]; etichetta: string; className?: string }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label={etichetta} className={cn('grid', className)} style={{ gridTemplateColumns: `repeat(${schede.length}, minmax(0, 1fr))` }}>
      {schede.map((s) => {
        const attiva = s.attiva(pathname)
        return (
          <Link
            key={s.etichetta}
            to={s.a}
            aria-current={attiva ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center justify-center truncate border-b-2 border-transparent px-1 text-[0.8125rem] font-medium text-testo-tenue hover:text-testo sm:text-sm',
              attiva && 'border-primario text-primario hover:text-primario',
            )}
          >
            {s.etichetta}
          </Link>
        )
      })}
    </nav>
  )
}

/** Sottosezioni di una scheda (es. Presenze · Chi porta), come interruttore a segmenti. */
export function Segmenti({ voci, etichetta, className }: { voci: Scheda[]; etichetta: string; className?: string }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label={etichetta} className={cn('flex rounded-xl bg-tenue p-1 dark:bg-sfondo', className)}>
      {voci.map((s) => {
        const attiva = s.attiva(pathname)
        return (
          <Link
            key={s.etichetta}
            to={s.a}
            replace
            aria-current={attiva ? 'page' : undefined}
            // Selezionato chiaro con ombra (nel tema scuro la superficie più chiara). Con il testo grande va a
            // capo, con un tetto di 16 px perché ogni parola stia nella sua colonna anche a 360 px.
            className={cn(
              'flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-1 text-center text-[min(0.875rem,16px)] leading-tight font-medium text-testo-tenue',
              attiva && 'bg-carta font-semibold text-testo shadow-carta dark:bg-tenue',
            )}
          >
            {s.etichetta}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Indietro: alla pagina precedente dell'app se c'è (es. dalle notifiche o da una ricetta),
 * altrimenti alla pagina indicata (aperta da un collegamento esterno o dopo un ricaricamento).
 */
export function useIndietro(altrimenti: string): () => void {
  const naviga = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) naviga(-1)
    else naviga(altrimenti)
  }
}

export function PulsanteIndietro({ a, etichetta, className }: { a: string; etichetta?: string; className?: string }) {
  const indietro = useIndietro(a)
  return (
    <button
      type="button"
      onClick={indietro}
      aria-label={etichetta ? undefined : 'Indietro'}
      className={cn('flex items-center gap-1 rounded-xl text-sm text-testo-tenue hover:text-testo', etichetta ? 'min-h-9' : '-ml-2 mt-0.5 size-10 shrink-0 justify-center hover:bg-tenue', className)}
    >
      <ArrowLeft className={etichetta ? 'size-4' : 'size-5'} />
      {etichetta}
    </button>
  )
}

/** Titolo di un gruppo in una pagina («CONDIVISI CON ME ───»). */
export function TitoloSezione({ children, className, filetto = true }: { children: ReactNode; className?: string; filetto?: boolean }) {
  return (
    <h2 className={cn('flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-testo-tenue', className)}>
      {children}
      {filetto ? <span className="filetto flex-1" /> : null}
    </h2>
  )
}

/** Riga che porta a un'altra pagina: icona, titolo, descrizione, freccia. */
export function RigaLink({ a, icona: Icona, titolo, descrizione }: { a: string; icona: LucideIcon; titolo: ReactNode; descrizione?: ReactNode }) {
  return (
    <Link to={a} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-tenue/60">
      <Icona className="size-5 shrink-0 text-primario" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titolo}</span>
        {descrizione ? <span className="block text-sm text-testo-tenue">{descrizione}</span> : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-testo-tenue" aria-hidden />
    </Link>
  )
}

/** Elenco di righe-link in un riquadro, con divisori. */
export function ElencoLink({ children, etichetta }: { children: ReactNode; etichetta?: string }) {
  return (
    <nav aria-label={etichetta} className="flex flex-col divide-y divide-bordo/60 overflow-hidden rounded-2xl border border-bordo/70 bg-carta shadow-carta">
      {children}
    </nav>
  )
}
