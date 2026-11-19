// Ricette: Famiglia d'origine, dove è visibile (privata o in una Famiglia), condivisione con
// persone, copie indipendenti nel proprio ricettario o in un'altra Famiglia (SPEC §19.4, §28, §35).
import { Copy, Globe, History, House, Lock, Share2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Select } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import type { DettaglioPiatto, Provenienza } from '@/contratto/ricettario.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { cn } from '@/lib/utils'
import { usePersone } from './sessione'

/**
 * Famiglia in cui la ricetta è nata (SPEC §35): la vedono tutti quelli che vedono la ricetta. Per le
 * ricette nate prima, senza origine certa, il proprietario la indica una volta sola.
 */
export function FamigliaOrigineRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const connesso = useStatoConnessione() === 'connesso'
  const { famiglie, attiva } = useFamigliaAttiva()
  const [scelta, setScelta] = useState('')
  const indica = useScrittura(
    (gruppoId: string) => api.modifica<DettaglioPiatto>(`/piatti/${piatto.id}/famiglia-origine`, { gruppoId, versione: piatto.versione }),
    { oggetto: 'La ricetta', successo: (p) => `Nata in ${p.famigliaOrigine?.nome ?? ''}` },
  )
  if (piatto.famigliaOrigine) {
    return (
      <p className="flex items-center gap-1.5 text-sm" data-testid="famiglia-origine">
        <House className="size-4 text-testo-tenue" /> Nata in {piatto.famigliaOrigine.nome}
      </p>
    )
  }
  if (!piatto.mio || !famiglie.length) return null
  const valore = scelta || attiva?.id || ''
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-bordo/70 bg-carta px-3 py-2 text-sm" data-testid="famiglia-origine">
      <p className="flex items-center gap-1.5">
        <House className="size-4 text-testo-tenue" /> In quale Famiglia è nata questa ricetta? Si indica una volta sola.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {famiglie.length > 1 ? (
          <Select aria-label="Famiglia d'origine" value={valore} onChange={(e) => setScelta(e.target.value)} className="flex-1">
            {famiglie.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        ) : null}
        <Button variante="contorno" misura="piccolo" disabled={!connesso || indica.inCorso || !valore} onClick={() => void indica.esegui(valore)}>
          {famiglie.length > 1 ? 'Indica' : `Nata in ${famiglie[0]!.nome}`}
        </Button>
      </div>
    </div>
  )
}

/**
 * Dove è visibile la ricetta (per il proprietario): in una delle sue Famiglie oppure privata.
 * Una privata si può condividere con persone scelte. In un'altra Famiglia si copia.
 */
export function VisibilitaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const connesso = useStatoConnessione() === 'connesso'
  const { famiglie } = useFamigliaAttiva()
  const imposta = useScrittura((gruppi: string[]) => api.modifica<DettaglioPiatto>(`/piatti/${piatto.id}/famiglie`, { gruppi }), {
    successo: (p) => (p.famiglie.length ? `Visibile in ${p.famiglie[0]!.nome}` : 'Ricetta privata: la vedi solo tu'),
  })
  const condivisa = new Set(piatto.famiglie.map((f) => f.id))
  const privata = condivisa.size === 0 && piatto.visibilita !== 'pubblica'
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-bordo/70 bg-carta px-3 py-2 text-sm" data-testid="visibilita-ricetta">
      <div className="flex flex-wrap items-center gap-2">
        {privata ? <Lock className="size-4 text-testo-tenue" /> : <UsersRound className="size-4 text-primario" />}
        <span className="flex-1">
          {privata
            ? piatto.condivisaCon.length
              ? `Privata, condivisa con ${piatto.condivisaCon.map((p) => p.nome).join(', ')}`
              : 'Privata: la vedi solo tu'
            : `Visibile ai membri di ${piatto.famiglie.map((f) => f.nome).join(', ')}: la vedono e possono copiarla`}
        </span>
        {privata ? <CondividiRicetta piatto={piatto} /> : null}
        {famiglie.length === 1 ? (
          <Button variante="fantasma" misura="piccolo" disabled={!connesso || imposta.inCorso} onClick={() => void imposta.esegui(privata ? [famiglie[0]!.id] : [])}>
            {privata ? `Condividi con ${famiglie[0]!.nome}` : 'Rendi privata'}
          </Button>
        ) : null}
      </div>
      {famiglie.length >= 2 ? (
        <Select
          aria-label="Dove è visibile la ricetta"
          value={piatto.famiglie[0]?.id ?? ''}
          disabled={!connesso || imposta.inCorso}
          onChange={(e) => void imposta.esegui(e.target.value ? [e.target.value] : [])}
        >
          <option value="">Privata: solo io</option>
          {famiglie.map((f) => (
            <option key={f.id} value={f.id}>
              Visibile in {f.nome}
            </option>
          ))}
        </Select>
      ) : null}
      <PubblicaRicetta piatto={piatto} />
    </div>
  )
}

/**
 * «Pubblica nell'app» (SPEC §36): tutti gli utenti dell'app la leggono e possono copiarla, mai chi
 * non ha un accesso. Serve la Famiglia d'origine; togliendola la ricetta resta nella sua Famiglia.
 */
function PubblicaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const connesso = useStatoConnessione() === 'connesso'
  const [conferma, setConferma] = useState(false)
  const pubblica = piatto.visibilita === 'pubblica'
  const imposta = useScrittura((v: 'pubblica' | 'famiglia') => api.modifica<DettaglioPiatto>(`/piatti/${piatto.id}/visibilita`, { visibilita: v }), {
    successo: (p) => (p.visibilita === 'pubblica' ? 'Ricetta pubblica nell\'app' : 'Non più pubblica'),
    dopo: () => setConferma(false),
  })
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-bordo/60 pt-2" data-testid="pubblica-ricetta">
      <Globe className={cn('size-4', pubblica ? 'text-primario' : 'text-testo-tenue')} />
      <span className="flex-1">
        {pubblica ? 'Pubblica nell\'app: tutti gli utenti la leggono e possono copiarla' : piatto.famigliaOrigine ? 'Non pubblica' : 'Per pubblicarla indica prima in quale Famiglia è nata'}
      </span>
      {pubblica ? (
        <Button variante="fantasma" misura="piccolo" disabled={!connesso || imposta.inCorso} onClick={() => void imposta.esegui('famiglia')}>
          Togli dalle pubbliche
        </Button>
      ) : piatto.famigliaOrigine ? (
        <Button variante="fantasma" misura="piccolo" disabled={!connesso} onClick={() => setConferma(true)}>
          Pubblica nell&apos;app…
        </Button>
      ) : null}
      {conferma ? (
        <Finestra
          aperta
          onCambia={(a) => !a && setConferma(false)}
          titolo={`Pubblicare «${piatto.nome}»?`}
          descrizione={`Tutti gli utenti dell'app, anche di altre Famiglie, potranno leggerla con le foto e copiarla; vedranno che è nata in ${piatto.famigliaOrigine?.nome ?? ''} e che è tua. Chi non ha un accesso all'app non la vede. Puoi toglierla quando vuoi: le copie già fatte restano a chi le ha fatte.`}
          piede={
            <Button disabled={imposta.inCorso} onClick={() => void imposta.esegui('pubblica')}>
              <Globe /> Pubblica
            </Button>
          }
        >
          {null}
        </Finestra>
      ) : null}
    </div>
  )
}

export function CondividiRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const [aperta, setAperta] = useState(false)
  const connesso = useStatoConnessione() === 'connesso'
  return (
    <>
      <Button variante="contorno" misura="piccolo" disabled={!connesso} onClick={() => setAperta(true)}>
        <Share2 /> {piatto.condivisaCon.length ? `Condivisa con ${piatto.condivisaCon.length}` : 'Condividi con…'}
      </Button>
      {aperta ? <FinestraCondivisione piatto={piatto} onChiudi={() => setAperta(false)} /> : null}
    </>
  )
}

function FinestraCondivisione({ piatto, onChiudi }: { piatto: DettaglioPiatto; onChiudi: () => void }) {
  const persone = usePersone()
  const [scelti, setScelti] = useState(() => new Set(piatto.condivisaCon.map((p) => p.id)))
  const salva = useScrittura(() => api.modifica(`/piatti/${piatto.id}/condivisioni`, { utenti: [...scelti] }), { successo: 'Condivisione aggiornata', dopo: onChiudi })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Condividi «${piatto.nome}»`}
      descrizione="La ricetta resta privata, ma le persone scelte la vedono e possono copiarla nel loro ricettario. Le copie sono indipendenti: le tue modifiche non le cambiano."
      piede={
        <Button disabled={salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      {persone.data?.length ? (
        <ul className="flex flex-col gap-1">
          {persone.data.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-tenue">
                <Casella
                  checked={scelti.has(p.id)}
                  onChange={(e) => {
                    const n = new Set(scelti)
                    if (e.target.checked) n.add(p.id)
                    else n.delete(p.id)
                    setScelti(n)
                  }}
                />
                {p.nome}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-testo-tenue">Non ci sono altre persone con un account.</p>
      )}
    </Finestra>
  )
}

export function CopiaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const { famiglie } = useFamigliaAttiva()
  // Pubblica di un'altra Famiglia (SPEC §36): la copia nasce privata in una delle proprie Famiglie.
  if (piatto.miaCopia) {
    return (
      <Button asChild variante="contorno" misura="piccolo">
        <Link to={`/ricettario/${piatto.miaCopia}`}>
          <Copy /> Hai già una copia
        </Link>
      </Button>
    )
  }
  if (piatto.soloPubblica && famiglie.length) return <CopiaPubblica piatto={piatto} />
  return <CopiaNelRicettario piatto={piatto} />
}

function CopiaPubblica({ piatto }: { piatto: DettaglioPiatto }) {
  const { famiglie } = useFamigliaAttiva()
  const [aperta, setAperta] = useState(false)
  const connesso = useStatoConnessione() === 'connesso'
  return (
    <>
      <Button misura="piccolo" disabled={!connesso} onClick={() => setAperta(true)}>
        <Copy /> Copia in una mia Famiglia
      </Button>
      {aperta ? <FinestraCopiaInFamiglia piatto={piatto} famiglie={famiglie} origine={piatto.famigliaOrigine?.nome ?? ''} pubblica onChiudi={() => setAperta(false)} /> : null}
    </>
  )
}

function CopiaNelRicettario({ piatto }: { piatto: DettaglioPiatto }) {
  const naviga = useNavigate()
  const connesso = useStatoConnessione() === 'connesso'
  const copia = useScrittura(() => api.crea<DettaglioPiatto>(`/piatti/${piatto.id}/copia`, { id: nuovoId() }), {
    successo: 'Copiata nel tuo ricettario',
    dopo: (c) => naviga(`/ricettario/${c.id}`),
  })
  return (
    <Button misura="piccolo" disabled={!connesso || copia.inCorso} onClick={() => void copia.esegui(undefined)}>
      <Copy /> Copia nel mio ricettario
    </Button>
  )
}

/**
 * «Copia in un'altra Famiglia»: per chi fa parte di più Famiglie, da una ricetta visibile in una
 * di esse. La copia è nuova e indipendente: non segue le modifiche dell'originale.
 */
export function CopiaInFamiglia({ piatto }: { piatto: DettaglioPiatto }) {
  const { famiglie } = useFamigliaAttiva()
  const altre = famiglie.filter((f) => f.id !== piatto.famiglia?.id)
  const [aperta, setAperta] = useState(false)
  const connesso = useStatoConnessione() === 'connesso'
  if (!piatto.famiglia || altre.length === 0) return null
  return (
    <>
      <Button variante="contorno" misura="piccolo" className="self-start" disabled={!connesso} onClick={() => setAperta(true)}>
        <Copy /> Copia in un&apos;altra Famiglia
      </Button>
      {aperta ? <FinestraCopiaInFamiglia piatto={piatto} famiglie={altre} origine={piatto.famiglia.nome} onChiudi={() => setAperta(false)} /> : null}
    </>
  )
}

function FinestraCopiaInFamiglia({
  piatto,
  famiglie,
  origine,
  pubblica = false,
  onChiudi,
}: {
  piatto: DettaglioPiatto
  famiglie: { id: string; nome: string }[]
  origine: string
  /** Da una pubblica la Famiglia d'origine si ricorda sempre (è già nota a tutti). */
  pubblica?: boolean
  onChiudi: () => void
}) {
  const naviga = useNavigate()
  const [gruppoId, setGruppoId] = useState(famiglie[0]!.id)
  const [indica, setIndica] = useState(false)
  const copia = useScrittura(() => api.crea<DettaglioPiatto>(`/piatti/${piatto.id}/copia-in-famiglia`, { id: nuovoId(), gruppoId, indicaFamiglia: indica }), {
    successo: 'Copia creata',
    dopo: (c) => {
      onChiudi()
      naviga(`/ricettario/${c.id}`)
    },
  })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Copia «${piatto.nome}»`}
      descrizione="Nasce una nuova ricetta tua, privata, nella Famiglia che scegli, con ingredienti, procedimento e foto. È indipendente: le modifiche all'originale non la cambiano, e voti e commenti non la seguono. Poi puoi condividerla con la Famiglia o pubblicarla."
      piede={
        <Button disabled={copia.inCorso} onClick={() => void copia.esegui(undefined)}>
          <Copy /> Copia
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Nella Famiglia" htmlFor="copia-famiglia">
          <Select id="copia-famiglia" value={gruppoId} onChange={(e) => setGruppoId(e.target.value)}>
            {famiglie.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </Campo>
        {pubblica ? (
          <p className="text-sm text-testo-tenue">La copia ricorda che viene da «{origine}».</p>
        ) : (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Casella checked={indica} onChange={(e) => setIndica(e.target.checked)} /> Indica che viene da «{origine}»
          </label>
        )}
      </div>
    </Finestra>
  )
}

/** Provenienza di una copia da un'altra Famiglia: solo informazione, nessun collegamento. */
export function ProvenienzaRicetta({ provenienza: p }: { provenienza: Provenienza }) {
  const quando = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(p.copiataIl)
  return (
    <p className="flex items-center gap-1.5 text-xs text-testo-tenue" data-testid="provenienza-ricetta">
      <History className="size-3.5" /> Copiata il {quando} da {p.copiataDa} da {p.famiglia ? `«${p.famiglia}»` : "un'altra Famiglia"}
      {p.titolo ? ` (era «${p.titolo}»)` : ''}
    </p>
  )
}

