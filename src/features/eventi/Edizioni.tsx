// Duplica evento ed edizioni di una ricorrenza (SPEC §25).
import { useQuery } from '@tanstack/react-query'
import { Copy, Link2, Unlink } from 'lucide-react'
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
import type { Edizioni, EsitoDuplica } from '@/contratto/edizioni.ts'
import { dataBreve } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'

export const useEdizioni = (eventoId: string) =>
  useQuery({ queryKey: ['edizioni', eventoId], queryFn: () => api.leggi<Edizioni>(`/eventi/${eventoId}/edizioni`) })

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
  const [collega, setCollega] = useState(true)
  const duplica = useScrittura(
    () =>
      api.crea<EsitoDuplica>(`/eventi/${e.id}/duplica`, {
        id: nuovoId(),
        nome: nome.trim(),
        data,
        gruppoId: gruppoId || null,
        copiaPartecipanti: partecipanti,
        collegaSerie: collega && stessaFamiglia,
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
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={collega && stessaFamiglia} disabled={!stessaFamiglia} onChange={(ev) => setCollega(ev.target.checked)} /> È una nuova edizione della stessa ricorrenza
        </label>
        {!stessaFamiglia ? <p className="text-xs text-testo-tenue">Le edizioni di una ricorrenza restano nella stessa Famiglia.</p> : null}
      </div>
    </Finestra>
  )
}

/** Altre edizioni della ricorrenza, con il confronto e il collegamento a mano. */
export function PannelloEdizioni({ evento: e }: { evento: Evento }) {
  const q = useEdizioni(e.id)
  const puoScrivere = usePuoScrivere()
  const [collega, setCollega] = useState(false)
  const [scelto, setScelto] = useState('')
  const imposta = useScrittura((conEventoId: string | null) => api.modifica<Edizioni>(`/eventi/${e.id}/serie`, { conEventoId }), {
    successo: (r) => (r.serieId ? 'Edizioni collegate' : 'Evento scollegato dalla ricorrenza'),
    dopo: () => setCollega(false),
  })
  const d = q.data
  if (!d || (!d.edizioni.length && !d.puoCollegare && !d.altriEventi.length)) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Altre edizioni</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {d.edizioni.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Altre edizioni">
            {d.edizioni.map((x) => (
              <li key={x.id}>
                <Link to={`/eventi/${x.id}`} className="text-primario underline-offset-2 hover:underline">
                  {x.nome}
                </Link>
                <span className="text-testo-tenue"> · {dataBreve(x.data)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-testo-tenue">Nessuna altra edizione collegata. Duplicando l&apos;evento la copia diventa la prossima edizione.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {d.puoCollegare && d.altriEventi.length ? (
            <Button variante="contorno" misura="piccolo" disabled={!puoScrivere} onClick={() => setCollega(true)}>
              <Link2 /> Collega a un&apos;edizione
            </Button>
          ) : null}
          {d.puoCollegare && d.serieId ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere || imposta.inCorso} onClick={() => void imposta.esegui(null)}>
              <Unlink /> Scollega
            </Button>
          ) : null}
        </div>
      </CardContent>
      <Finestra
        aperta={collega}
        onCambia={setCollega}
        titolo="Collega a un'altra edizione"
        descrizione="Solo eventi della stessa Famiglia. Non si collega nulla da solo, nemmeno con lo stesso nome."
        piede={
          <Button disabled={!scelto || imposta.inCorso} onClick={() => void imposta.esegui(scelto)}>
            Collega
          </Button>
        }
      >
        <Campo etichetta="Evento" htmlFor="serie-evento">
          <Select id="serie-evento" value={scelto} onChange={(ev) => setScelto(ev.target.value)}>
            <option value="">Scegli…</option>
            {d.altriEventi.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome} · {dataBreve(x.data)}
              </option>
            ))}
          </Select>
        </Campo>
      </Finestra>
    </Card>
  )
}
