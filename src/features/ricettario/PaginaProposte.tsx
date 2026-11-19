// Proposte di modifica a una ricetta (SPEC §41). Il proprietario confronta valore attuale e
// proposto, approva o rifiuta ogni modifica, vede il riepilogo e conferma; l'autore vede l'esito
// di ogni modifica, può ritirare la proposta e rispondere ai chiarimenti.
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, MessageCircle, Undo2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { api } from '@/api/client'
import { usePiatto } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Casella, Input, Textarea } from '@/components/ui/campi'
import type { Modifica, Proposta, Proposte } from '@/contratto/collaborazione.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { type CampoModifica, descrivi, NOMI_CAMPI } from '@/domain/ricetta/proposte.ts'
import { cn } from '@/lib/utils'
import { urlFoto } from './FotoPiatto'

const quando = (ms: number) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
const STATO: Record<Modifica['stato'], { testo: string; variante: 'neutro' | 'successo' | 'avviso' | 'pericolo' }> = {
  in_attesa: { testo: 'in attesa', variante: 'neutro' },
  approvata: { testo: 'approvata', variante: 'successo' },
  rifiutata: { testo: 'rifiutata', variante: 'pericolo' },
  ritirata: { testo: 'ritirata', variante: 'neutro' },
}

export function PaginaProposte() {
  const { id = '' } = useParams()
  const [parametri] = useSearchParams()
  const scelta = parametri.get('proposta')
  const piatto = usePiatto(id)
  const q = useQuery({ queryKey: ['proposte', id], queryFn: () => api.leggi<Proposte>(`/piatti/${id}/proposte`) })
  useEffect(() => {
    if (scelta && q.data) document.getElementById(`proposta-${scelta}`)?.scrollIntoView({ block: 'start' })
  }, [scelta, q.data])
  if (!q.data || !piatto.data) return <Caricamento />
  const attese = q.data.proposte.filter((p) => p.stato === 'in_attesa')
  const chiuse = q.data.proposte.filter((p) => p.stato !== 'in_attesa')
  return (
    <Pagina titolo="Proposte di modifica" sottotitolo={piatto.data.nome} indietro={`/ricettario/${id}`}>
      {q.data.proposte.length === 0 ? (
        <Vuoto titolo="Nessuna proposta" testo={piatto.data.mio ? 'Quando un familiare propone una modifica, la trovi qui.' : 'Dalla ricetta: «Proponi una modifica».'} />
      ) : (
        <div className="flex flex-col gap-6">
          {attese.length ? (
            <section aria-label="In attesa" className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-testo-tenue">In attesa</h2>
              {attese.map((p) => (
                <SchedaProposta key={p.id} p={p} versionePiatto={q.data.versionePiatto} evidenziata={p.id === scelta} />
              ))}
            </section>
          ) : null}
          {chiuse.length ? (
            <section aria-label="Concluse" className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-testo-tenue">Concluse e ritirate</h2>
              {chiuse.map((p) => (
                <SchedaProposta key={p.id} p={p} versionePiatto={q.data.versionePiatto} evidenziata={p.id === scelta} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </Pagina>
  )
}

interface Scelta {
  esito: 'approvata' | 'rifiutata' | null
  motivo: string
  conferma: boolean
}

function SchedaProposta({ p, versionePiatto, evidenziata }: { p: Proposta; versionePiatto: number; evidenziata: boolean }) {
  const connesso = useStatoConnessione() === 'connesso'
  const [scelte, setScelte] = useState<Record<string, Scelta>>({})
  const [messaggio, setMessaggio] = useState('')
  const inAttesa = p.modifiche.filter((m) => m.stato === 'in_attesa')
  const scelta = (m: Modifica): Scelta => scelte[m.id] ?? { esito: null, motivo: '', conferma: false }
  const cambia = (m: Modifica, x: Partial<Scelta>) => setScelte({ ...scelte, [m.id]: { ...scelta(m), ...x } })
  const decise = inAttesa.filter((m) => scelta(m).esito)
  const approvate = decise.filter((m) => scelta(m).esito === 'approvata')
  // Combinazioni non valide: una foto approvata senza il procedimento da cui dipende; un conflitto non confermato.
  const dipendenze = approvate.filter((m) => m.dipendeDa && inAttesa.some((x) => x.id === m.dipendeDa) && scelta(inAttesa.find((x) => x.id === m.dipendeDa)!).esito !== 'approvata')
  const conflittiAperti = approvate.filter((m) => m.conflitto && !scelta(m).conferma)
  const pronta = decise.length === inAttesa.length && !dipendenze.length && !conflittiAperti.length
  const decidi = useScrittura(
    () =>
      api.crea<Proposta>(`/proposte/${p.id}/decisione`, {
        versione: p.versione,
        versionePiatto,
        decisioni: decise.map((m) => ({ modificaId: m.id, esito: scelta(m).esito, motivo: scelta(m).motivo, confermaConflitto: scelta(m).conferma })),
      }),
    { successo: 'Decisione registrata', dopo: () => setScelte({}) },
  )
  const ritira = useScrittura(() => api.crea<Proposta>(`/proposte/${p.id}/ritira`, { versione: p.versione }), { successo: 'Proposta ritirata' })
  const scrivi = useScrittura(() => api.crea<Proposta>(`/proposte/${p.id}/chiarimenti`, { testo: messaggio }), { successo: 'Inviato', dopo: () => setMessaggio('') })
  return (
    <article
      id={`proposta-${p.id}`}
      className={cn('flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-bordo/70 bg-carta p-4 shadow-carta', evidenziata && 'ring-2 ring-primario/50')}
      data-testid="proposta"
    >
      <header className="flex flex-wrap items-center gap-2">
        <p className="flex-1 font-medium">
          {p.autore.nome} <span className="text-sm font-normal text-testo-tenue">· {quando(p.creatoIl)}</span>
        </p>
        <Badge variante={p.stato === 'in_attesa' ? 'avviso' : 'neutro'}>{p.stato === 'in_attesa' ? 'in attesa' : p.stato === 'ritirata' ? 'ritirata' : 'conclusa'}</Badge>
      </header>
      {p.motivazione ? <p className="whitespace-pre-line rounded-xl bg-tenue/60 px-3 py-2 text-sm">«{p.motivazione}»</p> : null}

      <ul className="flex flex-col gap-3" aria-label="Modifiche">
        {p.modifiche.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-xl border border-bordo/60 p-3" data-testid="modifica">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-sm font-semibold">{etichetta(m)}</p>
              {m.stato !== 'in_attesa' || !p.puoDecidere ? <Badge variante={STATO[m.stato].variante}>{STATO[m.stato].testo}</Badge> : null}
            </div>
            <Confronto m={m} />
            {m.conflitto ? (
              <p className="flex items-start gap-1.5 text-xs text-avviso">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Da riesaminare: nel frattempo la ricetta è cambiata proprio qui.
              </p>
            ) : null}
            {m.motivo ? <p className="text-xs text-testo-tenue">Motivo: {m.motivo}</p> : null}
            {p.puoDecidere && m.stato === 'in_attesa' ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Decisione su ${etichetta(m)}`}>
                  <Button type="button" misura="piccolo" variante={scelta(m).esito === 'approvata' ? 'primario' : 'contorno'} aria-pressed={scelta(m).esito === 'approvata'} onClick={() => cambia(m, { esito: 'approvata' })}>
                    <Check /> Approva
                  </Button>
                  <Button type="button" misura="piccolo" variante={scelta(m).esito === 'rifiutata' ? 'pericolo' : 'contorno'} aria-pressed={scelta(m).esito === 'rifiutata'} onClick={() => cambia(m, { esito: 'rifiutata' })}>
                    <X /> Rifiuta
                  </Button>
                </div>
                {scelta(m).esito === 'rifiutata' ? (
                  <Input aria-label={`Motivo del rifiuto per ${etichetta(m)}`} placeholder="Motivo (facoltativo)" value={scelta(m).motivo} onChange={(e) => cambia(m, { motivo: e.target.value })} />
                ) : null}
                {scelta(m).esito === 'approvata' && m.conflitto ? (
                  <label className="flex items-center gap-2 text-xs">
                    <Casella checked={scelta(m).conferma} onChange={(e) => cambia(m, { conferma: e.target.checked })} /> Applica comunque, sostituendo il valore attuale
                  </label>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {p.puoDecidere ? (
        <div className="flex flex-col gap-2 rounded-xl bg-tenue/60 p-3 text-sm" data-testid="riepilogo-decisioni">
          <p>
            Riepilogo: <strong>{approvate.length}</strong> da approvare, <strong>{decise.length - approvate.length}</strong> da rifiutare
            {inAttesa.length - decise.length ? `, ${inAttesa.length - decise.length} ancora da decidere` : ''}.
          </p>
          {dipendenze.length ? <p className="text-avviso">Una foto riguarda un passaggio nuovo: approva anche il procedimento, o rifiuta la foto.</p> : null}
          {conflittiAperti.length ? <p className="text-avviso">Conferma le modifiche da riesaminare che vuoi applicare.</p> : null}
          <Button className="self-start" disabled={!connesso || !pronta || decidi.inCorso} onClick={() => void decidi.esegui(undefined)}>
            Conferma le decisioni
          </Button>
        </div>
      ) : null}

      {p.chiarimenti.length ? (
        <ul className="flex flex-col gap-1.5 text-sm" aria-label="Chiarimenti">
          {p.chiarimenti.map((c, i) => (
            <li key={i} className="rounded-xl bg-tenue/40 px-3 py-2">
              <span className="font-medium">{c.autore.nome}:</span> {c.testo}
              <span className="block text-xs text-testo-tenue">{quando(c.il)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {p.stato === 'in_attesa' ? (
        <div className="flex flex-col gap-2">
          <Textarea aria-label="Chiarimento" className="min-h-12" placeholder={p.puoDecidere ? 'Chiedi un chiarimento…' : 'Rispondi o aggiungi un chiarimento…'} value={messaggio} maxLength={2000} onChange={(e) => setMessaggio(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variante="contorno" misura="piccolo" disabled={!connesso || !messaggio.trim() || scrivi.inCorso} onClick={() => void scrivi.esegui(undefined)}>
              <MessageCircle /> Invia
            </Button>
            {p.puoRitirare ? (
              <Button variante="fantasma" misura="piccolo" disabled={!connesso || ritira.inCorso} onClick={() => void ritira.esegui(undefined)}>
                <Undo2 /> Ritira la proposta
              </Button>
            ) : null}
          </div>
        </div>
      ) : p.decisoDa ? (
        <p className="text-xs text-testo-tenue">
          Decisa da {p.decisoDa.nome}
          {p.decisoIl ? ` il ${quando(p.decisoIl)}` : ''}
        </p>
      ) : null}
    </article>
  )
}

function etichetta(m: Modifica): string {
  const campo = NOMI_CAMPI[m.campo as CampoModifica] ?? m.campo
  if (m.campo === 'ingrediente') return `${campo}: ${m.operazione === 'aggiungi' ? 'nuovo' : m.operazione === 'rimuovi' ? 'da togliere' : 'cambiato'}`
  if (m.campo === 'foto') return m.operazione === 'aggiungi' ? 'Foto da aggiungere' : 'Foto da togliere'
  return campo
}

/** Valore attuale accanto a quello proposto (le foto con l'anteprima). */
function Confronto({ m }: { m: Modifica }) {
  const campo = m.campo as CampoModifica
  if (m.campo === 'foto') {
    return m.foto ? (
      <figure className="flex items-center gap-3 text-xs text-testo-tenue">
        <img src={urlFoto(m.foto.id)} alt={m.foto.didascalia || 'Foto proposta'} className={cn('size-24 rounded-lg object-cover', m.operazione === 'rimuovi' && 'opacity-50')} />
        <figcaption>
          {m.foto.didascalia}
          {m.foto.passo !== null ? ` · passaggio ${m.foto.passo + 1}` : ''}
        </figcaption>
      </figure>
    ) : (
      <p className="text-xs text-testo-tenue">La foto non c'è più.</p>
    )
  }
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <div className="rounded-lg bg-tenue/50 px-2.5 py-1.5">
        <span className="block text-xs text-testo-tenue">Ora</span>
        <span className="whitespace-pre-line">{descrivi(campo, m.attuale)}</span>
      </div>
      <div className="rounded-lg bg-successo-tenue/50 px-2.5 py-1.5">
        <span className="block text-xs text-testo-tenue">Proposto</span>
        <span className="whitespace-pre-line">{m.operazione === 'rimuovi' ? '(da togliere)' : descrivi(campo, m.dopo)}</span>
      </div>
    </div>
  )
}
