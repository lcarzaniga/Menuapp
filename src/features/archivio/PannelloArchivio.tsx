// Archiviazione, riapertura, versioni archiviate e «Copia nel ricettario» (SPEC §7.3–7.4, F9).
import { Archive, BookPlus, History, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useRiapertura, useSnapshot } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Conferma } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { Evento } from '@/domain/tipi.ts'
import { dataOra } from '@/lib/formato'

export function PannelloArchivio({ evento: e }: { evento: Evento }) {
  const archiviato = e.stato === 'archiviato'
  const snapshot = useSnapshot(e.id)
  const [archivia, setArchivia] = useState(false)
  const [riapri, setRiapri] = useState(false)
  const riapertura = useRiapertura(e.id, archiviato && riapri)
  const puoScrivere = usePuoScrivere()
  const naviga = useNavigate()
  const esegui = useScrittura((azione: 'archivia' | 'riapri') => api.crea<Evento>(`/eventi/${e.id}/${azione}`, { versione: e.versione }), {
    oggetto: 'L\'evento',
    successo: (r) => (r.stato === 'archiviato' ? 'Evento archiviato' : 'Evento riaperto con le ricette attuali'),
  })
  const copia = useScrittura((d: { snapshotId: string; piattoId: string }) => api.crea<{ id: string }>(`/snapshot/${d.snapshotId}/copia-piatto`, { piattoId: d.piattoId, nuovoId: nuovoId() }), {
    successo: 'Ricetta copiata nel ricettario',
    dopo: (p) => naviga(`/ricettario/${p.id}`),
  })
  const valido = snapshot.data?.find((s) => s.stato === 'valido')
  const superati = snapshot.data?.filter((s) => s.stato === 'superato') ?? []

  return (
    <>
      {archiviato && valido ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="size-4" /> Archiviato il {dataOra(valido.creatoIl)}
            </CardTitle>
            <p className="text-sm text-testo-tenue">Menù, ricette, spesa e piano sono mostrati come erano al momento dell'archiviazione.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {valido.contenuto.piatti.length ? (
              <>
                <p className="text-sm font-medium">Ricette dell'evento</p>
                <ul className="flex flex-col gap-1">
                  {valido.contenuto.piatti.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{p.nome}</span>
                      <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => void copia.esegui({ snapshotId: valido.id, piattoId: p.id })}>
                        <BookPlus /> Copia nel ricettario
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <Button variante="contorno" className="mt-2 self-start" disabled={!puoScrivere} onClick={() => setRiapri(true)}>
              <RotateCcw /> Riapri l'evento
            </Button>
          </CardContent>
        </Card>
      ) : !archiviato ? (
        <Button variante="fantasma" className="self-start" disabled={!puoScrivere} onClick={() => setArchivia(true)}>
          <Archive /> Archivia
        </Button>
      ) : null}

      {superati.length ? (
        <details className="rounded-xl border border-bordo bg-carta px-4 py-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <History className="size-4" /> Versioni archiviate precedenti ({superati.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {superati.map((s) => (
              <li key={s.id} className="rounded-lg bg-tenue p-2">
                <p className="font-medium">Archiviata il {dataOra(s.creatoIl)}</p>
                <p className="text-testo-tenue">{s.contenuto.menu.flatMap((p) => p.voci.map((v) => v.nome)).join(' · ') || 'menù vuoto'}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Conferma
        aperta={archivia}
        onCambia={setArchivia}
        titolo={`Archiviare «${e.nome}»?`}
        descrizione="Menù, ricette usate, spesa e piano vengono salvati come sono ora; l'evento diventa di sola lettura. Potrai riaprirlo in seguito."
        etichettaConferma="Archivia"
        onConferma={() => void esegui.esegui('archivia')}
      />
      <Conferma
        aperta={riapri}
        onCambia={setRiapri}
        titolo="Riaprire l'evento?"
        descrizione="L'evento tornerà modificabile e userà le ricette attuali del ricettario. La versione archiviata resta consultabile nello storico."
        etichettaConferma="Riapri"
        onConferma={() => void esegui.esegui('riapri')}
      >
        {riapertura.data?.piattiCambiati.length ? (
          <div className="mt-3 rounded-xl bg-avviso-tenue p-3 text-sm text-avviso">
            <p className="font-medium">Ricette cambiate dopo l'archiviazione:</p>
            <ul className="mt-1 list-disc pl-5">
              {riapertura.data.piattiCambiati.map((p) => (
                <li key={p.dishId}>
                  {p.nome} — {p.esito === 'eliminato' ? 'eliminata dal ricettario' : 'modificata'}
                </li>
              ))}
            </ul>
            <p className="mt-1">Per recuperare la versione archiviata usa «Copia nel ricettario» prima di riaprire.</p>
          </div>
        ) : null}
      </Conferma>
    </>
  )
}
