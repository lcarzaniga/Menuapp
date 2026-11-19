// Cronologia delle modifiche di una ricetta (SPEC §41): chi ha cambiato cosa e quando, con i valori
// di prima e di dopo; il proprietario può tornare a una versione (che diventa una revisione nuova).
import { useQuery } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '@/api/client'
import { usePiatto } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Conferma } from '@/components/ui/dialog'
import type { Cronologia, Revisione } from '@/contratto/collaborazione.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { type CampoModifica, descrivi, NOMI_CAMPI } from '@/domain/ricetta/proposte.ts'

const quando = (ms: number) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(ms)

function titolo(r: Revisione): string {
  switch (r.tipo) {
    case 'iniziale':
      return 'Com\'era all\'inizio della cronologia'
    case 'modifica':
      return `Modificata da ${r.autore.nome}`
    case 'proposta':
      return `Proposta di ${r.autore.nome}${r.approvatoDa ? `, approvata da ${r.approvatoDa.nome}` : ''}`
    case 'ripristino':
      return `${r.autore.nome} è tornato alla versione ${r.ripristinaNumero}`
    case 'foto':
      return `Foto${r.propostaId ? ` proposte da ${r.autore.nome}, approvate da ${r.approvatoDa?.nome ?? ''}` : ` cambiate da ${r.autore.nome}`}`
    case 'trasferimento':
      return `Trasferita da ${r.autore.nome}, accettata da ${r.approvatoDa?.nome ?? ''}`
    case 'riassegnazione':
      return `Riassegnata da ${r.autore.nome}, accettata da ${r.approvatoDa?.nome ?? ''}`
  }
}

const nomeCampo = (c: string) => (c === 'proprietario' ? 'Proprietario' : (NOMI_CAMPI[c as CampoModifica] ?? c))
const valore = (c: string, v: unknown) => (c === 'proprietario' ? String(v ?? '—') : descrivi(c as CampoModifica, v))

export function PaginaCronologia() {
  const { id = '' } = useParams()
  const naviga = useNavigate()
  const piatto = usePiatto(id)
  const q = useQuery({ queryKey: ['cronologia', id], queryFn: () => api.leggi<Cronologia>(`/piatti/${id}/cronologia`) })
  const [scelta, setScelta] = useState<Revisione | null>(null)
  const connesso = useStatoConnessione() === 'connesso'
  const ripristina = useScrittura((r: Revisione) => api.crea(`/piatti/${id}/ripristina`, { revisioneId: r.id, versione: q.data!.versionePiatto }), {
    successo: 'Versione ripristinata: è una nuova revisione',
    dopo: () => naviga(`/ricettario/${id}`),
  })
  if (!q.data || !piatto.data) return <Caricamento />
  return (
    <Pagina titolo="Cronologia modifiche" sottotitolo={piatto.data.nome} indietro={`/ricettario/${id}`}>
      {q.data.revisioni.length === 0 ? (
        <Vuoto titolo="Nessuna modifica, per ora" testo="Da qui in avanti ogni modifica alla ricetta resta registrata." />
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Revisioni">
          {q.data.revisioni.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-bordo/70 bg-carta p-3 shadow-carta" data-testid="revisione">
              <div className="flex flex-wrap items-start gap-2">
                <History className="mt-0.5 size-4 shrink-0 text-testo-tenue" />
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">
                    {r.numero}. {titolo(r)}
                  </span>
                  <span className="block text-xs text-testo-tenue">{quando(r.creatoIl)}</span>
                </p>
                {r.ripristinabile && r.numero !== q.data!.revisioni[0]!.numero ? (
                  <Button variante="contorno" misura="piccolo" disabled={!connesso} onClick={() => setScelta(r)}>
                    <RotateCcw /> Torna a questa versione
                  </Button>
                ) : null}
              </div>
              {r.motivazione ? <p className="text-sm text-testo-tenue">Motivazione: {r.motivazione}</p> : null}
              {r.campi.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {r.campi.map((c, i) => (
                    <li key={i} className="rounded-lg bg-tenue/40 px-2.5 py-1.5">
                      <span className="font-medium">{nomeCampo(c.campo)}</span>
                      <span className="block whitespace-pre-line text-xs text-testo-tenue">
                        {valore(c.campo, c.prima)} → {valore(c.campo, c.dopo)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Conferma
        aperta={scelta !== null}
        onCambia={(a) => !a && setScelta(null)}
        titolo={`Tornare alla versione ${scelta?.numero ?? ''}?`}
        descrizione="Nome, ingredienti, procedimento, tempi e note tornano com'erano allora; diventa una nuova revisione e la cronologia resta tutta. Foto, storia, ricordi, proposte ed eventi non cambiano."
        etichettaConferma="Torna a questa versione"
        onConferma={() => scelta && void ripristina.esegui(scelta).then(() => setScelta(null))}
        disabilitata={ripristina.inCorso}
      />
    </Pagina>
  )
}
