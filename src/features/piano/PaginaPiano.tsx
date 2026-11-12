// Evento — Piano: attività per giorno e checklist (SPEC F6, §7.7).
import { Check, ChefHat, ListTodo, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { useAttivita, useMenu } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Campo, Input, Select, Textarea } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import { aggiungiGiorni, dataLunga, oggiISO, sottraiMinuti } from '@/domain/tempo.ts'
import type { Attivita, Evento } from '@/domain/tipi.ts'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { cn } from '@/lib/utils'

export function scelteRapide(e: Pick<Evento, 'data' | 'oraServizio'>): { etichetta: string; data: string; ora: string | null }[] {
  const s = [
    { etichetta: '2 giorni prima', data: aggiungiGiorni(e.data, -2), ora: null },
    { etichetta: 'Il giorno prima', data: aggiungiGiorni(e.data, -1), ora: null },
    { etichetta: 'La mattina', data: e.data, ora: '09:00' },
  ]
  if (e.oraServizio) s.push({ etichetta: 'Un\'ora prima del servizio', ...sottraiMinuti(e.data, e.oraServizio, 60) })
  return s
}

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
          <Button misura="piccolo" disabled={!puoScrivere} onClick={() => setAperta('nuova')}>
            <Plus /> Attività
          </Button>
        ) : null}
      </div>
      {attivita.length === 0 ? (
        <Vuoto icona={<ListTodo />} titolo="Nessuna attività" testo="Es. «Preparare il ragù» il giorno prima, «Apparecchiare» la mattina." />
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

export function ModuloAttivita({
  evento,
  attivita: a,
  voci,
  voceIniziale = null,
  onChiudi,
}: {
  evento: Evento
  attivita: Attivita | null
  voci: { id: string; nome: string }[]
  voceIniziale?: string | null
  onChiudi: () => void
}) {
  const [id] = useState(nuovoId)
  const puoScrivere = usePuoScrivere()
  const nomeVoce = voci.find((v) => v.id === voceIniziale)?.nome
  const [d, setD] = useState({
    titolo: a?.titolo ?? (nomeVoce ? `Preparare ${nomeVoce.charAt(0).toLowerCase()}${nomeVoce.slice(1)}` : ''),
    data: a?.data ?? aggiungiGiorni(evento.data, -1),
    ora: a?.ora ?? null,
    voceMenuId: a?.voceMenuId ?? voceIniziale,
    note: a?.note ?? '',
  })
  const salva = useScrittura(
    () => (a ? api.modifica(`/attivita/${a.id}`, { ...d, stato: a.stato, versione: a.versione }) : api.crea(`/eventi/${evento.id}/attivita`, { id, ...d })),
    { oggetto: 'L\'attività', dopo: onChiudi, successo: a ? 'Salvato' : 'Attività aggiunta' },
  )
  const ripristina = useScrittura((x: Attivita) => api.crea(`/eventi/${evento.id}/attivita`, { id: x.id, titolo: x.titolo, data: x.data, ora: x.ora, voceMenuId: x.voceMenuId, note: x.note }), {
    successo: 'Attività ripristinata',
  })
  const elimina = useScrittura(() => api.elimina(`/attivita/${a!.id}`, a!.versione), {
    successo: null,
    dopo: () => {
      onChiudi()
      toast(`«${a!.titolo}» eliminata`, { duration: 5000, action: { label: 'Annulla', onClick: () => void ripristina.esegui(a!) } })
    },
  })
  return (
    <Finestra aperta onCambia={(x) => !x && onChiudi()} titolo={a ? 'Attività' : 'Nuova attività'}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault()
          if (d.titolo.trim()) void salva.esegui(undefined)
        }}
      >
        <Campo etichetta="Cosa fare" htmlFor="at-titolo">
          <Input id="at-titolo" autoFocus={!a} value={d.titolo} onChange={(e) => setD({ ...d, titolo: e.target.value })} />
        </Campo>
        <div className="flex flex-wrap gap-1.5">
          {scelteRapide(evento).map((s) => (
            <button
              key={s.etichetta}
              type="button"
              className={cn('rounded-full border border-bordo px-3 py-1.5 text-sm', d.data === s.data && d.ora === s.ora && 'border-primario bg-primario-tenue text-primario')}
              onClick={() => setD({ ...d, data: s.data, ora: s.ora })}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Giorno" htmlFor="at-data">
            <Input id="at-data" type="date" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} />
          </Campo>
          <Campo etichetta="Ora (facoltativa)" htmlFor="at-ora">
            <Input id="at-ora" type="time" value={d.ora ?? ''} onChange={(e) => setD({ ...d, ora: e.target.value || null })} />
          </Campo>
        </div>
        <Campo etichetta="Piatto collegato" htmlFor="at-voce">
          <Select id="at-voce" value={d.voceMenuId ?? ''} onChange={(e) => setD({ ...d, voceMenuId: e.target.value || null })}>
            <option value="">Nessuno</option>
            {voci.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etichetta="Note" htmlFor="at-note">
          <Textarea id="at-note" className="min-h-16" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </Campo>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {a ? (
            <Button variante="fantasma" className="text-pericolo" disabled={!puoScrivere} onClick={() => void elimina.esegui(undefined)}>
              <Trash2 /> Elimina
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!d.titolo.trim() || !d.data || salva.inCorso || !puoScrivere}>
            Salva
          </Button>
        </div>
      </form>
    </Finestra>
  )
}
