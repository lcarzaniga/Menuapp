// Blocco data degli eventi (restyling 2026): giorno della settimana, numero e mese, in rem perché
// segua la dimensione del testo. «evidenza» per il prossimo evento: pieno nel colore principale.
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
        'flex w-[3.75rem] shrink-0 flex-col items-center justify-center rounded-xl border py-1.5 text-center uppercase leading-none',
        evidenza ? 'border-transparent bg-primario text-primario-testo' : 'border-bordo bg-sfondo text-testo',
        className,
      )}
    >
      <span className="text-[0.6875rem] font-medium tracking-wider" aria-hidden>
        {p.giorno}
      </span>
      <span className="titolo my-0.5 text-[1.75rem] font-semibold leading-none tabular-nums" aria-hidden>
        {p.numero}
      </span>
      <span className="text-[0.6875rem] font-medium tracking-wider" aria-hidden>
        {p.mese}
      </span>
    </time>
  )
}
