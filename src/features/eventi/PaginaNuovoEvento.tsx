import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useImpostazioni } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { Caricamento, Pagina } from '@/components/Pagina'
import { aggiungiGiorni, oggiISO } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import type { SceltaRicorrenza } from '@/contratto/eventi.ts'
import { useRicorrenze } from './Edizioni'
import { type DatiModuloEvento, ModuloEvento } from './ModuloEvento'

export function PaginaNuovoEvento() {
  const imp = useImpostazioni()
  const naviga = useNavigate()
  const [id] = useState(nuovoId)
  const [errori, setErrori] = useState<Record<string, string>>({})
  // L'evento nasce nella Famiglia attiva (il server verifica che l'utente ne faccia parte).
  const { attiva } = useFamigliaAttiva()
  const ricorrenze = useRicorrenze(attiva?.id ?? null)
  const crea = useScrittura(
    (x: { d: DatiModuloEvento; ricorrenza?: SceltaRicorrenza | null }) =>
      api.crea<Evento>('/eventi', { id, ...x.d, ...(attiva ? { gruppoId: attiva.id } : {}), ...(x.ricorrenza !== undefined ? { ricorrenza: x.ricorrenza } : {}) }),
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
      <ModuloEvento
        iniziale={iniziale}
        etichetta="Crea e componi il menù"
        inCorso={crea.inCorso}
        errori={errori}
        // Le ricorrenze valgono per gli eventi di una Famiglia (SPEC §28, §30).
        ricorrenze={attiva ? (ricorrenze.data ?? []).map((r) => ({ id: r.id, nome: r.nome })) : undefined}
        onSalva={(d, ricorrenza) => void crea.esegui({ d, ricorrenza })}
      />
    </Pagina>
  )
}
