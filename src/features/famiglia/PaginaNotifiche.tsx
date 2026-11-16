// Centro notifiche (SPEC §20.6): aggiornamenti raggruppati, apertura diretta, letture, preferenze.
import { useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Casella } from '@/components/ui/campi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NOMI_NOTIFICA, type Notifica, TIPI_NOTIFICA, type TipoNotifica } from '@/contratto/famiglia.ts'
import { cn } from '@/lib/utils'
import { chiaviFamiglia, quando, useNotifiche, usePreferenzeNotifiche } from './api'

export function PaginaNotifiche() {
  const n = useNotifiche()
  const naviga = useNavigate()
  const client = useQueryClient()
  const [preferenze, setPreferenze] = useState(false)
  const tutte = useScrittura(() => api.crea('/notifiche/lette', {}), { successo: 'Tutte lette' })
  const apri = async (x: Notifica) => {
    if (!x.letta) {
      await api.crea(`/notifiche/${x.id}/letta`, {}).catch(() => undefined)
      void client.invalidateQueries({ queryKey: chiaviFamiglia.notifiche })
    }
    naviga(x.collegamento)
  }
  const nonLette = n.data?.filter((x) => !x.letta).length ?? 0
  return (
    <Pagina
      titolo="Notifiche"
      azioni={
        <>
          <Button variante="contorno" misura="piccolo" disabled={!nonLette || tutte.inCorso} onClick={() => void tutte.esegui(undefined)}>
            <CheckCheck /> Tutte lette
          </Button>
          <Button variante="fantasma" misura="iconaPiccola" aria-label="Preferenze delle notifiche" aria-pressed={preferenze} onClick={() => setPreferenze(!preferenze)}>
            <BellOff />
          </Button>
        </>
      }
    >
      {preferenze ? <Preferenze /> : null}
      {n.isPending ? (
        <Caricamento />
      ) : !n.data?.length ? (
        <Vuoto icona={<Bell />} titolo="Nessuna notifica" testo="Qui trovi messaggi, sondaggi, proposte e incarichi che ti riguardano." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Elenco delle notifiche">
          {n.data.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => void apri(x)}
                className={cn('flex w-full items-start gap-3 rounded-2xl border p-3 text-left shadow-carta hover:bg-tenue/60', x.letta ? 'border-bordo/60 bg-carta/70' : 'border-primario/40 bg-carta')}
              >
                <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', x.letta ? 'bg-transparent' : 'bg-primario')} aria-label={x.letta ? undefined : 'da leggere'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-testo-tenue">{x.titolo}</span>
                  <span className={cn('block break-words', !x.letta && 'font-semibold')}>
                    {x.attore && x.tipo !== 'incarico' ? `${x.attore}: ` : ''}
                    {x.testo}
                  </span>
                  <span className="text-xs text-testo-tenue">
                    {quando(x.aggiornatoIl)}
                    {x.conteggio > 1 ? ` · ${x.conteggio} aggiornamenti` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}

function Preferenze() {
  const p = usePreferenzeNotifiche()
  const salva = useScrittura((disattivate: TipoNotifica[]) => api.modifica('/notifiche/preferenze', { disattivate }), { successo: 'Preferenze salvate' })
  if (!p.data) return <Caricamento />
  const spente = new Set(p.data.disattivate)
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Cosa voglio ricevere</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {TIPI_NOTIFICA.map((t) => (
          <label key={t} className="flex min-h-11 items-center gap-3 text-sm">
            <Casella
              checked={!spente.has(t)}
              onChange={(e) => {
                const n = new Set(spente)
                if (e.target.checked) n.delete(t)
                else n.add(t)
                void salva.esegui([...n])
              }}
            />
            {NOMI_NOTIFICA[t]}
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
