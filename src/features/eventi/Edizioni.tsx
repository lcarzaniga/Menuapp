// Duplica evento e ricorrenza dell'evento (SPEC §25, §28).
import { useQuery } from '@tanstack/react-query'
import { Copy, Repeat } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { Edizioni, EsitoDuplica, Ricorrenza } from '@/contratto/edizioni.ts'
import { dataBreve } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'

export const useEdizioni = (eventoId: string) =>
  useQuery({ queryKey: ['edizioni', eventoId], queryFn: () => api.leggi<Edizioni>(`/eventi/${eventoId}/edizioni`) })
export const useRicorrenze = (gruppoId: string | null) =>
  useQuery({ queryKey: ['ricorrenze', gruppoId], queryFn: () => api.leggi<Ricorrenza[]>(`/famiglie/${gruppoId}/ricorrenze`), enabled: Boolean(gruppoId) })

/** «Natale 2026» → «Natale 2027» quando la data passa all'anno dopo. */
export function nomeEdizione(nome: string, dataOrigine: string, dataNuova: string): string {
  const da = dataOrigine.slice(0, 4)
  const a = dataNuova.slice(0, 4)
  return da !== a && nome.includes(da) ? nome.replaceAll(da, a) : nome
}

/** Lo stesso giorno l'anno dopo (il 29 febbraio diventa il 28). */
const annoDopo = (data: string) => `${Number(data.slice(0, 4)) + 1}${data.slice(4) === '-02-29' ? '-02-28' : data.slice(4)}`

export function DuplicaEvento({ evento: e, onChiudi }: { evento: Evento; onChiudi: () => void }) {
  const naviga = useNavigate()
  const { famiglie } = useFamigliaAttiva()
  const famigliaEvento = useAccessoEvento(e.id).data?.gruppo?.id ?? null
  const iniziale = annoDopo(e.data)
  const [data, setData] = useState(iniziale)
  const [nome, setNome] = useState(nomeEdizione(e.nome, e.data, iniziale))
  const [nomeToccato, setNomeToccato] = useState(false)
  const [gruppoId, setGruppoId] = useState<string>(famigliaEvento && famiglie.some((f) => f.id === famigliaEvento) ? famigliaEvento : (famiglie[0]?.id ?? ''))
  const [partecipanti, setPartecipanti] = useState(false)
  const stessaFamiglia = (gruppoId || null) === famigliaEvento
  // Si propone la stessa ricorrenza dell'originale; cambiando Famiglia si sceglie fra le sue.
  const [ricorrenza, setRicorrenza] = useState(e.ricorrenzaId ?? '')
  const ricorrenze = useRicorrenze(gruppoId || null)
  const sceltaRicorrenza = ricorrenze.data ? (ricorrenze.data.some((x) => x.id === ricorrenza) ? ricorrenza : '') : stessaFamiglia ? ricorrenza : ''
  const duplica = useScrittura(
    () =>
      api.crea<EsitoDuplica>(`/eventi/${e.id}/duplica`, {
        id: nuovoId(),
        nome: nome.trim(),
        data,
        gruppoId: gruppoId || null,
        copiaPartecipanti: partecipanti,
        ricorrenzaId: sceltaRicorrenza || null,
      }),
    {
      successo: (r) => `Creato «${r.evento.nome}»`,
      dopo: (r) => {
        onChiudi()
        // Le cose da sapere (ricette non disponibili o ricreate) restano visibili un po' di più.
        for (const a of r.avvisi) toast.warning(a, { duration: 10_000 })
        naviga(`/eventi/${r.evento.id}`)
      },
    },
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Duplica evento"
      descrizione="Si copiano portate, menù, porzioni, stile di stampa e piano (da rifare). Non si copiano conferme, incarichi, voti, bacheca e spesa."
      piede={
        <Button disabled={!nome.trim() || !data || duplica.inCorso} onClick={() => void duplica.esegui(undefined)}>
          <Copy /> Duplica
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Nome del nuovo evento" htmlFor="dup-nome">
          <Input
            id="dup-nome"
            value={nome}
            maxLength={200}
            onChange={(ev) => {
              setNomeToccato(true)
              setNome(ev.target.value)
            }}
          />
        </Campo>
        <Campo etichetta="Data" htmlFor="dup-data">
          <Input
            id="dup-data"
            type="date"
            value={data}
            onChange={(ev) => {
              setData(ev.target.value)
              if (!nomeToccato && ev.target.value) setNome(nomeEdizione(e.nome, e.data, ev.target.value))
            }}
          />
        </Campo>
        {famiglie.length > 1 ? (
          <Campo etichetta="Famiglia" htmlFor="dup-famiglia">
            <Select id="dup-famiglia" value={gruppoId} onChange={(ev) => setGruppoId(ev.target.value)}>
              {famiglie.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </Campo>
        ) : null}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={partecipanti} onChange={(ev) => setPartecipanti(ev.target.checked)} /> Copia anche i partecipanti (da riconfermare)
        </label>
        {ricorrenze.data?.length ? (
          <Campo etichetta="Ricorrenza" htmlFor="dup-ricorrenza">
            <Select id="dup-ricorrenza" value={sceltaRicorrenza} onChange={(ev) => setRicorrenza(ev.target.value)}>
              <option value="">Nessuna</option>
              {ricorrenze.data.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </Select>
          </Campo>
        ) : null}
      </div>
    </Finestra>
  )
}

/** Ricorrenza dell'evento: sceglierla o toglierla, gli altri eventi della ricorrenza, il confronto. */
export function PannelloRicorrenza({ evento: e }: { evento: Evento }) {
  const q = useEdizioni(e.id)
  const puoScrivere = usePuoScrivere()
  const imposta = useScrittura((ricorrenzaId: string | null) => api.modifica<Edizioni>(`/eventi/${e.id}/ricorrenza`, { ricorrenzaId }), {
    successo: (r) => (r.ricorrenza ? `Ricorrenza: ${r.ricorrenza.nome}` : 'Ricorrenza tolta'),
  })
  const d = q.data
  if (!d || (!d.ricorrenza && !d.ricorrenze.length && !d.altriEventi.length)) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="size-4 text-primario" /> Ricorrenza
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {d.puoAssociare && d.ricorrenze.length ? (
          <Select
            aria-label="Ricorrenza dell'evento"
            value={d.ricorrenza?.id ?? ''}
            disabled={!puoScrivere || imposta.inCorso}
            onChange={(ev) => void imposta.esegui(ev.target.value || null)}
          >
            <option value="">Nessuna ricorrenza</option>
            {d.ricorrenze.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm">{d.ricorrenza ? d.ricorrenza.nome : 'Nessuna ricorrenza'}</p>
        )}
        {d.puoAssociare && !d.ricorrenze.length ? (
          <p className="text-xs text-testo-tenue">
            Le ricorrenze (Natale, un compleanno…) si creano in{' '}
            <Link to="/famiglia?scheda=membri" className="underline">
              Famiglia
            </Link>
            .
          </p>
        ) : null}
        {d.edizioni.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Altri eventi della ricorrenza">
            {d.edizioni.map((x) => (
              <li key={x.id}>
                <Link to={`/eventi/${x.id}`} className="text-primario underline-offset-2 hover:underline">
                  {x.nome}
                </Link>
                <span className="text-testo-tenue"> · {dataBreve(x.data)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {d.edizioni.length || d.altriEventi.length ? (
          <Button variante="contorno" misura="piccolo" className="self-start" asChild>
            <Link to={`/eventi/${e.id}/confronto`}>Confronta con l&apos;anno scorso</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
