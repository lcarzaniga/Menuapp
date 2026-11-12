// Suggerimenti dal ricettario durante l'inserimento rapido (SPEC F2.3): sceglierne uno
// collega la voce al piatto; ignorarli lascia la voce libera.
import { ChefHat } from 'lucide-react'
import { usePiatti } from '@/api/query'
import type { RiepilogoPiatto } from '@/contratto/ricettario.ts'
import { norm } from '@/domain/testo.ts'

export function cercaPiatti(piatti: RiepilogoPiatto[], testo: string, massimo = 5): RiepilogoPiatto[] {
  const q = norm(testo)
  if (q.length < 2) return []
  const inizio = piatti.filter((p) => norm(p.nome).startsWith(q))
  const dentro = piatti.filter((p) => !norm(p.nome).startsWith(q) && norm(p.nome).includes(q))
  return [...inizio, ...dentro].slice(0, massimo)
}

export function SuggerimentiPiatti({ testo, onScegli }: { testo: string; onScegli: (p: RiepilogoPiatto) => void }) {
  const piatti = usePiatti()
  const trovati = cercaPiatti(piatti.data ?? [], testo)
  if (trovati.length === 0) return null
  return (
    <ul role="listbox" aria-label="Piatti del ricettario" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-bordo bg-carta shadow-lg">
      <li className="px-3 pt-2 text-xs text-testo-tenue">Dal ricettario (tocca per collegare)</li>
      {trovati.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-tenue"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onScegli(p)}
          >
            <ChefHat className="size-4 text-successo" /> {p.nome}
          </button>
        </li>
      ))}
    </ul>
  )
}
