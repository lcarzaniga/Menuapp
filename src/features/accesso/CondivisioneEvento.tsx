// Condivisione di un evento: con chi, con quale permesso; revoca, uscita, passaggio di proprietà.
import { LogOut, Share2, UserRoundCog, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Select } from '@/components/ui/campi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Conferma, Finestra } from '@/components/ui/dialog'
import type { AccessoEvento, PermessoCondivisione } from '@/contratto/accesso.ts'
import { useStatoConnessione } from '@/connessione/stato'
import type { Evento } from '@/domain/tipi.ts'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { useAccessoEvento, usePersone, useUtenteCorrente } from './sessione'

const NOMI_PERMESSO: Record<PermessoCondivisione, string> = { lettura: 'Sola lettura', modifica: 'Può modificare' }

export function CondivisioneEvento({ evento }: { evento: Evento }) {
  const accesso = useAccessoEvento(evento.id)
  if (!accesso.data) return null
  return accesso.data.permesso === 'proprietario' ? <PerProprietario evento={evento} accesso={accesso.data} /> : <PerInvitato evento={evento} accesso={accesso.data} />
}

function PerInvitato({ evento, accesso }: { evento: Evento; accesso: AccessoEvento }) {
  const naviga = useNavigate()
  const { utente } = useUtenteCorrente()
  const connesso = useStatoConnessione() === 'connesso'
  const [lascia, setLascia] = useState(false)
  const esci = useScrittura(() => api.elimina(`/eventi/${evento.id}/condivisioni/${utente!.id}`), {
    successo: 'Non vedi più questo evento',
    dopo: () => naviga('/', { replace: true }),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Condiviso con te</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          Evento di <strong>{accesso.proprietario.nome}</strong>.{' '}
          {accesso.permesso === 'modifica'
            ? 'Puoi modificare menù, spesa e piano.'
            : accesso.partecipa
              ? 'Puoi consultarlo e partecipare (bacheca, sondaggi, proposte, chi porta cosa), ma non modificare il menù.'
              : 'Puoi consultarlo ma non modificarlo.'}
        </p>
        <Button variante="contorno" className="self-start" disabled={!connesso} onClick={() => setLascia(true)}>
          <LogOut /> Lascia l&apos;evento
        </Button>
      </CardContent>
      <Conferma
        aperta={lascia}
        onCambia={setLascia}
        titolo="Lasciare l'evento?"
        descrizione={`Non vedrai più «${evento.nome}». ${accesso.proprietario.nome} potrà condividerlo di nuovo con te.`}
        etichettaConferma="Lascia"
        pericolosa
        onConferma={() => {
          setLascia(false)
          void esci.esegui(undefined)
        }}
      />
    </Card>
  )
}

function PerProprietario({ evento, accesso }: { evento: Evento; accesso: AccessoEvento }) {
  // Si invitano le persone della Famiglia dell'evento.
  const persone = usePersone(accesso.gruppo?.id)
  const connesso = useStatoConnessione() === 'connesso'
  const [chi, setChi] = useState('')
  const [permesso, setPermesso] = useState<PermessoCondivisione>('modifica')
  const [revoca, setRevoca] = useState<string | null>(null)
  const [passa, setPassa] = useState(false)
  const imposta = useScrittura(
    (d: { utenteId: string; permesso: PermessoCondivisione; partecipa?: boolean }) =>
      api.modifica(`/eventi/${evento.id}/condivisioni/${d.utenteId}`, { permesso: d.permesso, partecipa: d.partecipa ?? true }),
    {
      successo: 'Condivisione aggiornata',
      dopo: () => setChi(''),
    },
  )
  const togli = useScrittura((utenteId: string) => api.elimina(`/eventi/${evento.id}/condivisioni/${utenteId}`), { successo: 'Condivisione revocata' })
  const giaCondiviso = new Set(accesso.condivisioni.map((c) => c.utenteId))
  const disponibili = (persone.data ?? []).filter((p) => !giaCondiviso.has(p.id))
  const nomeRevoca = accesso.condivisioni.find((c) => c.utenteId === revoca)?.utenteNome

  return (
    <Card>
      <CardHeader>
        <CardTitle>Condivisione</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FamigliaEvento evento={evento} accesso={accesso} />
        {accesso.condivisioni.length === 0 ? (
          <p className="text-sm text-testo-tenue">L&apos;evento è privato: lo vedi solo tu.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-bordo/60" aria-label="Persone con accesso">
            {accesso.condivisioni.map((c) => (
              <li key={c.utenteId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{c.utenteNome}</span>
                {c.permesso === 'lettura' ? (
                  <label className="flex items-center gap-1.5 text-xs text-testo-tenue" title="Scrive in bacheca, vota, propone piatti e si offre per portare qualcosa">
                    <Casella
                      aria-label={`${c.utenteNome} partecipa alla bacheca`}
                      checked={c.partecipa}
                      disabled={!connesso}
                      onChange={(e) => void imposta.esegui({ utenteId: c.utenteId, permesso: c.permesso, partecipa: e.target.checked })}
                    />
                    partecipa
                  </label>
                ) : null}
                <Select
                  aria-label={`Permesso di ${c.utenteNome}`}
                  className="h-9 w-auto"
                  value={c.permesso}
                  disabled={!connesso}
                  onChange={(e) => void imposta.esegui({ utenteId: c.utenteId, permesso: e.target.value as PermessoCondivisione, partecipa: c.partecipa })}
                >
                  <option value="modifica">{NOMI_PERMESSO.modifica}</option>
                  <option value="lettura">{NOMI_PERMESSO.lettura}</option>
                </Select>
                <Button misura="iconaPiccola" variante="fantasma" aria-label={`Revoca a ${c.utenteNome}`} disabled={!connesso} onClick={() => setRevoca(c.utenteId)}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {disponibili.length ? (
          <div className="flex flex-wrap items-end gap-2">
            <Campo etichetta="Condividi con" htmlFor="condividi-con" className="min-w-40 flex-1">
              <Select id="condividi-con" value={chi} onChange={(e) => setChi(e.target.value)}>
                <option value="">Scegli una persona…</option>
                {disponibili.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etichetta="Permesso" htmlFor="condividi-permesso">
              <Select id="condividi-permesso" value={permesso} onChange={(e) => setPermesso(e.target.value as PermessoCondivisione)}>
                <option value="modifica">{NOMI_PERMESSO.modifica}</option>
                <option value="lettura">{NOMI_PERMESSO.lettura}</option>
              </Select>
            </Campo>
            <Button disabled={!chi || !connesso || imposta.inCorso} onClick={() => void imposta.esegui({ utenteId: chi, permesso })}>
              <Share2 /> Condividi
            </Button>
          </div>
        ) : persone.data?.length === 0 ? (
          <p className="text-sm text-testo-tenue">Non ci sono altre persone con un account.</p>
        ) : null}
        {(persone.data?.length ?? 0) > 0 ? (
          <Button variante="fantasma" className="self-start" disabled={!connesso} onClick={() => setPassa(true)}>
            <UserRoundCog /> Passa l&apos;evento a un&apos;altra persona
          </Button>
        ) : null}
      </CardContent>
      <Conferma
        aperta={revoca !== null}
        onCambia={(a) => !a && setRevoca(null)}
        titolo="Revocare la condivisione?"
        descrizione={`${nomeRevoca ?? ''} non vedrà più questo evento.`}
        etichettaConferma="Revoca"
        pericolosa
        onConferma={() => {
          if (revoca) void togli.esegui(revoca)
          setRevoca(null)
        }}
      />
      {passa ? <PassaProprieta evento={evento} onChiudi={() => setPassa(false)} /> : null}
    </Card>
  )
}

/** Famiglia dell'evento: il proprietario con più Famiglie (o con un evento senza) la sceglie. */
function FamigliaEvento({ evento, accesso }: { evento: Evento; accesso: AccessoEvento }) {
  const { famiglie } = useFamigliaAttiva()
  const connesso = useStatoConnessione() === 'connesso'
  const sposta = useScrittura((gruppoId: string | null) => api.modifica(`/eventi/${evento.id}/famiglia`, { gruppoId }), { successo: 'Famiglia dell\'evento aggiornata' })
  if (famiglie.length < 2 && accesso.gruppo) return null
  if (famiglie.length === 0) return null
  return (
    <Campo etichetta="Famiglia dell'evento" htmlFor="famiglia-evento" aiuto="Si possono invitare le persone di questa Famiglia.">
      <Select id="famiglia-evento" value={accesso.gruppo?.id ?? ''} disabled={!connesso || sposta.inCorso} onChange={(e) => void sposta.esegui(e.target.value || null)}>
        <option value="">Nessuna (evento personale)</option>
        {famiglie.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </Select>
    </Campo>
  )
}

function PassaProprieta({ evento, onChiudi }: { evento: Evento; onChiudi: () => void }) {
  const persone = usePersone(useAccessoEvento(evento.id).data?.gruppo?.id)
  const [a, setA] = useState('')
  const trasferisci = useScrittura(() => api.crea(`/eventi/${evento.id}/trasferisci`, { utenteId: a, versione: evento.versione }), {
    oggetto: 'L\'evento',
    successo: 'Evento passato: ora puoi modificarlo come invitato',
    dopo: onChiudi,
  })
  return (
    <Finestra
      aperta
      onCambia={(x) => !x && onChiudi()}
      titolo="Passare l'evento a un'altra persona?"
      descrizione="Diventerà proprietaria dell'evento e riceverà una copia delle ricette collegate. Tu resterai con il permesso di modifica."
      piede={
        <Button disabled={!a || trasferisci.inCorso} onClick={() => void trasferisci.esegui(undefined)}>
          Passa l&apos;evento
        </Button>
      }
    >
      <Campo etichetta="Nuovo proprietario" htmlFor="nuovo-proprietario">
        <Select id="nuovo-proprietario" value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Scegli una persona…</option>
          {(persone.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </Campo>
    </Finestra>
  )
}
