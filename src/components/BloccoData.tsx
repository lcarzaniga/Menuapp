// Blocco data degli eventi (restyling 2026): giorno della settimana, numero e mese, in rem perché
// segua la dimensione del testo, con un tetto perché a 360 px e testo grande lasci spazio al titolo.
// «evidenza» per il prossimo evento: pieno nel colore principale.
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
        // In evidenza: pieno nel colore principale, con un filo d'oro antico all'interno.
        evidenza ? 'border-transparent bg-primario text-primario-testo ring-1 ring-inset ring-oro/70 ring-offset-0 shadow-[inset_0_0_0_3px_var(--primario)]' : 'border-bordo bg-sfondo text-testo',
        className,
      )}
    >
      <span className="text-[min(0.6875rem,13px)] font-medium tracking-wider" aria-hidden>
        {p.giorno}
      </span>
      <span className="titolo my-0.5 text-[min(1.75rem,34px)] font-semibold leading-none tabular-nums" aria-hidden>
        {p.numero}
      </span>
      <span className="text-[min(0.6875rem,13px)] font-medium tracking-wider" aria-hidden>
        {p.mese}
      </span>
    </time>
  )
}
