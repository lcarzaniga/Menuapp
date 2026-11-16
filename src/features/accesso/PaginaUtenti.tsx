// Amministrazione: utenti, inviti, richieste di attivazione, dispositivi (SPEC §19.2).
// Raggiungibile solo dall'indirizzo privato: dall'ingresso pubblico le rotte non esistono.
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Plus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'

interface GruppoAdmin {
  id: string
  nome: string
  membri: { id: string; nome: string; ruolo: 'amministratore' | 'membro' }[]
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Finestra } from '@/components/ui/dialog'
import type { Invito, InvitoCreato, Richiesta, Ruolo, Sessione, Utente } from '@/contratto/accesso.ts'
import { usePuoScrivere } from '@/connessione/stato'
import { ElencoDispositivi, LinkInvito, RichiesteInAttesa } from './componenti'
import { dataOra, useUtenteCorrente } from './sessione'

export function PaginaUtenti() {
  const { amministratore, ingressoPrivato } = useUtenteCorrente()
  if (!amministratore || !ingressoPrivato) {
    return (
      <Pagina titolo="Utenti e dispositivi" indietro="/account">
        <Vuoto titolo="Non disponibile" testo={amministratore ? 'La gestione degli utenti si apre solo dall\'indirizzo privato (Tailscale).' : 'Funzione riservata all\'amministratore.'} />
      </Pagina>
    )
  }
  return <Gestione />
}

function Gestione() {
  const puoScrivere = usePuoScrivere()
  const utenti = useQuery({ queryKey: ['admin', 'utenti'], queryFn: () => api.leggi<Utente[]>('/admin/utenti') })
  const richieste = useQuery({ queryKey: ['admin', 'richieste'], queryFn: () => api.leggi<Richiesta[]>('/admin/richieste'), refetchInterval: 5000 })
  const sessioni = useQuery({ queryKey: ['admin', 'sessioni'], queryFn: () => api.leggi<Sessione[]>('/admin/sessioni') })
  const inviti = useQuery({ queryKey: ['admin', 'inviti'], queryFn: () => api.leggi<Invito[]>('/admin/inviti') })
  const gruppi = useQuery({ queryKey: ['admin', 'gruppi'], queryFn: () => api.leggi<GruppoAdmin[]>('/admin/gruppi') })
  const famiglia = gruppi.data?.[0]
  const membro = useScrittura(
    (d: { utenteId: string; dentro: boolean }) =>
      d.dentro ? api.modifica(`/admin/gruppi/${famiglia!.id}/membri/${d.utenteId}`, { ruolo: 'membro' }) : api.elimina(`/admin/gruppi/${famiglia!.id}/membri/${d.utenteId}`),
    { successo: (_r) => 'Famiglia aggiornata' },
  )
  const [nuovo, setNuovo] = useState(false)
  const [modifica, setModifica] = useState<Utente | null>(null)
  const [invito, setInvito] = useState<InvitoCreato | null>(null)
  const creaInvito = useScrittura((u: Utente) => api.crea<InvitoCreato>(`/admin/utenti/${u.id}/inviti`, {}), { successo: null, dopo: setInvito })
  const annulla = useScrittura((i: Invito) => api.elimina(`/admin/inviti/${i.id}`), { successo: 'Invito annullato' })

  if (!utenti.data) return <Caricamento />
  const validi = (inviti.data ?? []).filter((i) => i.stato === 'valido')
  return (
    <Pagina
      titolo="Utenti e dispositivi"
      indietro="/account"
      azioni={
        <Button onClick={() => setNuovo(true)} disabled={!puoScrivere}>
          <Plus /> Utente
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Richieste in attesa</CardTitle>
          </CardHeader>
          <CardContent>
            <RichiesteInAttesa richieste={richieste.data ?? []} />
          </CardContent>
        </Card>

        {invito ? <LinkInvito invito={invito} onChiudi={() => setInvito(null)} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Utenti</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-bordo/60">
              {utenti.data.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-2 py-2.5" data-testid="utente">
                  <UserRound className="size-5 text-testo-tenue" />
                  <span className="font-medium">{u.nome}</span>
                  {u.ruolo === 'amministratore' ? <Badge variante="primario">amministratore</Badge> : null}
                  {u.stato === 'sospeso' ? <Badge variante="pericolo">sospeso</Badge> : null}
                  {famiglia ? (
                    <label className="flex items-center gap-1.5 text-xs text-testo-tenue" title="Vede la bacheca e il ricettario della famiglia">
                      <Casella
                        aria-label={`${u.nome} fa parte di ${famiglia.nome}`}
                        checked={famiglia.membri.some((m) => m.id === u.id)}
                        disabled={!puoScrivere || membro.inCorso}
                        onChange={(e) => void membro.esegui({ utenteId: u.id, dentro: e.target.checked })}
                      />
                      {famiglia.nome}
                    </label>
                  ) : null}
                  <span className="ml-auto flex gap-2">
                    <Button misura="piccolo" variante="contorno" disabled={!puoScrivere || u.stato !== 'attivo'} onClick={() => void creaInvito.esegui(u)}>
                      <KeyRound /> Invito
                    </Button>
                    <Button misura="piccolo" variante="fantasma" disabled={!puoScrivere} onClick={() => setModifica(u)}>
                      Modifica
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {validi.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Inviti non ancora usati</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-bordo/60">
                {validi.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1 text-sm">
                      {i.utenteNome} · scade {dataOra(i.scadeIl)}
                    </span>
                    <Button misura="piccolo" variante="fantasma" disabled={!puoScrivere} onClick={() => void annulla.esegui(i)}>
                      Annulla
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Dispositivi autorizzati</CardTitle>
          </CardHeader>
          <CardContent>{sessioni.data ? <ElencoDispositivi sessioni={sessioni.data} mostraUtente percorsoRevoca={(id) => `/admin/sessioni/${id}`} /> : <Caricamento />}</CardContent>
        </Card>
      </div>
      <NuovoUtente aperta={nuovo} onCambia={setNuovo} onCreato={(u) => void creaInvito.esegui(u)} />
      {modifica ? <ModificaUtente utente={modifica} onChiudi={() => setModifica(null)} /> : null}
    </Pagina>
  )
}

function NuovoUtente({ aperta, onCambia, onCreato }: { aperta: boolean; onCambia: (a: boolean) => void; onCreato: (u: Utente) => void }) {
  const [nome, setNome] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo>('utente')
  const [famiglia, setFamiglia] = useState(true)
  const crea = useScrittura((d: { nome: string; ruolo: Ruolo }) => api.crea<Utente>('/admin/utenti', { id: nuovoId(), ...d, famiglia }), {
    successo: (u) => `${u.nome} aggiunto: ecco il suo invito`,
    dopo: (u) => {
      setNome('')
      onCambia(false)
      onCreato(u)
    },
  })
  return (
    <Finestra
      aperta={aperta}
      onCambia={onCambia}
      titolo="Nuovo utente"
      descrizione="Ogni persona ha il suo account, con eventi e ricette personali. Dopo la creazione ricevi il link d'invito da mandarle."
      piede={
        <Button disabled={!nome.trim() || crea.inCorso} onClick={() => void crea.esegui({ nome: nome.trim(), ruolo })}>
          Crea e genera l&apos;invito
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Nome" htmlFor="nuovo-nome">
          <Input id="nuovo-nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoFocus />
        </Campo>
        <Campo etichetta="Ruolo" htmlFor="nuovo-ruolo">
          <Select id="nuovo-ruolo" value={ruolo} onChange={(e) => setRuolo(e.target.value as Ruolo)}>
            <option value="utente">Utente</option>
            <option value="amministratore">Amministratore</option>
          </Select>
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={famiglia} onChange={(e) => setFamiglia(e.target.checked)} /> Fa parte della famiglia (bacheca e ricettario di famiglia)
        </label>
      </div>
    </Finestra>
  )
}

function ModificaUtente({ utente, onChiudi }: { utente: Utente; onChiudi: () => void }) {
  const [nome, setNome] = useState(utente.nome)
  const [ruolo, setRuolo] = useState<Ruolo>(utente.ruolo)
  const [stato, setStato] = useState(utente.stato)
  const salva = useScrittura(() => api.modifica<Utente>(`/admin/utenti/${utente.id}`, { nome: nome.trim(), ruolo, stato, versione: utente.versione }), {
    oggetto: 'L\'utente',
    dopo: onChiudi,
  })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Modifica ${utente.nome}`}
      descrizione="Sospendere un utente scollega subito tutti i suoi dispositivi e annulla i suoi inviti. I suoi dati restano."
      piede={
        <Button disabled={!nome.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Nome" htmlFor="mod-nome">
          <Input id="mod-nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo etichetta="Ruolo" htmlFor="mod-ruolo">
          <Select id="mod-ruolo" value={ruolo} onChange={(e) => setRuolo(e.target.value as Ruolo)}>
            <option value="utente">Utente</option>
            <option value="amministratore">Amministratore</option>
          </Select>
        </Campo>
        <Campo etichetta="Stato" htmlFor="mod-stato">
          <Select id="mod-stato" value={stato} onChange={(e) => setStato(e.target.value as Utente['stato'])}>
            <option value="attivo">Attivo</option>
            <option value="sospeso">Sospeso</option>
          </Select>
        </Campo>
      </div>
    </Finestra>
  )
}
