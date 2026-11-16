// Famiglia attiva: bacheca, piatti più apprezzati, membri e inviti (SPEC §20, §21).
import { useQuery } from '@tanstack/react-query'
import { LogOut, Medal, Plus, Star, Trophy, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useImpostazioni } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Input, Select } from '@/components/ui/campi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Conferma, Finestra } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import type { AnteprimaInvito, Gruppo, InvitoFamigliaCreato } from '@/contratto/famiglia.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useUtenteCorrente } from '@/features/accesso/sessione'
import { cn } from '@/lib/utils'
import { Bacheca } from './Bacheca'
import { useClassifica } from './api'
import { useFamigliaAttiva } from './attiva'

export function PaginaFamiglia() {
  const { attiva, caricamento } = useFamigliaAttiva()
  const [parametri, setParametri] = useSearchParams()
  const scheda = (['apprezzati', 'membri'] as const).find((x) => x === parametri.get('scheda')) ?? 'bacheca'
  if (caricamento) return <Caricamento />
  if (!attiva) return <SenzaFamiglia />
  return (
    <Pagina titolo={attiva.nome} sottotitolo={attiva.membri.map((m) => m.nome).join(' · ')}>
      <nav aria-label="Sezioni della famiglia" className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-bordo/70">
        {(
          [
            ['bacheca', 'Bacheca'],
            ['apprezzati', 'I più apprezzati'],
            ['membri', 'Membri'],
          ] as const
        ).map(([k, nome]) => (
          <button
            key={k}
            type="button"
            aria-current={scheda === k ? 'page' : undefined}
            onClick={() => setParametri(k === 'bacheca' ? {} : { scheda: k }, { replace: true })}
            className={cn('whitespace-nowrap border-b-2 border-transparent px-3 pb-2.5 pt-1.5 text-sm font-medium text-testo-tenue', scheda === k && 'border-primario text-primario')}
          >
            {nome}
          </button>
        ))}
      </nav>
      {scheda === 'bacheca' ? (
        <Bacheca key={attiva.id} ambito={{ tipo: 'gruppo', id: attiva.id }} segnaposto="Un'idea per il prossimo pranzo, una ricetta da provare, una comunicazione…" />
      ) : scheda === 'apprezzati' ? (
        <Classifica gruppo={attiva.id} />
      ) : (
        <Membri famiglia={attiva} />
      )}
    </Pagina>
  )
}

/** Nessuna Famiglia: se ne crea una, oppure si apre il link d'invito ricevuto. */
function SenzaFamiglia() {
  const [nome, setNome] = useState('')
  const { scegli } = useFamigliaAttiva()
  const crea = useScrittura(() => api.crea<Gruppo>('/famiglie', { id: nuovoId(), nome: nome.trim() }), { successo: (g) => `Benvenuti in ${g.nome}`, dopo: (g) => scegli(g.id) })
  return (
    <Pagina titolo="Famiglia">
      <div className="flex flex-col gap-4">
        <Vuoto illustrazione="tavola" titolo="Non fai ancora parte di una Famiglia" testo="Se qualcuno ti ha invitato, apri il link che ti ha mandato. Oppure crea la tua: poi inviti fratelli, cugini, nonni e amici." />
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <Campo etichetta="Nome della Famiglia" htmlFor="nuova-famiglia">
              <Input id="nuova-famiglia" value={nome} maxLength={80} placeholder="Es. Famiglia Rossi" onChange={(e) => setNome(e.target.value)} />
            </Campo>
            <Button className="self-start" disabled={!nome.trim() || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
              <Plus /> Crea la Famiglia
            </Button>
          </CardContent>
        </Card>
      </div>
    </Pagina>
  )
}

/** Membri e gestione semplice: invito, ruoli, passaggio dell'amministrazione, uscita. */
function Membri({ famiglia }: { famiglia: Gruppo }) {
  const { utente } = useUtenteCorrente()
  const naviga = useNavigate()
  const connesso = useStatoConnessione() === 'connesso'
  const admin = famiglia.ruolo === 'amministratore'
  const [invito, setInvito] = useState<InvitoFamigliaCreato | null>(null)
  const [conferma, setConferma] = useState<null | { titolo: string; testo: string; azione: () => void }>(null)
  const [nuova, setNuova] = useState(false)
  const [nome, setNome] = useState(famiglia.nome)
  const invita = useScrittura(() => api.crea<InvitoFamigliaCreato>(`/famiglie/${famiglia.id}/inviti`, {}), { successo: null, dopo: setInvito })
  const rinomina = useScrittura(() => api.modifica<Gruppo>(`/famiglie/${famiglia.id}`, { nome: nome.trim(), versione: famiglia.versione }), { oggetto: 'La Famiglia', successo: 'Nome aggiornato' })
  const ruolo = useScrittura((d: { id: string; ruolo: 'amministratore' | 'membro' }) => api.modifica<Gruppo>(`/famiglie/${famiglia.id}/membri/${d.id}`, { ruolo: d.ruolo }), { successo: 'Ruolo aggiornato' })
  const passa = useScrittura((id: string) => api.crea<Gruppo>(`/famiglie/${famiglia.id}/amministrazione`, { utenteId: id }), { successo: 'Amministrazione passata' })
  const togli = useScrittura((id: string) => api.elimina<Gruppo>(`/famiglie/${famiglia.id}/membri/${id}`), { successo: 'Membro tolto dalla Famiglia' })
  const esci = useScrittura(() => api.crea(`/famiglie/${famiglia.id}/esci`, {}), { successo: `Sei uscito da ${famiglia.nome}`, dopo: () => naviga('/') })
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Membri</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-bordo/60" aria-label="Membri della Famiglia">
            {famiglia.membri.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="font-medium">{m.id === utente?.id ? `${m.nome} (tu)` : m.nome}</span>
                {m.ruolo === 'amministratore' ? <Badge variante="primario">amministra</Badge> : null}
                {admin && m.id !== utente?.id ? (
                  <span className="ml-auto">
                    <MenuAzioni
                      etichetta={`Azioni per ${m.nome}`}
                      voci={[
                        { etichetta: 'Rendi amministratore', onSelect: () => void ruolo.esegui({ id: m.id, ruolo: 'amministratore' }), nascosta: m.ruolo === 'amministratore' },
                        { etichetta: 'Togli da amministratore', onSelect: () => void ruolo.esegui({ id: m.id, ruolo: 'membro' }), nascosta: m.ruolo !== 'amministratore' },
                        {
                          etichetta: 'Passagli l\'amministrazione',
                          onSelect: () => setConferma({ titolo: `Passare l'amministrazione a ${m.nome}?`, testo: 'Diventerà amministratore e tu resterai membro.', azione: () => void passa.esegui(m.id) }),
                        },
                        {
                          etichetta: 'Togli dalla Famiglia',
                          pericolosa: true,
                          onSelect: () => setConferma({ titolo: `Togliere ${m.nome} dalla Famiglia?`, testo: 'Non vedrà più la bacheca e le ricette della Famiglia. I suoi eventi e le sue ricette restano suoi.', azione: () => void togli.esegui(m.id) }),
                        },
                      ]}
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {admin ? (
            invito ? (
              <div className="mt-3 rounded-2xl border border-primario/40 bg-primario-tenue/40 p-4" data-testid="invito-famiglia">
                <p className="text-sm font-medium">Invito a {invito.famiglia}</p>
                <p className="mt-0.5 text-xs text-testo-tenue">Per chi ha già l&apos;app: vale 7 giorni, una sola volta. Chi non ha ancora un account lo riceve da chi gestisce l&apos;app.</p>
                <input readOnly value={invito.link} aria-label="Link d'invito alla Famiglia" onFocus={(e) => e.currentTarget.select()} className="mt-3 w-full rounded-xl border border-bordo bg-carta px-3 py-2 font-mono text-xs" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button misura="piccolo" onClick={() => void navigator.clipboard?.writeText(invito.link)}>
                    Copia il link
                  </Button>
                  <Button misura="piccolo" variante="contorno" asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Entra in «${invito.famiglia}» su Ricette di famiglia & Co.: ${invito.link}`)}`} target="_blank" rel="noreferrer noopener">
                      Invia con WhatsApp
                    </a>
                  </Button>
                  <Button misura="piccolo" variante="fantasma" onClick={() => setInvito(null)}>
                    Fatto
                  </Button>
                </div>
              </div>
            ) : (
              <Button variante="contorno" className="mt-3" disabled={!connesso || invita.inCorso} onClick={() => void invita.esegui(undefined)}>
                <UserPlus /> Invita nella Famiglia
              </Button>
            )
          ) : null}
        </CardContent>
      </Card>

      {admin ? (
        <Card>
          <CardHeader>
            <CardTitle>Nome della Famiglia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input aria-label="Nome della Famiglia" className="min-w-48 flex-1" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
            <Button variante="contorno" disabled={!connesso || !nome.trim() || nome.trim() === famiglia.nome} onClick={() => void rinomina.esegui(undefined)}>
              Salva
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variante="contorno"
          disabled={!connesso}
          onClick={() => setConferma({ titolo: `Uscire da ${famiglia.nome}?`, testo: 'Non vedrai più bacheca e ricette della Famiglia, e le tue ricette non saranno più condivise con loro. I tuoi eventi restano tuoi.', azione: () => void esci.esegui(undefined) })}
        >
          <LogOut /> Esci dalla Famiglia
        </Button>
        <Button variante="fantasma" onClick={() => setNuova(true)}>
          <Plus /> Crea un'altra Famiglia
        </Button>
      </div>
      {nuova ? <NuovaFamiglia onChiudi={() => setNuova(false)} /> : null}
      <Conferma
        aperta={conferma !== null}
        onCambia={(a) => !a && setConferma(null)}
        titolo={conferma?.titolo ?? ''}
        descrizione={conferma?.testo}
        etichettaConferma="Conferma"
        onConferma={() => {
          conferma?.azione()
          setConferma(null)
        }}
      />
    </div>
  )
}

function NuovaFamiglia({ onChiudi }: { onChiudi: () => void }) {
  const [nome, setNome] = useState('')
  const { scegli } = useFamigliaAttiva()
  const crea = useScrittura(() => api.crea<Gruppo>('/famiglie', { id: nuovoId(), nome: nome.trim() }), {
    successo: (g) => `Creata ${g.nome}`,
    dopo: (g) => {
      scegli(g.id)
      onChiudi()
    },
  })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Nuova Famiglia"
      descrizione="Per esempio la famiglia di tua moglie o di un figlio: ognuna ha la sua bacheca, i suoi eventi e le sue ricette condivise."
      piede={
        <Button disabled={!nome.trim() || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
          Crea
        </Button>
      }
    >
      <Campo etichetta="Nome" htmlFor="nome-nuova-famiglia">
        <Input id="nome-nuova-famiglia" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} autoFocus />
      </Campo>
    </Finestra>
  )
}

/** Link d'invito a una Famiglia: #/unisciti/<token> (serve già un account). */
export function PaginaUnisciti() {
  const { token = '' } = useParams()
  const naviga = useNavigate()
  const { scegli } = useFamigliaAttiva()
  const anteprima = useQuery({ queryKey: ['invito-famiglia', token], queryFn: () => api.crea<AnteprimaInvito>('/inviti-famiglia/anteprima', { token }), retry: false })
  const accetta = useScrittura(() => api.crea<Gruppo>('/inviti-famiglia/accetta', { token }), {
    successo: (g) => `Benvenuto in ${g.nome}`,
    dopo: (g) => {
      scegli(g.id)
      naviga('/famiglia', { replace: true })
    },
  })
  const a = anteprima.data
  return (
    <Pagina titolo="Invito a una Famiglia">
      {anteprima.isPending ? (
        <Caricamento />
      ) : !a ? (
        <Vuoto titolo="Invito non valido" testo="Controlla di aver aperto il link completo, oppure chiedine uno nuovo." />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-4">
            <p className="titolo text-2xl font-semibold">{a.famiglia.nome}</p>
            {a.invitatoDa ? <p className="text-sm text-testo-tenue">Ti ha invitato {a.invitatoDa}.</p> : null}
            {a.stato === 'valido' ? (
              <>
                <p className="text-sm">Entrando vedrai la bacheca e le ricette condivise della Famiglia. I tuoi contenuti privati restano privati.</p>
                <div className="flex gap-2">
                  <Button disabled={accetta.inCorso} onClick={() => void accetta.esegui(undefined)}>
                    Entra nella Famiglia
                  </Button>
                  <Button variante="fantasma" onClick={() => naviga('/', { replace: true })}>
                    No, grazie
                  </Button>
                </div>
              </>
            ) : a.stato === 'gia_membro' ? (
              <Button
                onClick={() => {
                  scegli(a.famiglia.id)
                  naviga('/famiglia')
                }}
              >
                Fai già parte di questa Famiglia: apri
              </Button>
            ) : (
              <p className="text-sm text-pericolo">{a.stato === 'scaduto' ? 'L\'invito è scaduto.' : a.stato === 'usato' ? 'L\'invito è già stato usato.' : 'L\'invito è stato annullato.'} Chiedine uno nuovo.</p>
            )}
          </CardContent>
        </Card>
      )}
    </Pagina>
  )
}

export function Stelle({ valore, dimensione = 'size-4' }: { valore: number; dimensione?: string }) {
  return (
    <span className="inline-flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(dimensione, i <= Math.round(valore) ? 'fill-oro text-oro' : 'text-bordo')} />
      ))}
    </span>
  )
}

function Classifica({ gruppo }: { gruppo: string }) {
  const imp = useImpostazioni()
  const [portata, setPortata] = useState('')
  const [anno, setAnno] = useState('')
  const c = useClassifica(portata, anno, gruppo)
  const [anni] = useState(() => Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - i)))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Portata" className="h-10 w-auto" value={portata} onChange={(e) => setPortata(e.target.value)}>
          <option value="">Tutte le portate</option>
          {(imp.data?.portatePredefinite ?? []).map((p) => (
            <option key={p.id} value={p.nome}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select aria-label="Periodo" className="h-10 w-auto" value={anno} onChange={(e) => setAnno(e.target.value)}>
          <option value="">Sempre</option>
          {anni.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-testo-tenue">
        Ordinati con una media prudente: con pochi voti un piatto parte da 3 stelle, così un solo 5 non supera molti voti alti. Accanto vedi la media vera e quanti hanno votato.
      </p>
      {c.isPending ? (
        <Caricamento />
      ) : !c.data?.length ? (
        <Vuoto illustrazione="taccuino" titolo="Ancora nessuna valutazione" testo="Dopo un pranzo, nel Menù dell'evento ognuno può dare da 1 a 5 stelle ai piatti serviti." />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Classifica dei piatti">
          {c.data.map((v, i) => (
            <li key={v.chiave} className="flex items-center gap-3 rounded-2xl border border-bordo/70 bg-carta p-3 shadow-carta">
              <span className="flex size-9 shrink-0 items-center justify-center">
                {i === 0 ? <Trophy className="size-6 text-oro" /> : i < 3 ? <Medal className="size-6 text-testo-tenue" /> : <span className="titolo text-lg text-testo-tenue">{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                {v.ricettaId ? (
                  <Link to={`/ricettario/${v.ricettaId}`} className="titolo block truncate text-lg font-semibold hover:text-primario">
                    {v.nome}
                  </Link>
                ) : (
                  <p className="titolo truncate text-lg font-semibold">{v.nome}</p>
                )}
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-testo-tenue">
                  <Stelle valore={v.media} dimensione="size-3.5" />
                  <span className="font-semibold text-testo">{v.media.toLocaleString('it-IT')}</span>
                  <span>
                    {v.numero} {v.numero === 1 ? 'voto' : 'voti'}
                    {v.eventi > 1 ? ` in ${v.eventi} occasioni` : ''}
                  </span>
                  {v.portata ? <span>· {v.portata}</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
