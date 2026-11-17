import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useImpostazioni, useRicorrenze } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { Caricamento, Pagina } from '@/components/Pagina'
import { Campo, Select } from '@/components/ui/campi'
import { aggiungiGiorni, oggiISO } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import type { SceltaRicorrenza } from '@/contratto/eventi.ts'
import { type DatiModuloEvento, ModuloEvento } from './ModuloEvento'

export function PaginaNuovoEvento() {
  const imp = useImpostazioni()
  const naviga = useNavigate()
  const [id] = useState(nuovoId)
  const [errori, setErrori] = useState<Record<string, string>>({})
  // L'evento nasce nella Famiglia attiva, ma con più Famiglie la si vede e si può cambiare:
  // niente eventi creati per sbaglio altrove (SPEC §31.1; il server verifica l'appartenenza).
  const { attiva, famiglie, multiple } = useFamigliaAttiva()
  const [scelta, setScelta] = useState<string | null>(null)
  const gruppoId = scelta ?? attiva?.id ?? null
  const ricorrenze = useRicorrenze(gruppoId)
  const crea = useScrittura(
    (x: { d: DatiModuloEvento; ricorrenza?: SceltaRicorrenza | null }) =>
      api.crea<Evento>('/eventi', { id, ...x.d, ...(gruppoId ? { gruppoId } : {}), ...(x.ricorrenza !== undefined ? { ricorrenza: x.ricorrenza } : {}) }),
    {
    successo: 'Evento creato',
    dopo: (e) => naviga(`/eventi/${e.id}/menu`, { replace: true }),
    dopoErrore: (e) => setErrori(Object.fromEntries(e.campi.map((c) => [c.campo, c.messaggio]))),
    },
  )
  if (!imp.data) return <Caricamento />
  const iniziale: DatiModuloEvento = {
    nome: '',
    data: aggiungiGiorni(oggiISO(), 7),
    oraServizio: '13:00',
    tipo: 'pranzo',
    occasione: '',
    adulti: 4,
    bambini: 0,
    coefficienteBambini: imp.data.coefficienteBambini,
    note: '',
  }
  return (
    <Pagina titolo="Nuovo evento" indietro="/">
      {multiple ? (
        <Campo etichetta="Famiglia" htmlFor="ev-famiglia" aiuto="Chi ne fa parte potrà ritrovarlo; puoi spostarlo in seguito." className="mb-4">
          <Select id="ev-famiglia" value={gruppoId ?? ''} onChange={(ev) => setScelta(ev.target.value)}>
            {famiglie.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </Campo>
      ) : null}
      <ModuloEvento
        iniziale={iniziale}
        etichetta="Crea e componi il menù"
        inCorso={crea.inCorso}
        errori={errori}
        // Le ricorrenze valgono per gli eventi di una Famiglia (SPEC §28, §30).
        ricorrenze={gruppoId ? (ricorrenze.data ?? []).map((r) => ({ id: r.id, nome: r.nome })) : undefined}
        onSalva={(d, ricorrenza) => void crea.esegui({ d, ricorrenza })}
      />
    </Pagina>
  )
}
