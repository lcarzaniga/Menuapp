// Suggerimenti dal ricettario durante l'inserimento rapido (SPEC F2.3): sceglierne uno
// collega la voce al piatto; ignorarli lascia la voce libera.
import { ChefHat } from 'lucide-react'
import { usePiatti } from '@/api/query'
import type { RiepilogoPiatto } from '@/contratto/ricettario.ts'
import { cercaRicette, type Risultato } from '@/domain/ricerca.ts'

/** Ricette per nome e ingredienti, le più pertinenti per prime (SPEC §23). */
export function cercaPiatti(piatti: RiepilogoPiatto[], testo: string, massimo = 5): Risultato<RiepilogoPiatto>[] {
  return cercaRicette(piatti, testo).slice(0, massimo)
}

/** «con zucchine, menta» sotto un piatto trovato per i suoi ingredienti. */
export function NotaIngredienti({ r }: { r: Risultato<RiepilogoPiatto> }) {
  return r.ingredientiTrovati.length ? <span className="block truncate text-xs text-testo-tenue">con {r.ingredientiTrovati.join(', ')}</span> : null
}

export function SuggerimentiPiatti({ testo, onScegli }: { testo: string; onScegli: (p: RiepilogoPiatto) => void }) {
  const piatti = usePiatti()
  const trovati = cercaPiatti(piatti.data ?? [], testo)
  if (trovati.length === 0) return null
  return (
    <ul role="listbox" aria-label="Piatti del ricettario" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-bordo bg-carta shadow-lg">
      <li className="px-3 pt-2 text-xs text-testo-tenue">Dal ricettario (tocca per collegare)</li>
      {trovati.map((r) => (
        <li key={r.ricetta.id}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-tenue"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onScegli(r.ricetta)}
          >
            <ChefHat className="size-4 shrink-0 text-successo" />
            <span className="min-w-0">
              {r.ricetta.nome}
              <NotaIngredienti r={r} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
