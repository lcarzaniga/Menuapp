// Stelle per un piatto servito (SPEC §20.7): compaiono a evento avvenuto, un voto per persona.
import { Star } from 'lucide-react'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import type { ValutazioniEvento } from '@/contratto/famiglia.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { cn } from '@/lib/utils'
import { useValutazioni } from './api'

export function ValutaVoce({ eventoId, voceId, nome }: { eventoId: string; voceId: string; nome: string }) {
  const v = useValutazioni(eventoId)
  const accesso = useAccessoEvento(eventoId)
  const connesso = useStatoConnessione() === 'connesso'
  const vota = useScrittura((stelle: number) => api.modifica<ValutazioniEvento>(`/voci/${voceId}/valutazione`, { stelle }), { successo: null })
  if (!v.data?.valutabile) return null
  const mia = v.data.voci.find((x) => x.voceId === voceId)
  const puoVotare = connesso && accesso.data?.partecipa !== false
  return (
    <div className="flex basis-full items-center gap-2 pb-2 pr-3 text-xs text-testo-tenue" role="group" aria-label={`Valuta ${nome}`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} ${i === 1 ? 'stella' : 'stelle'}`}
            aria-pressed={mia?.mie === i}
            disabled={!puoVotare || vota.inCorso}
            onClick={() => void vota.esegui(i)}
            className="flex size-8 items-center justify-center"
          >
            <Star className={cn('size-5', (mia?.mie ?? 0) >= i ? 'fill-oro text-oro' : 'text-bordo')} />
          </button>
        ))}
      </span>
      {mia ? (
        <span>
          media <strong className="text-testo">{mia.media?.toLocaleString('it-IT')}</strong> · {mia.numero} {mia.numero === 1 ? 'voto' : 'voti'}
        </span>
      ) : (
        <span>Com'era?</span>
      )}
    </div>
  )
}
