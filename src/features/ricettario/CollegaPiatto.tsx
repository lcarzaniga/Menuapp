// Collegare una voce di menù al ricettario: piatto nuovo (solo su richiesta) o esistente (SPEC F3).
import { ChefHat, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useIncludiPubbliche, usePiatti } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Casella, Input } from '@/components/ui/campi'
import { usePuoScrivere } from '@/connessione/stato'
import { useAccessoEvento } from '@/features/accesso/sessione'
import type { VoceMenu } from '@/domain/tipi.ts'
import { cercaPiatti, NotaIngredienti, NotaPubblica } from './SuggerimentiPiatti'

export function CollegaPiatto({ voce, onCollega, onCreato }: { voce: VoceMenu; onCollega: (piattoId: string) => void; onCreato: () => void }) {
  const [cerca, setCerca] = useState('')
  // «Cerca anche nelle pubbliche» (D5): parte dalla preferenza del ricettario.
  const preferenza = useIncludiPubbliche()
  const [anchePubbliche, setAnchePubbliche] = useState<boolean | null>(null)
  const pubbliche = anchePubbliche ?? preferenza
  // Personali e della Famiglia dell'evento (SPEC §37).
  const piatti = usePiatti(pubbliche ? 'si' : 'no', useAccessoEvento(voce.eventoId).data?.gruppo?.id)
  const naviga = useNavigate()
  const puoScrivere = usePuoScrivere()
  const crea = useScrittura((piattoId: string) => api.crea<{ piatto: { id: string } }>(`/voci/${voce.id}/crea-piatto`, { piattoId, versione: voce.versione }), {
    oggetto: `«${voce.nome}»`,
    successo: 'Piatto creato nel ricettario',
    dopo: (r) => {
      onCreato()
      naviga(`/ricettario/${r.piatto.id}?modifica=1`)
    },
  })
  const trovati = cercaPiatti(piatti.data ?? [], cerca || voce.nome, 12)
    .sort((a, b) => Number(a.ricetta.soloPubblica) - Number(b.ricetta.soloPubblica))
    .slice(0, 6)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-testo-tenue">Nessuna ricetta collegata. La voce funziona anche così; una ricetta serve per la spesa e la vista cucina.</p>
      <Button variante="contorno" misura="piccolo" className="self-start" disabled={!puoScrivere || crea.inCorso} onClick={() => void crea.esegui(nuovoId())}>
        <Plus /> Crea «{voce.nome}» nel ricettario
      </Button>
      <Input aria-label="Cerca un piatto esistente" placeholder="…oppure cerca per nome o ingredienti" value={cerca} onChange={(e) => setCerca(e.target.value)} />
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <Casella checked={pubbliche} onChange={(e) => setAnchePubbliche(e.target.checked)} /> Cerca anche nelle ricette pubbliche
      </label>
      {trovati.length ? (
        <ul className="flex flex-col">
          {trovati.map((r) => (
            <li key={r.ricetta.id}>
              <button type="button" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-carta" onClick={() => onCollega(r.ricetta.id)}>
                <ChefHat className="size-4 shrink-0 text-successo" />
                <span className="min-w-0">
                  {r.ricetta.nome}
                  <NotaIngredienti r={r} />
                  <NotaPubblica piatto={r.ricetta} />
                </span>
                <span className="ml-auto text-xs text-testo-tenue">collega</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
