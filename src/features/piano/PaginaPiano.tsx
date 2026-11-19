// Evento — Piano: attività per giorno e checklist (SPEC F6, §7.7).
import { Check, ChefHat, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { useAttivita, useMenu } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { usePuoScrivere } from '@/connessione/stato'
import { dataLunga, oggiISO } from '@/domain/tempo.ts'
import type { Attivita } from '@/domain/tipi.ts'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { ModuloAttivita } from './ModuloAttivita'
import { cn } from '@/lib/utils'

function inRitardo(a: Attivita, oggi: string, ora: string): boolean {
  if (a.stato === 'fatto') return false
  if (a.data < oggi) return true
  return a.data === oggi && a.ora !== null && a.ora < ora
}

export function PaginaPiano() {
  const e = useEventoCorrente()
  const q = useAttivita(e.id)
  const menu = useMenu(e.id)
  const puoScrivere = usePuoScrivere()
  const [aperta, setAperta] = useState<Attivita | 'nuova' | null>(null)
  const [{ oggi, adesso }] = useState(() => ({ oggi: oggiISO(), adesso: new Date().toTimeString().slice(0, 5) }))
  const solaLettura = e.stato === 'archiviato'
  const cambia = useScrittura(
    (a: Attivita) => api.modifica(`/attivita/${a.id}`, { titolo: a.titolo, data: a.data, ora: a.ora, voceMenuId: a.voceMenuId, note: a.note, stato: a.stato === 'fatto' ? 'da_fare' : 'fatto', versione: a.versione }),
    { successo: null, oggetto: 'L\'attività' },
  )
  if (q.isPending) return <Caricamento />
  const attivita = q.data ?? []
  const voci = menu.data?.portate.flatMap((p) => p.voci) ?? []
  const nomiVoci = new Map(voci.map((v) => [v.id, v.nome]))
  const giorni = [...new Set(attivita.map((a) => a.data))]
  const fatte = attivita.filter((a) => a.stato === 'fatto').length

  return (
    <CorpoScheda>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-testo-tenue">{attivita.length ? `${fatte} di ${attivita.length} fatte` : 'Pianifica le preparazioni dei giorni prima.'}</p>
        {!solaLettura ? (
          <div className="flex flex-wrap justify-end gap-2">
            {/* Il giorno dell'evento: cosa fare adesso, dopo, in ritardo (SPEC §38). */}
            <Button asChild variante="contorno" misura="piccolo">
              <Link to={`/eventi/${e.id}/regia`}>
                <ChefHat /> Regia della cucina
              </Link>
            </Button>
            <Button misura="piccolo" disabled={!puoScrivere} onClick={() => setAperta('nuova')}>
              <Plus /> Attività
            </Button>
          </div>
        ) : null}
      </div>
      {attivita.length === 0 ? (
        <Vuoto illustrazione="taccuino" titolo="Nessuna attività" testo="Es. «Preparare il ragù» il giorno prima, «Apparecchiare» la mattina." />
      ) : (
        <div className="flex flex-col gap-5">
          {giorni.map((g) => (
            <section key={g}>
              <h2 className={cn('mb-1.5 text-sm font-semibold first-letter:uppercase', g === e.data ? 'text-primario' : 'text-testo-tenue')}>
                {dataLunga(g)}
                {g === e.data ? ' · giorno dell\'evento' : ''}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {attivita
                  .filter((a) => a.data === g)
                  .map((a) => {
                    const fatta = a.stato === 'fatto'
                    const ritardo = inRitardo(a, oggi, adesso)
                    return (
                      <li key={a.id} className={cn('flex items-center gap-1 rounded-xl border bg-carta pl-1', ritardo ? 'border-pericolo/50' : 'border-bordo')}>
                        <button
                          type="button"
                          disabled={solaLettura || !puoScrivere}
                          aria-label={fatta ? `${a.titolo}: da fare` : `${a.titolo}: fatto`}
                          aria-pressed={fatta}
                          onClick={() => void cambia.esegui(a)}
                          className="flex size-12 shrink-0 items-center justify-center disabled:opacity-50"
                        >
                          <span className={cn('flex size-7 items-center justify-center rounded-full border-2', fatta ? 'border-successo bg-successo text-white' : 'border-bordo')}>
                            {fatta ? <Check className="size-4" /> : null}
                          </span>
                        </button>
                        <button type="button" disabled={solaLettura} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-1.5 pr-3 text-left" onClick={() => setAperta(a)}>
                          <span className={cn(fatta && 'text-testo-tenue line-through')}>
                            {a.ora ? <strong className="mr-1 tabular-nums">{a.ora}</strong> : null}
                            {a.titolo}
                          </span>
                          <span className="flex flex-wrap items-center gap-2 text-xs text-testo-tenue">
                            {ritardo ? <span className="text-pericolo">in ritardo</span> : null}
                            {a.voceMenuId ? (
                              <span className="flex items-center gap-1">
                                <ChefHat className="size-3" /> {nomiVoci.get(a.voceMenuId) ?? 'voce del menù'}
                              </span>
                            ) : null}
                            {a.note ? <span>{a.note}</span> : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {aperta ? <ModuloAttivita evento={e} attivita={aperta === 'nuova' ? null : aperta} voci={voci} onChiudi={() => setAperta(null)} /> : null}
    </CorpoScheda>
  )
}
