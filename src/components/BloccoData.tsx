// Blocco data degli eventi (restyling 2026): giorno della settimana, numero e mese, in rem perché
// segua la dimensione del testo, con un tetto perché a 360 px e testo grande lasci spazio al titolo.
// Terracotta su oro: «evidenza» (prossimo evento) con l'oro più intenso.
import { cn } from '@/lib/utils'
import { type DataISO, dataLunga, partiData } from '@/domain/tempo.ts'

export function BloccoData({ data, evidenza = false, className }: { data: DataISO; evidenza?: boolean; className?: string }) {
  const p = partiData(data)
  if (!p) return null
  return (
    <time
      dateTime={data}
      aria-label={dataLunga(data)}
      className={cn(
        'flex w-[min(3.75rem,72px)] shrink-0 flex-col items-center justify-center rounded-xl border py-1.5 text-center uppercase leading-none',
        // Tonalità dell'oro: più intensa per il prossimo evento, chiara per gli altri.
        evidenza ? 'border-oro bg-oro-medio' : 'border-oro/50 bg-oro-tenue',
        className,
      )}
    >
      {/* Giorno e mese in oro scuro (testo piccolo, ≥ 4,5:1); il numero in terracotta. */}
      <span className="text-[min(0.6875rem,13px)] font-medium tracking-wider text-oro-forte" aria-hidden>
        {p.giorno}
      </span>
      <span className="titolo my-0.5 text-[min(1.75rem,34px)] font-semibold leading-none tabular-nums text-accento-caldo" aria-hidden>
        {p.numero}
      </span>
      <span className="text-[min(0.6875rem,13px)] font-medium tracking-wider text-oro-forte" aria-hidden>
        {p.mese}
      </span>
    </time>
  )
}
