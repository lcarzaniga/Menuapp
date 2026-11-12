// Portate dell'evento: rinomina, riordina, aggiunge, elimina se vuote (SPEC §7.8).
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { Menu } from '@/contratto/eventi.ts'
import type { Evento } from '@/domain/tipi.ts'

interface Riga {
  id: string
  nome: string
  voci: number
}

export function GestionePortate({ evento, menu, aperta, onCambia }: { evento: Evento; menu: Menu; aperta: boolean; onCambia: (a: boolean) => void }) {
  const [righe, setRighe] = useState<Riga[]>([])
  const puoScrivere = usePuoScrivere()
  useEffect(() => {
    if (aperta) setRighe(menu.portate.map((p) => ({ id: p.id, nome: p.nome, voci: p.voci.length })))
  }, [aperta, menu])
  const salva = useScrittura(
    (versione: number) =>
      api.modifica<Evento>(`/eventi/${evento.id}`, {
        nome: evento.nome,
        data: evento.data,
        oraServizio: evento.oraServizio,
        tipo: evento.tipo,
        occasione: evento.occasione,
        adulti: evento.adulti,
        bambini: evento.bambini,
        coefficienteBambini: evento.coefficienteBambini,
        note: evento.note,
        portate: righe.map((r) => ({ id: r.id, nome: r.nome.trim() })),
        versione,
      }),
    { oggetto: 'Le portate', successo: 'Portate aggiornate', dopo: () => onCambia(false) },
  )

  function sposta(i: number, delta: number) {
    const r = [...righe]
    const [x] = r.splice(i, 1)
    r.splice(i + delta, 0, x!)
    setRighe(r)
  }

  const valide = righe.length > 0 && righe.every((r) => r.nome.trim())
  return (
    <Finestra
      aperta={aperta}
      onCambia={onCambia}
      titolo="Portate"
      descrizione="Le modifiche valgono solo per questo evento. Una portata con piatti non si elimina: sposta prima i piatti."
      piede={
        <Button disabled={!valide || salva.inCorso || !puoScrivere} onClick={() => void salva.esegui(evento.versione)}>
          Salva portate
        </Button>
      }
    >
      <ul className="flex flex-col gap-2">
        {righe.map((r, i) => (
          <li key={r.id} className="flex items-center gap-1">
            <Input aria-label={`Nome portata ${i + 1}`} value={r.nome} onChange={(e) => setRighe(righe.map((x) => (x.id === r.id ? { ...x, nome: e.target.value } : x)))} />
            <Button variante="fantasma" misura="iconaPiccola" aria-label="Su" disabled={i === 0} onClick={() => sposta(i, -1)}>
              <ArrowUp />
            </Button>
            <Button variante="fantasma" misura="iconaPiccola" aria-label="Giù" disabled={i === righe.length - 1} onClick={() => sposta(i, 1)}>
              <ArrowDown />
            </Button>
            <Button
              variante="fantasma"
              misura="iconaPiccola"
              aria-label={r.voci > 0 ? `${r.nome}: contiene piatti` : `Elimina ${r.nome}`}
              disabled={r.voci > 0}
              onClick={() => setRighe(righe.filter((x) => x.id !== r.id))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <Button variante="contorno" misura="piccolo" className="mt-3" onClick={() => setRighe([...righe, { id: nuovoId(), nome: '', voci: 0 }])}>
        <Plus /> Aggiungi portata
      </Button>
    </Finestra>
  )
}
