// Suggerimenti dal ricettario durante l'inserimento rapido (SPEC F2.3): sceglierne uno
// collega la voce al piatto; ignorarli lascia la voce libera. Da tastiera: frecce, Invio, Esc.
import { ChefHat } from 'lucide-react'
import { usePiatti } from '@/api/query'
import type { RiepilogoPiatto } from '@/contratto/ricettario.ts'
import { cercaRicette, type Risultato } from '@/domain/ricerca.ts'
import { cn } from '@/lib/utils'

/** Ricette per nome e ingredienti, le più pertinenti per prime (SPEC §23). */
export function cercaPiatti(piatti: RiepilogoPiatto[], testo: string, massimo = 5): Risultato<RiepilogoPiatto>[] {
  return cercaRicette(piatti, testo).slice(0, massimo)
}

/** «con zucchine, menta» sotto un piatto trovato per i suoi ingredienti. */
export function NotaIngredienti({ r }: { r: Risultato<RiepilogoPiatto> }) {
  return r.ingredientiTrovati.length ? <span className="block truncate text-xs text-testo-tenue">con {r.ingredientiTrovati.join(', ')}</span> : null
}

/** Ricette proposte per il testo scritto (le stesse che mostra SuggerimentiPiatti). */
export function usePiattiProposti(testo: string, attivi: boolean): Risultato<RiepilogoPiatto>[] {
  const piatti = usePiatti()
  return attivi ? cercaPiatti(piatti.data ?? [], testo) : []
}

/**
 * Elenco di una combobox: il campo resta il fuoco, le frecce scelgono l'opzione attiva
 * (`attivo`, annunciata con aria-activedescendant), Invio la collega, Esc chiude.
 */
export function SuggerimentiPiatti({ id, trovati, attivo, onScegli }: { id: string; trovati: Risultato<RiepilogoPiatto>[]; attivo: number; onScegli: (p: RiepilogoPiatto) => void }) {
  if (trovati.length === 0) return null
  return (
    <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-bordo bg-carta shadow-lg">
      <p className="px-3 pt-2 text-xs text-testo-tenue">Dal ricettario (tocca per collegare, o frecce e Invio)</p>
      <ul role="listbox" id={id} aria-label="Piatti del ricettario">
        {trovati.map((r, i) => (
          <li
            key={r.ricetta.id}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === attivo}
            className={cn('flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm hover:bg-tenue', i === attivo && 'bg-tenue')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onScegli(r.ricetta)}
          >
            <ChefHat className="size-4 shrink-0 text-successo" />
            <span className="min-w-0">
              {r.ricetta.nome}
              <NotaIngredienti r={r} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
