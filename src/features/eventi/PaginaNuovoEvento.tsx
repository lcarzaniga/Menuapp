import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useImpostazioni } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { Caricamento, Pagina } from '@/components/Pagina'
import { aggiungiGiorni, oggiISO } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import { type DatiModuloEvento, ModuloEvento } from './ModuloEvento'

export function PaginaNuovoEvento() {
  const imp = useImpostazioni()
  const naviga = useNavigate()
  const [id] = useState(nuovoId)
  const [errori, setErrori] = useState<Record<string, string>>({})
  // L'evento nasce nella Famiglia attiva (il server verifica che l'utente ne faccia parte).
  const { attiva } = useFamigliaAttiva()
  const crea = useScrittura((d: DatiModuloEvento) => api.crea<Evento>('/eventi', { id, ...d, ...(attiva ? { gruppoId: attiva.id } : {}) }), {
    successo: 'Evento creato',
    dopo: (e) => naviga(`/eventi/${e.id}/menu`, { replace: true }),
    dopoErrore: (e) => setErrori(Object.fromEntries(e.campi.map((c) => [c.campo, c.messaggio]))),
  })
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
      <ModuloEvento iniziale={iniziale} etichetta="Crea e componi il menù" inCorso={crea.inCorso} errori={errori} onSalva={(d) => void crea.esegui(d)} />
    </Pagina>
  )
}
