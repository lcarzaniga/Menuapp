// Duplica evento e ricorrenza dell'evento (SPEC §25, §28, §30).
import { Copy, Repeat } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
import type { AnteprimaDuplica, Edizioni, EsitoDuplica } from '@/contratto/edizioni.ts'
import { useEdizioni, useRicorrenze } from '@/api/query'
import { etichettaRicorrenza, SelettoreRicorrenza, sceltaDi, type ValoreRicorrenza, valoreDi } from './SceltaRicorrenza'
import { annoDopo, nomeEdizione } from '@/domain/edizioni.ts'
import { dataBreve } from '@/domain/tempo.ts'
import type { Evento } from '@/domain/tipi.ts'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { cn } from '@/lib/utils'



export function DuplicaEvento({ evento: e, onChiudi }: { evento: Evento; onChiudi: () => void }) {
  const naviga = useNavigate()
  const { famiglie } = useFamigliaAttiva()
  const famigliaEvento = useAccessoEvento(e.id).data?.gruppo?.id ?? null
  const iniziale = annoDopo(e.data)
  const [data, setData] = useState(iniziale)
  const [nome, setNome] = useState(nomeEdizione(e.nome, e.data, iniziale))
  const [nomeToccato, setNomeToccato] = useState(false)
  const [gruppoId, setGruppoId] = useState<string>(famigliaEvento && famiglie.some((f) => f.id === famigliaEvento) ? famigliaEvento : (famiglie[0]?.id ?? ''))
  // Cosa copiare (SPEC §25): i valori di sempre, più partecipanti e chi porta cosa a scelta.
  const [copia, setCopia] = useState({ menu: true, partecipanti: false, incarichi: false, piano: true, stampa: true })
  const [id] = useState(nuovoId)
  const stessaFamiglia = (gruppoId || null) === famigliaEvento
  // Si propone la stessa ricorrenza dell'originale: una standard vale in ogni Famiglia, una della
  // Famiglia solo nella sua (cambiando Famiglia si sceglie fra quelle della nuova).
  const originale = valoreDi(e)
  const [ricorrenza, setRicorrenza] = useState(originale)
  const ricorrenze = useRicorrenze(gruppoId || null)
  const sceltaRicorrenza = !gruppoId
    ? ''
    : ricorrenza.startsWith('famiglia:')
      ? ricorrenze.data
        ? ricorrenze.data.some((x) => `famiglia:${x.id}` === ricorrenza) ? ricorrenza : ''
        : stessaFamiglia ? ricorrenza : ''
      : ricorrenza
  const richiesta = { id, nome: nome.trim() || e.nome, data, gruppoId: gruppoId || null, copia, ricorrenza: sceltaDi(sceltaRicorrenza) }
  // Anteprima (D8): cosa verrà creato con queste scelte, ricalcolata a ogni cambio; non scrive nulla.
  const anteprima = useQuery({
    queryKey: ['anteprima-duplica', e.id, data, gruppoId, copia],
    queryFn: () => api.crea<{ anteprima: AnteprimaDuplica }>(`/eventi/${e.id}/duplica`, { ...richiesta, anteprima: true }),
    enabled: Boolean(data),
    staleTime: 0,
  })
  const a = anteprima.data?.anteprima
  const duplica = useScrittura(
    () => api.crea<EsitoDuplica>(`/eventi/${e.id}/duplica`, richiesta),
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
      descrizione={`Nuovo evento a partire da «${e.nome}» del ${dataBreve(e.data)}. L'originale non cambia.`}
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
        <fieldset className="flex flex-col" aria-label="Cosa copiare">
          <legend className="mb-1 text-sm font-medium">Cosa copiare</legend>
          {SCELTE.map((x) => {
            const disponibile = x.id !== 'incarichi' || a?.incarichiDisponibili !== false
            return (
              <label key={x.id} className={cn('flex min-h-11 items-center gap-3 text-sm', !disponibile && 'text-testo-tenue')}>
                <Casella checked={copia[x.id] && disponibile} disabled={!disponibile} onChange={(ev) => setCopia({ ...copia, [x.id]: ev.target.checked })} />
                <span>
                  {x.etichetta}
                  <span className="block text-xs text-testo-tenue">{disponibile ? x.dettaglio : 'non disponibile da un evento archiviato'}</span>
                </span>
              </label>
            )
          })}
        </fieldset>
        {gruppoId ? (
          <Campo
            etichetta="Ricorrenza"
            htmlFor="dup-ricorrenza"
            aiuto={originale && sceltaRicorrenza === originale ? 'Proposta la stessa dell\'evento originale: puoi cambiarla o toglierla.' : undefined}
          >
            <SelettoreRicorrenza id="dup-ricorrenza" valore={sceltaRicorrenza} onCambia={setRicorrenza} famiglia={ricorrenze.data ?? []} />
          </Campo>
        ) : null}
        <AnteprimaDuplicazione a={a} caricamento={anteprima.isFetching} />
      </div>
    </Finestra>
  )
}

const SCELTE = [
  { id: 'menu', etichetta: 'Menù', dettaglio: 'portate, piatti e porzioni (senza: solo le portate)' },
  { id: 'partecipanti', etichetta: 'Partecipanti', dettaglio: 'tutti in attesa, da riconfermare; i coperti si copiano sempre come numeri' },
  { id: 'incarichi', etichetta: 'Chi porta cosa', dettaglio: 'piatti affidati e cose da portare, da riassegnare: nessuno è già d\'accordo' },
  { id: 'piano', etichetta: 'Piano delle attività', dettaglio: 'spostato sulla nuova data, tutto da fare' },
  { id: 'stampa', etichetta: 'Impostazioni di stampa', dettaglio: 'modello e note del menù stampato' },
] as const

const ESITO: Record<AnteprimaDuplica['portate'][number]['voci'][number]['ricetta'], string | null> = {
  collegata: null,
  nessuna: null,
  copia: 'copiata nel tuo ricettario',
  copia_esistente: 'userà la tua copia',
  dall_archivio: 'ricreata dall\'archivio',
  non_disponibile: 'senza ricetta',
}

/** Cosa verrà creato (D8): si controlla prima di confermare; dopo, il nuovo evento si modifica come ogni altro. */
function AnteprimaDuplicazione({ a, caricamento }: { a: AnteprimaDuplica | undefined; caricamento: boolean }) {
  if (!a) return <p className="text-sm text-testo-tenue">{caricamento ? 'Preparo l\'anteprima…' : ''}</p>
  const voci = a.portate.flatMap((p) => p.voci)
  const particolari = voci.filter((v) => ESITO[v.ricetta])
  const mostra = <T,>(l: T[], n = 4) => ({ primi: l.slice(0, n), altri: l.length - n })
  const attivita = mostra(a.attivita)
  const incarichi = mostra(a.incarichi)
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-tenue/60 p-3 text-sm" aria-label="Anteprima" data-testid="anteprima-duplica">
      <p className="font-semibold">Verrà creato</p>
      <ul className="flex flex-col gap-1.5 text-testo-tenue">
        <li>
          <span className="text-testo">Menù:</span> {voci.length ? `${voci.length} ${voci.length === 1 ? 'piatto' : 'piatti'}` : 'nessun piatto'} in {a.portate.length} portate
          {particolari.map((v) => (
            <span key={v.nome} className="block text-xs">
              «{v.nome}»: {ESITO[v.ricetta]}
            </span>
          ))}
        </li>
        {a.partecipanti ? <li><span className="text-testo">Partecipanti:</span> {a.partecipanti}, tutti in attesa</li> : null}
        {a.incarichi.length ? (
          <li>
            <span className="text-testo">Da riassegnare:</span>
            {incarichi.primi.map((x) => (
              <span key={x.nome} className="block text-xs">
                {x.nome}
                {x.precedente ? ` — l'ultima volta: ${x.precedente}` : ''}
              </span>
            ))}
            {incarichi.altri > 0 ? <span className="block text-xs">e altri {incarichi.altri}</span> : null}
          </li>
        ) : null}
        {a.attivita.length ? (
          <li>
            <span className="text-testo">Piano:</span> {a.attivita.length} attività da fare
            {attivita.primi.map((x, k) => (
              <span key={k} className="block text-xs">
                {dataBreve(x.data)}
                {x.ora ? ` ${x.ora}` : ''} · {x.titolo}
              </span>
            ))}
            {attivita.altri > 0 ? <span className="block text-xs">e altre {attivita.altri}</span> : null}
          </li>
        ) : null}
        {a.stampa ? <li><span className="text-testo">Stampa:</span> stesse impostazioni</li> : null}
      </ul>
      {a.avvisi.map((x) => (
        <p key={x} className="text-xs text-avviso">
          {x}
        </p>
      ))}
      <p className="text-xs text-testo-tenue">Mai copiati: conferme, voti, bacheca e sondaggi, stato della spesa, condivisioni. Dopo puoi modificare tutto.</p>
    </section>
  )
}

/** Ricorrenza dell'evento: sceglierla o toglierla, gli altri eventi della ricorrenza, il confronto. */
export function PannelloRicorrenza({ evento: e }: { evento: Evento }) {
  const q = useEdizioni(e.id)
  const puoScrivere = usePuoScrivere()
  const imposta = useScrittura((v: ValoreRicorrenza) => api.modifica<Edizioni>(`/eventi/${e.id}/ricorrenza`, { ricorrenza: sceltaDi(v) }), {
    successo: (r) => (r.ricorrenza ? `Ricorrenza: ${etichettaRicorrenza(r.ricorrenza)}` : 'Nessuna ricorrenza'),
  })
  const d = q.data
  if (!d || (!d.ricorrenza && !d.puoAssociare && !d.altriEventi.length)) return null
  const attuale = d.ricorrenza ? `${d.ricorrenza.tipo}:${d.ricorrenza.id}` : ''
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="size-4 text-primario" /> Ricorrenza
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {d.puoAssociare ? (
          <SelettoreRicorrenza etichetta="Ricorrenza dell'evento" valore={attuale} famiglia={d.ricorrenze} disabilitato={!puoScrivere || imposta.inCorso} onCambia={(v) => void imposta.esegui(v)} />
        ) : (
          <p className="text-sm">{d.ricorrenza ? etichettaRicorrenza(d.ricorrenza) : 'Nessuna ricorrenza'}</p>
        )}
        {d.suggerita ? (
          // Proposta dall'occasione: mai applicata da sola (SPEC §30).
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-info-tenue px-3 py-2 text-sm text-info" role="note" data-testid="ricorrenza-suggerita">
            <span className="min-w-0 flex-1">L&apos;occasione indica la ricorrenza standard «{d.suggerita.nome}».</span>
            <Button misura="piccolo" disabled={!puoScrivere || imposta.inCorso} onClick={() => void imposta.esegui(`standard:${d.suggerita!.id}`)}>
              Usa «{d.suggerita.nome}»
            </Button>
            <Button misura="piccolo" variante="fantasma" disabled={!puoScrivere || imposta.inCorso} onClick={() => void imposta.esegui(attuale)}>
              Lascia così
            </Button>
          </div>
        ) : null}
        {d.puoAssociare ? (
          <p className="text-xs text-testo-tenue">
            Le ricorrenze standard (Natale, Pasqua…) sono già pronte; le altre (un compleanno…) si creano in{' '}
            <Link to="/famiglia?scheda=gestione" className="underline">
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
            <Link to={`/eventi/${e.id}/confronto`}>{d.edizioni.some((x) => x.data < e.data) ? 'Confronta con l\'anno scorso' : 'Confronta con un altro evento'}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
