// Collaborazione sulla scheda della ricetta (SPEC §41): «Proponi una modifica», proposte in
// attesa, cronologia, trasferimento e riassegnazione della proprietà. Le regole le applica il
// server; qui si mostra solo ciò che l'utente può fare.
import { useQuery } from '@tanstack/react-query'
import { FilePen, History, KeyRound, ListChecks, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Select, Textarea } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import type { Collaborazione, Trasferimento } from '@/contratto/collaborazione.ts'
import type { DettaglioPiatto } from '@/contratto/ricettario.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useUtenteCorrente } from '@/features/accesso/sessione'

export const useCollaborazione = (id: string) =>
  useQuery({ queryKey: ['collaborazione', id], queryFn: () => api.leggi<Collaborazione>(`/piatti/${id}/collaborazione`) })

// La scheda di una ricetta altrui è in sola lettura, ma proporre e accettare spetta anche ad altri:
// conta la connessione, i permessi li applica il server.
const useConnesso = () => useStatoConnessione() === 'connesso'

/** Sotto il titolo: proposte, cronologia, «Proponi una modifica», trasferimento in attesa. */
export function BarraCollaborazione({ piatto, onProponi }: { piatto: DettaglioPiatto; onProponi: () => void }) {
  const q = useCollaborazione(piatto.id)
  const connesso = useConnesso()
  const c = q.data
  if (!c) return null
  return (
    <div className="flex flex-col gap-2" data-testid="collaborazione">
      {c.trasferimento ? <AvvisoTrasferimento t={c.trasferimento} /> : null}
      <div className="flex flex-wrap gap-2">
        {c.puoProporre ? (
          <Button misura="piccolo" disabled={!connesso} onClick={onProponi}>
            <FilePen /> Proponi una modifica
          </Button>
        ) : null}
        {c.proposteInAttesa || piatto.mio || c.puoProporre ? (
          <Button asChild variante="contorno" misura="piccolo">
            <Link to={`/ricettario/${piatto.id}/proposte`}>
              <ListChecks /> {piatto.mio ? 'Proposte in attesa' : 'Le mie proposte'} {c.proposteInAttesa ? `(${c.proposteInAttesa})` : ''}
            </Link>
          </Button>
        ) : null}
        {c.vedeCronologia ? (
          <Button asChild variante="contorno" misura="piccolo">
            <Link to={`/ricettario/${piatto.id}/cronologia`}>
              <History /> Cronologia modifiche
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function AvvisoTrasferimento({ t }: { t: Trasferimento }) {
  const { utente } = useUtenteCorrente()
  const connesso = useConnesso()
  const decidi = useScrittura((esito: 'accetta' | 'rifiuta' | 'annulla') => api.crea<Trasferimento>(`/trasferimenti/${t.id}/decisione`, { esito, versione: t.versione }), {
    successo: (r) => (r.stato === 'accettato' ? 'Ora la ricetta è tua' : r.stato === 'rifiutato' ? 'Hai rifiutato' : 'Trasferimento annullato'),
  })
  const destinatario = t.a.id === utente?.id
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-primario/40 bg-primario-tenue/40 px-3 py-2.5 text-sm" role="status" data-testid="avviso-trasferimento">
      <p className="flex items-start gap-2">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-primario" />
        <span>
          {destinatario
            ? `${t.creatoDa.nome} ti propone di diventare proprietario di questa ricetta. Diventerai tu a decidere sulle modifiche e sulle proposte in attesa.`
            : `In attesa che ${t.a.nome} accetti di diventare proprietario.`}
          {t.tipo === 'amministrativo' ? <span className="block text-xs text-testo-tenue">Riassegnazione di {t.creatoDa.nome}: {t.motivazione}</span> : null}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {destinatario ? (
          <>
            <Button misura="piccolo" disabled={!connesso || decidi.inCorso} onClick={() => void decidi.esegui('accetta')}>
              Accetta
            </Button>
            <Button misura="piccolo" variante="contorno" disabled={!connesso || decidi.inCorso} onClick={() => void decidi.esegui('rifiuta')}>
              Rifiuta
            </Button>
          </>
        ) : (
          <Button misura="piccolo" variante="contorno" disabled={!connesso || decidi.inCorso} onClick={() => void decidi.esegui('annulla')}>
            Annulla il trasferimento
          </Button>
        )}
      </div>
    </div>
  )
}

/** Nella gestione della ricetta: trasferire (proprietario) o riassegnare (amministratore). */
export function GestioneProprieta({ piatto }: { piatto: DettaglioPiatto }) {
  const q = useCollaborazione(piatto.id)
  const connesso = useConnesso()
  const [aperta, setAperta] = useState<'trasferisci' | 'riassegna' | null>(null)
  const c = q.data
  if (!c || c.trasferimento) return null
  const trasferisce = piatto.mio && c.destinatari.length > 0
  if (!trasferisce && !c.puoRiassegnare) return null
  return (
    <>
      {trasferisce ? (
        <Button variante="contorno" misura="piccolo" className="self-start" disabled={!connesso} onClick={() => setAperta('trasferisci')}>
          <KeyRound /> Trasferisci proprietà
        </Button>
      ) : null}
      {c.puoRiassegnare ? (
        <Button variante="contorno" misura="piccolo" className="self-start" disabled={!connesso} onClick={() => setAperta('riassegna')}>
          <UserRoundCog /> Riassegna proprietà
        </Button>
      ) : null}
      {aperta ? <FinestraProprieta piatto={piatto} c={c} modo={aperta} onChiudi={() => setAperta(null)} /> : null}
    </>
  )
}

function FinestraProprieta({ piatto, c, modo, onChiudi }: { piatto: DettaglioPiatto; c: Collaborazione; modo: 'trasferisci' | 'riassegna'; onChiudi: () => void }) {
  const riassegna = modo === 'riassegna'
  const candidati = useQuery({
    queryKey: ['riassegnazione', piatto.id],
    queryFn: () => api.leggi<{ id: string; nome: string }[]>(`/piatti/${piatto.id}/riassegnazione`),
    enabled: riassegna,
  })
  const elenco = riassegna ? (candidati.data ?? []) : c.destinatari
  const [a, setA] = useState('')
  const [motivazione, setMotivazione] = useState('')
  const scelto = a || elenco[0]?.id || ''
  const invia = useScrittura(
    () =>
      riassegna
        ? api.crea<Trasferimento>(`/piatti/${piatto.id}/riassegnazione`, { id: nuovoId(), a: scelto, motivazione })
        : api.crea<Trasferimento>(`/piatti/${piatto.id}/trasferimento`, { id: nuovoId(), a: scelto, versionePiatto: piatto.versione }),
    { successo: (r) => (r.stato === 'accettato' ? 'Riassegnata' : `Richiesta inviata a ${r.a.nome}`), dopo: onChiudi },
  )
  return (
    <Finestra
      aperta
      onCambia={(x) => !x && onChiudi()}
      titolo={riassegna ? 'Riassegna proprietà' : 'Trasferisci proprietà'}
      descrizione={
        riassegna
          ? `Quando ${piatto.proprietario.nome} non può più occuparsene: la ricetta passa a un altro membro della Famiglia, se accetta. Restano foto, storia, ricordi, cronologia e proposte.`
          : 'La ricetta resta la stessa (foto, storia, ricordi, cronologia, proposte) e diventa di un altro membro della Famiglia, se accetta. Tu continui a vederla come familiare.'
      }
      piede={
        <Button disabled={!scelto || (riassegna && !motivazione.trim()) || invia.inCorso} onClick={() => void invia.esegui(undefined)}>
          {riassegna ? 'Riassegna' : 'Invia la richiesta'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="A chi" htmlFor="proprieta-a">
          <Select id="proprieta-a" value={scelto} onChange={(e) => setA(e.target.value)}>
            {elenco.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </Select>
        </Campo>
        {riassegna ? (
          <Campo etichetta="Motivazione (obbligatoria)" htmlFor="proprieta-motivo" aiuto={`${piatto.proprietario.nome} riceverà una notifica.`}>
            <Textarea id="proprieta-motivo" className="min-h-20" value={motivazione} maxLength={1000} onChange={(e) => setMotivazione(e.target.value)} />
          </Campo>
        ) : null}
      </div>
    </Finestra>
  )
}
