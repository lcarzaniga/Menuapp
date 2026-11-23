// Blocco data degli eventi (restyling 2026), come un foglio di calendario da tavolo: fascia del mese in
// terracotta con due anelli di rilegatura, numero grande in terracotta, giorno della settimana in oro
// scuro; angoli vivi, bordo e ombra netta a destra e in basso per il rilievo. In rem perché segua la
// dimensione del testo, con un tetto perché a 360 px e testo grande lasci spazio al titolo.
// «evidenza» (prossimo evento): l'oro più intenso.
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
        'relative flex w-[min(3.75rem,72px)] shrink-0 flex-col items-stretch rounded-none border-r-2 border-b-2 text-center uppercase leading-none',
        // Tonalità dell'oro: più intensa per il prossimo evento, chiara per gli altri.
        evidenza ? 'border-oro bg-oro-medio shadow-[3px_3px_0_rgb(0_0_0/0.12)]' : 'border-oro/50 bg-oro-tenue shadow-[2px_2px_0_rgb(0_0_0/0.08)]',
        className,
      )}
    >
      {/* Anelli di rilegatura sul bordo superiore. */}
      <span className="absolute -top-1 left-[22%] size-2 rounded-full border border-oro-forte/70 bg-oro-tenue" aria-hidden />
      <span className="absolute -top-1 right-[22%] size-2 rounded-full border border-oro-forte/70 bg-oro-tenue" aria-hidden />
      {/* Fascia del mese: testo chiaro sul terracotta (scuro nel tema scuro), ≥ 4,5:1. */}
      <span className="bg-accento-caldo pt-1.5 pb-1 text-[min(0.6875rem,13px)] font-semibold tracking-wider text-carta dark:text-sfondo" aria-hidden>
        {p.mese}
      </span>
      <span className="titolo pt-1.5 text-[min(1.75rem,34px)] font-bold leading-none tabular-nums text-accento-caldo" aria-hidden>
        {p.numero}
      </span>
      <span className="pt-0.5 pb-1.5 text-[min(0.6875rem,13px)] font-medium tracking-wider text-oro-forte" aria-hidden>
        {p.giorno}
      </span>
    </time>
  )
}
