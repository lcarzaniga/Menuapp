// Evento — Panoramica: dati, coperti, stato e azioni (SPEC §5, F9).
import { CalendarCheck, Pencil, Printer, RotateCcw, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '@/api/client'
import { useAttivita, useMenu } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Conferma, Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import { copertiEquivalenti, formattaCoperti } from '@/domain/porzioni.ts'
import { daConcludere } from '@/domain/regole/evento.ts'
import { differenzaGiorni, oggiISO } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import { plurale } from '@/lib/formato'
import { PannelloArchivio } from '@/features/archivio/PannelloArchivio'
import { CorpoScheda, useEventoCorrente } from './LayoutEvento'
import { type DatiModuloEvento, ModuloEvento } from './ModuloEvento'

const NOMI_TIPO = { pranzo: 'Pranzo', cena: 'Cena', aperitivo: 'Aperitivo', brunch: 'Brunch' } as const

export function PaginaPanoramica() {
  const e = useEventoCorrente()
  const menu = useMenu(e.id)
  const naviga = useNavigate()
  const puoScrivere = usePuoScrivere()
  const [modifica, setModifica] = useState(false)
  const [elimina, setElimina] = useState(false)
  const [spostamento, setSpostamento] = useState(0)
  const attivita = useAttivita(e.id)
  const archiviato = e.stato === 'archiviato'

  const salva = useScrittura(
    (d: DatiModuloEvento & { versione: number }) =>
      api.modifica<Evento>(`/eventi/${e.id}`, { ...d, portate: e.portate.map((p) => ({ id: p.id, nome: p.nome })) }),
    {
      oggetto: 'L\'evento',
      dopo: (nuovo) => {
        setModifica(false)
        const giorni = differenzaGiorni(e.data, nuovo.data)
        if (giorni !== 0 && (attivita.data?.length ?? 0) > 0) setSpostamento(giorni)
      },
      sovrascrivi: (d, attuale) => ({ ...d, versione: (attuale as Evento).versione }),
    },
  )
  const stato = useScrittura((azione: 'concludi' | 'riapri') => api.crea<Evento>(`/eventi/${e.id}/${azione}`, { versione: e.versione }), {
    oggetto: 'L\'evento',
    successo: (r) => (r.stato === 'concluso' ? 'Evento concluso' : 'Evento riaperto'),
  })
  const cancella = useScrittura(() => api.elimina(`/eventi/${e.id}`, e.versione), {
    oggetto: 'L\'evento',
    successo: 'Evento eliminato',
    dopo: () => naviga('/', { replace: true }),
  })

  const sposta = useScrittura((giorni: number) => api.crea(`/eventi/${e.id}/attivita/sposta`, { giorni }), { successo: 'Attività spostate' })
  const voci = menu.data?.portate.reduce((n, p) => n + p.voci.length, 0) ?? 0
  const coperti = copertiEquivalenti(e)
  return (
    <CorpoScheda>
      <div className="flex flex-col gap-4">
        {daConcludere(e, oggiISO()) ? (
          <Card className="border-avviso/40 bg-avviso-tenue">
            <CardContent className="flex flex-wrap items-center gap-3 pt-4 text-sm text-avviso">
              <p className="flex-1">La data è passata. Vuoi segnare l'evento come concluso?</p>
              <Button misura="piccolo" variante="contorno" disabled={!puoScrivere} onClick={() => void stato.esegui('concludi')}>
                <CalendarCheck /> Segna concluso
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="pt-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-testo-tenue">Tipo</dt>
              <dd>
                {NOMI_TIPO[e.tipo]}
                {e.occasione ? ` · ${e.occasione}` : ''}
              </dd>
              <dt className="text-testo-tenue">Persone</dt>
              <dd>
                {plurale(e.adulti, 'adulto', 'adulti')}, {plurale(e.bambini, 'bambino', 'bambini')}
                {e.bambini > 0 ? <span className="text-testo-tenue"> (contano {new Intl.NumberFormat('it-IT').format(e.coefficienteBambini)})</span> : null}
              </dd>
              <dt className="text-testo-tenue">Coperti</dt>
              <dd className="flex items-center gap-1.5 font-semibold text-primario">
                <Users className="size-4" /> {formattaCoperti(coperti)} equivalenti
              </dd>
              <dt className="text-testo-tenue">Menù</dt>
              <dd>
                <Link to={`/eventi/${e.id}/menu`} className="text-primario underline-offset-2 hover:underline">
                  {plurale(voci, 'voce', 'voci')} in {plurale(e.portate.length, 'portata', 'portate')}
                </Link>
              </dd>
              {e.note ? (
                <>
                  <dt className="text-testo-tenue">Note</dt>
                  <dd className="whitespace-pre-line">{e.note}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {!archiviato ? (
            <Button variante="contorno" disabled={!puoScrivere} onClick={() => setModifica(true)}>
              <Pencil /> Modifica
            </Button>
          ) : null}
          <Button variante="contorno" asChild>
            <Link to={`/eventi/${e.id}/stampa`}>
              <Printer /> Stampa menù
            </Link>
          </Button>
          {e.stato === 'attivo' ? (
            <Button variante="contorno" disabled={!puoScrivere} onClick={() => void stato.esegui('concludi')}>
              <CalendarCheck /> Concludi
            </Button>
          ) : null}
          {e.stato === 'concluso' ? (
            <Button variante="contorno" disabled={!puoScrivere} onClick={() => void stato.esegui('riapri')}>
              <RotateCcw /> Riapri
            </Button>
          ) : null}
          <Button variante="fantasma" className="text-pericolo" disabled={!puoScrivere} onClick={() => setElimina(true)}>
            <Trash2 /> Elimina
          </Button>
        </div>

        <PannelloArchivio evento={e} />
      </div>

      <Finestra aperta={modifica} onCambia={setModifica} titolo="Modifica evento">
        <ModuloEvento
          iniziale={{
            nome: e.nome,
            data: e.data,
            oraServizio: e.oraServizio,
            tipo: e.tipo,
            occasione: e.occasione,
            adulti: e.adulti,
            bambini: e.bambini,
            coefficienteBambini: e.coefficienteBambini,
            note: e.note,
          }}
          etichetta="Salva"
          inCorso={salva.inCorso}
          onSalva={(d) => void salva.esegui({ ...d, versione: e.versione })}
        />
      </Finestra>
      <Conferma
        aperta={spostamento !== 0}
        onCambia={(a) => !a && setSpostamento(0)}
        titolo="Spostare anche le attività?"
        descrizione={`La data dell'evento è cambiata di ${Math.abs(spostamento)} giorni. Spostare tutte le attività del piano di ${spostamento > 0 ? '+' : '−'}${Math.abs(spostamento)} giorni?`}
        etichettaConferma="Sposta le attività"
        onConferma={() => void sposta.esegui(spostamento)}
      />
      <Conferma
        aperta={elimina}
        onCambia={setElimina}
        pericolosa
        titolo={`Eliminare «${e.nome}»?`}
        descrizione="Saranno eliminati anche menù, spesa, attività e versioni archiviate dell'evento. I piatti del ricettario restano. L'operazione non si può annullare (resta solo nei backup)."
        etichettaConferma="Elimina evento"
        onConferma={() => void cancella.esegui(undefined)}
      />
    </CorpoScheda>
  )
}
