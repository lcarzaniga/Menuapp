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
import { usePersone } from './sessione'

/**
 * Visibilità per il proprietario: di famiglia (tutti la vedono) o privata; una privata si può
 * condividere con persone scelte.
 */
export function VisibilitaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const connesso = useStatoConnessione() === 'connesso'
  const cambia = useScrittura((visibilita: 'famiglia' | 'privata') => api.modifica<DettaglioPiatto>(`/piatti/${piatto.id}/visibilita`, { visibilita }), {
    successo: (p) => (p.visibilita === 'privata' ? 'Ricetta privata: la vedi solo tu' : 'Ricetta visibile a tutta la famiglia'),
  })
  const privata = piatto.visibilita === 'privata'
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-bordo/70 bg-carta px-3 py-2 text-sm" data-testid="visibilita-ricetta">
      {privata ? <Lock className="size-4 text-testo-tenue" /> : <UsersRound className="size-4 text-primario" />}
      <span className="flex-1">
        {privata
          ? piatto.condivisaCon.length
            ? `Privata, condivisa con ${piatto.condivisaCon.map((p) => p.nome).join(', ')}`
            : 'Privata: la vedi solo tu'
          : 'Nel ricettario di famiglia: tutti la vedono e possono copiarla'}
      </span>
      {privata ? <CondividiRicetta piatto={piatto} /> : null}
      <Button variante="fantasma" misura="piccolo" disabled={!connesso || cambia.inCorso} onClick={() => void cambia.esegui(privata ? 'famiglia' : 'privata')}>
        {privata ? 'Rendi visibile a tutti' : 'Rendi privata'}
      </Button>
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
