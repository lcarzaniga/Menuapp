// Ricette: condivisione in sola lettura e copia indipendente nel proprio ricettario (SPEC §15.4).
import { Copy, Share2 } from 'lucide-react'
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
      descrizione="Le persone scelte vedono la ricetta e possono copiarla nel loro ricettario. Le copie sono indipendenti: le tue modifiche non le cambiano."
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
