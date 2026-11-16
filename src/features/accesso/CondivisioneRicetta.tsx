// Ricette: condivisione in sola lettura e copia indipendente nel proprio ricettario (SPEC §19.4).
import { Copy, Lock, Share2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Casella } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import type { DettaglioPiatto } from '@/contratto/ricettario.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { usePersone } from './sessione'

/**
 * Con chi è condivisa la ricetta (per il proprietario): una o più delle sue Famiglie, oppure
 * nessuna (privata). Una privata si può condividere con persone scelte.
 */
export function VisibilitaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const connesso = useStatoConnessione() === 'connesso'
  const { famiglie } = useFamigliaAttiva()
  const imposta = useScrittura((gruppi: string[]) => api.modifica<DettaglioPiatto>(`/piatti/${piatto.id}/famiglie`, { gruppi }), {
    successo: (p) => (p.famiglie.length ? `Condivisa con ${p.famiglie.map((f) => f.nome).join(', ')}` : 'Ricetta privata: la vedi solo tu'),
  })
  const condivisa = new Set(piatto.famiglie.map((f) => f.id))
  const privata = condivisa.size === 0
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-bordo/70 bg-carta px-3 py-2 text-sm" data-testid="visibilita-ricetta">
      <div className="flex flex-wrap items-center gap-2">
        {privata ? <Lock className="size-4 text-testo-tenue" /> : <UsersRound className="size-4 text-primario" />}
        <span className="flex-1">
          {privata
            ? piatto.condivisaCon.length
              ? `Privata, condivisa con ${piatto.condivisaCon.map((p) => p.nome).join(', ')}`
              : 'Privata: la vedi solo tu'
            : `Condivisa con ${piatto.famiglie.map((f) => f.nome).join(', ')}: la vedono e possono copiarla`}
        </span>
        {privata ? <CondividiRicetta piatto={piatto} /> : null}
        {famiglie.length === 1 ? (
          <Button variante="fantasma" misura="piccolo" disabled={!connesso || imposta.inCorso} onClick={() => void imposta.esegui(privata ? [famiglie[0]!.id] : [])}>
            {privata ? `Condividi con ${famiglie[0]!.nome}` : 'Rendi privata'}
          </Button>
        ) : null}
      </div>
      {famiglie.length >= 2 ? (
        <div role="group" aria-label="Famiglie con cui è condivisa" className="flex flex-wrap gap-x-4">
          {famiglie.map((f) => (
            <label key={f.id} className="flex min-h-10 items-center gap-2">
              <Casella
                checked={condivisa.has(f.id)}
                disabled={!connesso || imposta.inCorso}
                onChange={(e) => {
                  const n = new Set(condivisa)
                  if (e.target.checked) n.add(f.id)
                  else n.delete(f.id)
                  void imposta.esegui([...n])
                }}
              />
              {f.nome}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function CondividiRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const [aperta, setAperta] = useState(false)
  const connesso = useStatoConnessione() === 'connesso'
  return (
    <>
      <Button variante="contorno" misura="piccolo" disabled={!connesso} onClick={() => setAperta(true)}>
        <Share2 /> {piatto.condivisaCon.length ? `Condivisa con ${piatto.condivisaCon.length}` : 'Condividi con…'}
      </Button>
      {aperta ? <FinestraCondivisione piatto={piatto} onChiudi={() => setAperta(false)} /> : null}
    </>
  )
}

function FinestraCondivisione({ piatto, onChiudi }: { piatto: DettaglioPiatto; onChiudi: () => void }) {
  const persone = usePersone()
  const [scelti, setScelti] = useState(() => new Set(piatto.condivisaCon.map((p) => p.id)))
  const salva = useScrittura(() => api.modifica(`/piatti/${piatto.id}/condivisioni`, { utenti: [...scelti] }), { successo: 'Condivisione aggiornata', dopo: onChiudi })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Condividi «${piatto.nome}»`}
      descrizione="La ricetta resta privata, ma le persone scelte la vedono e possono copiarla nel loro ricettario. Le copie sono indipendenti: le tue modifiche non le cambiano."
      piede={
        <Button disabled={salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      {persone.data?.length ? (
        <ul className="flex flex-col gap-1">
          {persone.data.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-tenue">
                <Casella
                  checked={scelti.has(p.id)}
                  onChange={(e) => {
                    const n = new Set(scelti)
                    if (e.target.checked) n.add(p.id)
                    else n.delete(p.id)
                    setScelti(n)
                  }}
                />
                {p.nome}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-testo-tenue">Non ci sono altre persone con un account.</p>
      )}
    </Finestra>
  )
}

export function CopiaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const naviga = useNavigate()
  const connesso = useStatoConnessione() === 'connesso'
  const copia = useScrittura(() => api.crea<DettaglioPiatto>(`/piatti/${piatto.id}/copia`, { id: nuovoId() }), {
    successo: 'Copiata nel tuo ricettario',
    dopo: (c) => naviga(`/ricettario/${c.id}`),
  })
  return (
    <Button misura="piccolo" disabled={!connesso || copia.inCorso} onClick={() => void copia.esegui(undefined)}>
      <Copy /> Copia nel mio ricettario
    </Button>
  )
}
