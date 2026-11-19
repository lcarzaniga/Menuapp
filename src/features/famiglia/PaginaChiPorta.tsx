// Chi porta cosa (SPEC §20.5): piatti del menù e cose da portare, chi se ne occupa, stato.
// La responsabilità di un piatto è la stessa «A cura di» del menù.
import { AlertTriangle, CheckCircle2, Circle, HandHeart, PencilLine, Plus, ShoppingBasket, Undo2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useMenu } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import type { Incarichi, Incarico } from '@/contratto/famiglia.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useUtenteCorrente } from '@/features/accesso/sessione'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { useEvidenzia } from '@/lib/evidenzia'
import { cn } from '@/lib/utils'
import { useIncarichi } from './api'

const percorso = (i: Incarico) => `/${i.tipo === 'voce' ? 'voci' : 'cose'}/${i.id}`

export function PaginaChiPorta() {
  const e = useEventoCorrente()
  const q = useIncarichi(e.id)
  const [nuova, setNuova] = useState(false)
  const [contributo, setContributo] = useState(false)
  // Da una notifica: ?incarico=voce:<id> o cosa:<id>.
  const { id: evidenziato, mancante } = useEvidenzia('incarico', 'incarico-', Boolean(q.data))
  if (q.isPending) return <Caricamento />
  if (!q.data) return <CorpoScheda>Impossibile caricare gli incarichi.</CorpoScheda>
  const d = q.data
  const liberi = d.incarichi.filter((i) => i.stato === 'da_assegnare').length
  return (
    <CorpoScheda>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-testo-tenue">
          {liberi ? (
            <>
              <strong className="text-testo">{liberi}</strong> {liberi === 1 ? 'cosa' : 'cose'} ancora da assegnare
            </>
          ) : (
            'Tutto ha qualcuno che se ne occupa'
          )}
        </p>
        {d.puoAssegnare ? (
          <Button variante="contorno" misura="piccolo" onClick={() => setContributo(true)}>
            <Plus /> Piatto a scelta
          </Button>
        ) : null}
        {d.puoPartecipare ? (
          <Button variante="contorno" misura="piccolo" onClick={() => setNuova(true)}>
            <Plus /> Cosa da portare
          </Button>
        ) : null}
      </div>
      {mancante ? (
        <p role="status" className="mb-3 rounded-xl bg-tenue px-3 py-2 text-sm text-testo-tenue">
          L'elemento della notifica non c'è più: forse è stato tolto dal menù o dall'elenco.
        </p>
      ) : null}
      {d.incarichi.length === 0 ? (
        <Vuoto illustrazione="taccuino" titolo="Niente da organizzare, per ora" testo="I piatti del menù compaiono qui; aggiungi anche vino, pane, bibite o altro da portare." />
      ) : (
        <div className="flex flex-col gap-4">
          <Sezione titolo="Dal menù" incarichi={d.incarichi.filter((i) => i.tipo === 'voce')} d={d} evidenziato={evidenziato} />
          <Sezione titolo="Da portare" incarichi={d.incarichi.filter((i) => i.tipo === 'cosa')} d={d} evidenziato={evidenziato} />
        </div>
      )}
      <NuovaCosa eventoId={e.id} aperta={nuova} onCambia={setNuova} />
      {contributo ? <NuovoContributo eventoId={e.id} onChiudi={() => setContributo(false)} /> : null}
    </CorpoScheda>
  )
}

function Sezione({ titolo, incarichi, d, evidenziato }: { titolo: string; incarichi: Incarico[]; d: Incarichi; evidenziato: string | null }) {
  if (!incarichi.length) return null
  return (
    <section aria-label={titolo}>
      <h2 className="mb-2 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-testo-tenue">
        {titolo} <span className="filetto flex-1" />
      </h2>
      <ul className="flex flex-col divide-y divide-bordo/60 overflow-hidden rounded-2xl border border-bordo/70 bg-carta shadow-carta" aria-label={titolo}>
        {incarichi.map((i) => (
          <Riga key={`${i.tipo}-${i.id}`} i={i} d={d} evidenziato={evidenziato === `${i.tipo}:${i.id}`} />
        ))}
      </ul>
    </section>
  )
}

function Riga({ i, d, evidenziato }: { i: Incarico; d: Incarichi; evidenziato: boolean }) {
  const connesso = useStatoConnessione() === 'connesso'
  const { utente } = useUtenteCorrente()
  const [prendi, setPrendi] = useState(false)
  const [affida, setAffida] = useState(false)
  const [modifica, setModifica] = useState(false)
  const [precisa, setPrecisa] = useState(false)
  const [togli, setTogli] = useState(true)
  const opzioni = { oggetto: `«${i.nome}»`, successo: null }
  const azione = useScrittura((a: { verbo: 'prendi' | 'rinuncia' | 'completa' | 'assegna'; corpo: Record<string, unknown> }) => api.crea<Incarico>(`${percorso(i)}/${a.verbo}`, { versione: i.versione, ...a.corpo }), opzioni)
  const elimina = useScrittura(() => api.elimina(percorso(i), i.versione), { successo: 'Eliminata' })
  const mio = i.incaricatoId !== null && i.incaricatoId === utente?.id
  return (
    <li
      id={`incarico-${i.tipo}:${i.id}`}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5', i.stato === 'completato' && 'bg-tenue/40', evidenziato && 'ring-2 ring-inset ring-primario/50')}
      data-testid="incarico"
    >
        {i.stato === 'completato' ? <CheckCircle2 className="size-5 shrink-0 text-successo" /> : <Circle className={cn('size-5 shrink-0', i.stato === 'assegnato' ? 'text-primario' : 'text-bordo')} />}
        {/* Su telefono i comandi possono andare a capo sotto il testo, che resta leggibile. */}
        <div className="min-w-0 flex-1 basis-40">
          <p className={cn('font-medium', i.stato === 'completato' && 'text-testo-tenue line-through decoration-1')}>
            {i.contributi > 1 ? `${i.contributi} × ` : ''}
            {i.nome}
            {quantita(i) ? <span className="text-testo-tenue"> · {quantita(i)}</span> : null}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-testo-tenue">
            {i.portata ? <span>{i.portata}</span> : null}
            {i.daDefinire ? <Badge variante="neutro">a scelta di chi lo porta</Badge> : null}
            {i.incaricato ? (
              <Badge variante={mio ? 'primario' : 'neutro'} title={i.incaricatoId ? undefined : 'Non usa l\'app'}>
                <UserRound className="size-3" /> {mio ? 'tu' : i.incaricato}
                {!i.incaricatoId ? <span className="opacity-70"> · senza app</span> : null}
              </Badge>
            ) : (
              <Badge variante="avviso">da assegnare</Badge>
            )}
            {/* Evento duplicato (SPEC §25): chi se ne occupava nell'originale, solo come promemoria. */}
            {!i.incaricato && i.precedente ? <span data-testid="incarico-precedente">l&apos;ultima volta: {i.precedente.nome}</span> : null}
            {i.stato === 'completato' ? <Badge variante="successo">fatto</Badge> : null}
            {i.responsabileAssente ? (
              <Badge variante="avviso" role="note">
                <AlertTriangle className="size-3" /> non partecipa
              </Badge>
            ) : null}
            {i.tipo === 'voce' && i.inSpesa === false ? (
              <span className="flex items-center gap-1">
                <ShoppingBasket className="size-3" /> fuori dalla spesa
              </span>
            ) : null}
            {i.note ? <span>· {i.note}</span> : null}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {i.puoPrendere ? (
            <Button misura="piccolo" disabled={!connesso || azione.inCorso} onClick={() => (i.tipo === 'voce' && i.inSpesa ? setPrendi(true) : void azione.esegui({ verbo: 'prendi', corpo: {} }))}>
              <HandHeart /> Me ne occupo io
            </Button>
          ) : null}
          {i.daDefinire && (d.puoAssegnare || mio) ? (
            <Button misura="piccolo" variante="contorno" disabled={!connesso} onClick={() => setPrecisa(true)}>
              <PencilLine /> Precisa
            </Button>
          ) : null}
          {i.puoCompletare && i.stato !== 'completato' ? (
            <Button misura="piccolo" variante="contorno" disabled={!connesso} onClick={() => void azione.esegui({ verbo: 'completa', corpo: { completato: true } })}>
              <CheckCircle2 /> Fatto
            </Button>
          ) : null}
          {d.puoAssegnare && !i.incaricato && i.precedente ? (
            <Button
              misura="piccolo"
              variante="contorno"
              disabled={!connesso || azione.inCorso}
              onClick={() => {
                const p = i.precedente!
                // A chi se ne occupava: con l'app se vede l'evento, dalla rubrica, o per nome.
                void azione.esegui({ verbo: 'assegna', corpo: p.utenteId ? { utenteId: p.utenteId } : p.esternoId ? { esternoId: p.esternoId } : { nome: p.nome } })
              }}
            >
              <UserRound /> Affida a {i.precedente.nome}
            </Button>
          ) : null}
          {d.puoAssegnare && !i.incaricato ? (
            <Button misura="piccolo" variante="contorno" disabled={!connesso} onClick={() => setAffida(true)}>
              <UserRound /> {i.precedente ? 'Affida ad altri' : 'Affida'}
            </Button>
          ) : null}
          <MenuAzioni
            etichetta={`Altre azioni su «${i.nome}»`}
            voci={[
              { etichetta: 'Cambia responsabile', icona: <UserRound />, onSelect: () => setAffida(true), nascosta: !d.puoAssegnare || !i.incaricato, disabilitata: !connesso },
              { etichetta: 'Rinuncio', icona: <Undo2 />, onSelect: () => void azione.esegui({ verbo: 'rinuncia', corpo: {} }), nascosta: !i.puoRinunciare || !mio },
              { etichetta: 'Libera l\'incarico', icona: <Undo2 />, onSelect: () => void azione.esegui({ verbo: 'rinuncia', corpo: {} }), nascosta: !i.puoRinunciare || mio },
              { etichetta: 'Non ancora fatto', onSelect: () => void azione.esegui({ verbo: 'completa', corpo: { completato: false } }), nascosta: !i.puoCompletare || i.stato !== 'completato' },
              { etichetta: 'Modifica', onSelect: () => setModifica(true), nascosta: i.tipo !== 'cosa' || !i.puoGestire },
              { etichetta: 'Elimina', onSelect: () => void elimina.esegui(undefined), pericolosa: true, nascosta: i.tipo !== 'cosa' || !i.puoGestire },
            ]}
          />
        </div>
      {affida ? <Affida i={i} d={d} onChiudi={() => setAffida(false)} /> : null}
      {precisa ? <Precisa i={i} onChiudi={() => setPrecisa(false)} /> : null}
      {modifica ? <ModificaCosa i={i} onChiudi={() => setModifica(false)} /> : null}
      <Finestra
        aperta={prendi}
        onCambia={setPrendi}
        titolo={`Ti occupi di «${i.nome}»`}
        descrizione="Se lo porti già pronto, gli ingredienti escono dalla spesa dell'evento. Se poi rinunci, tornano nella spesa."
        piede={
          <Button
            onClick={() => {
              setPrendi(false)
              void azione.esegui({ verbo: 'prendi', corpo: { togliDallaSpesa: togli } })
            }}
          >
            <HandHeart /> Me ne occupo io
          </Button>
        }
      >
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={togli} onChange={(ev) => setTogli(ev.target.checked)} /> Porto tutto io: togli gli ingredienti dalla spesa
        </label>
      </Finestra>
    </li>
  )
}

/** «4 bottiglie», «per 10» (porzioni del piatto) o la vecchia quantità scritta. */
function quantita(i: Incarico): string {
  if (i.quantitaNumero !== null) return `${i.quantitaNumero.toLocaleString('it-IT')}${i.unita ? ` ${i.unita}` : ''}`
  if (i.porzioni !== null) return `per ${i.porzioni.toLocaleString('it-IT')}`
  return i.quantita
}

const ALTRO = '__altro__'

/** Chi organizza affida l'incarico: a chi usa l'app, a una persona della rubrica o a un nome. */
function Affida({ i, d, onChiudi }: { i: Incarico; d: Incarichi; onChiudi: () => void }) {
  const iniziale = i.incaricatoId ? `u:${i.incaricatoId}` : i.incaricatoEsternoId ? `e:${i.incaricatoEsternoId}` : ''
  const [scelta, setScelta] = useState(iniziale)
  const [nome, setNome] = useState('')
  const [salva, setSalva] = useState(Boolean(d.famigliaId))
  const [note, setNote] = useState(i.note)
  const [togli, setTogli] = useState(i.tipo === 'voce' && i.spesaToltaDaIncarico)
  const affida = useScrittura(
    () => {
      const chi =
        scelta === ALTRO
          ? { nome: nome.trim(), salvaInRubrica: salva }
          : scelta.startsWith('u:')
            ? { utenteId: scelta.slice(2) }
            : scelta.startsWith('p:')
              ? { partecipanteId: scelta.slice(2) }
              : { esternoId: scelta.slice(2) }
      return api.crea<Incarico>(`${percorso(i)}/assegna`, { versione: i.versione, ...chi, note, togliDallaSpesa: togli })
    },
    { oggetto: `«${i.nome}»`, successo: (x) => `Affidato a ${x.incaricato}`, dopo: onChiudi },
  )
  const pronto = scelta === ALTRO ? nome.trim() !== '' : scelta !== ''
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Chi si occupa di «${i.nome}»?`}
      descrizione="Anche chi non usa l'app: zii, nonni, amici. Sono solo nomi, senza accesso all'app."
      piede={
        <Button disabled={!pronto || affida.inCorso} onClick={() => void affida.esegui(undefined)}>
          Affida
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Persona" htmlFor="affida-chi">
          <Select id="affida-chi" value={scelta} onChange={(e) => setScelta(e.target.value)}>
            <option value="">Scegli…</option>
            {d.partecipanti.length ? (
              <optgroup label="Partecipanti">
                {d.partecipanti.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    {p.nome}
                    {p.assente ? ' (non partecipa)' : ''}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {d.persone.length ? (
              <optgroup label="Con l'app">
                {d.persone.map((p) => (
                  <option key={p.id} value={`u:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {d.rubrica.length ? (
              <optgroup label="Senza app (rubrica)">
                {d.rubrica.map((p) => (
                  <option key={p.id} value={`e:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={ALTRO}>Un altro nome…</option>
          </Select>
        </Campo>
        {scelta === ALTRO ? (
          <>
            <Campo etichetta="Nome" htmlFor="affida-nome">
              <Input id="affida-nome" value={nome} maxLength={80} placeholder="Es. Zio Marco" onChange={(e) => setNome(e.target.value)} autoFocus />
            </Campo>
            {d.famigliaId ? (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Casella checked={salva} onChange={(e) => setSalva(e.target.checked)} /> Salva nella rubrica della Famiglia
              </label>
            ) : null}
          </>
        ) : null}
        <Campo etichetta="Note (facoltative)" htmlFor="affida-note">
          <Input id="affida-note" value={note} maxLength={200} placeholder="Es. per 10 persone, senza glutine" onChange={(e) => setNote(e.target.value)} />
        </Campo>
        {i.tipo === 'voce' && (i.inSpesa || i.spesaToltaDaIncarico) ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Casella checked={togli} onChange={(e) => setTogli(e.target.checked)} /> Lo porta già pronto: togli gli ingredienti dalla spesa
          </label>
        ) : null}
      </div>
    </Finestra>
  )
}

function CampiQuantita({ numero, unita, onNumero, onUnita }: { numero: string; unita: string; onNumero: (v: string) => void; onUnita: (v: string) => void }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <Campo etichetta="Quantità" htmlFor="cosa-numero">
        <Input id="cosa-numero" inputMode="decimal" value={numero} placeholder="4" onChange={(e) => onNumero(e.target.value)} />
      </Campo>
      <Campo etichetta="Unità" htmlFor="cosa-unita">
        <Input id="cosa-unita" value={unita} maxLength={30} placeholder="bottiglie" onChange={(e) => onUnita(e.target.value)} />
      </Campo>
    </div>
  )
}

const numeroDa = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null
}

function ModificaCosa({ i, onChiudi }: { i: Incarico; onChiudi: () => void }) {
  const [nome, setNome] = useState(i.nome)
  const [numero, setNumero] = useState(i.quantitaNumero?.toLocaleString('it-IT') ?? '')
  const [unita, setUnita] = useState(i.unita)
  const [note, setNote] = useState(i.note)
  const salva = useScrittura(
    () => api.modifica<Incarico>(`/cose/${i.id}`, { nome: nome.trim(), quantita: i.quantita, quantitaNumero: numeroDa(numero), unita, note, versione: i.versione }),
    { oggetto: `«${i.nome}»`, successo: 'Salvato', dopo: onChiudi },
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Modifica"
      piede={
        <Button disabled={!nome.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Cosa" htmlFor="mod-cosa-nome">
          <Input id="mod-cosa-nome" value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <CampiQuantita numero={numero} unita={unita} onNumero={setNumero} onUnita={setUnita} />
        <Campo etichetta="Note" htmlFor="mod-cosa-note">
          <Input id="mod-cosa-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Campo>
      </div>
    </Finestra>
  )
}

/**
 * Piatto a scelta (SPEC §39): «un primo a scelta», «due antipasti a scelta». È una voce del menù
 * «da definire», lo stesso record che Chi porta assegna; senza ricetta e fuori dalla spesa.
 */
function NuovoContributo({ eventoId, onChiudi }: { eventoId: string; onChiudi: () => void }) {
  const menu = useMenu(eventoId)
  const portate = menu.data?.portate ?? []
  const [portataId, setPortataId] = useState('')
  const scelta = portate.find((p) => p.id === portataId) ?? portate[0]
  const [nome, setNome] = useState('')
  const [quanti, setQuanti] = useState('1')
  const [prendo, setPrendo] = useState(false)
  const descrizione = nome.trim() || (scelta ? `${scelta.nome} a scelta` : '')
  const crea = useScrittura(
    async () => {
      const id = nuovoId()
      const [v] = await api.crea<{ id: string; versione: number }[]>(`/eventi/${eventoId}/voci`, {
        voci: [{ id, portataId: scelta!.id, nome: descrizione, daDefinire: true, contributi: Math.min(99, Math.max(1, Number(quanti) || 1)) }],
      })
      if (prendo && v) await api.crea(`/voci/${id}/prendi`, { versione: v.versione })
    },
    { successo: 'Aggiunto: compare anche nel menù', dopo: onChiudi },
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Piatto a scelta"
      descrizione="Per chi porta «un primo a sua scelta»: nel menù compare come «da definire» con chi se ne occupa. Non serve una ricetta e non entra nella spesa; chi lo porta potrà precisarlo."
      piede={
        <Button disabled={!scelta || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
          Aggiungi
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Portata" htmlFor="contributo-portata">
          <Select id="contributo-portata" value={scelta?.id ?? ''} onChange={(e) => setPortataId(e.target.value)}>
            {portate.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etichetta="Descrizione (facoltativa)" htmlFor="contributo-nome">
          <Input id="contributo-nome" value={nome} maxLength={200} placeholder={scelta ? `${scelta.nome} a scelta` : ''} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo etichetta="Quanti" htmlFor="contributo-quanti">
          <Input id="contributo-quanti" type="number" inputMode="numeric" min={1} max={99} className="w-28" value={quanti} onChange={(e) => setQuanti(e.target.value)} />
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={prendo} onChange={(e) => setPrendo(e.target.checked)} /> Me ne occupo io (altrimenti lo affidi dopo)
        </label>
      </div>
    </Finestra>
  )
}

/** Precisare il piatto scelto: stesso incarico, stessa riga del menù (SPEC §39). */
function Precisa({ i, onChiudi }: { i: Incarico; onChiudi: () => void }) {
  const [nome, setNome] = useState('')
  const salva = useScrittura(() => api.crea<Incarico>(`/voci/${i.id}/precisa`, { versione: i.versione, nome: nome.trim() }), {
    oggetto: `«${i.nome}»`,
    successo: (r) => `Ora è «${r.nome}»`,
    dopo: onChiudi,
  })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Precisa «${i.nome}»`}
      descrizione={`Quale piatto${i.incaricato ? ` porta ${i.incaricato}` : ''}? Nel menù prende questo nome; chi lo porta e le note restano. Una ricetta si può collegare poi dal menù.`}
      piede={
        <Button disabled={!nome.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <Campo etichetta="Piatto" htmlFor="precisa-nome">
        <Input id="precisa-nome" value={nome} maxLength={200} placeholder="Es. Lasagne alla bolognese" onChange={(e) => setNome(e.target.value)} autoFocus />
      </Campo>
    </Finestra>
  )
}

function NuovaCosa({ eventoId, aperta, onCambia }: { eventoId: string; aperta: boolean; onCambia: (a: boolean) => void }) {
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  const [unita, setUnita] = useState('')
  const [note, setNote] = useState('')
  const [prendo, setPrendo] = useState(true)
  const crea = useScrittura(() => api.crea<Incarico>(`/eventi/${eventoId}/cose`, { id: nuovoId(), nome: nome.trim(), quantitaNumero: numeroDa(numero), unita, note, prendo }), {
    successo: 'Aggiunta',
    dopo: () => {
      setNome('')
      setNumero('')
      setUnita('')
      setNote('')
      onCambia(false)
    },
  })
  return (
    <Finestra
      aperta={aperta}
      onCambia={onCambia}
      titolo="Cosa da portare"
      descrizione="Vino, pane, bibite, ghiaccio, un dolce comprato… Non entra nella spesa del menù."
      piede={
        <Button disabled={!nome.trim() || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
          Aggiungi
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Cosa" htmlFor="cosa-nome">
          <Input id="cosa-nome" value={nome} maxLength={200} placeholder="Es. Vino rosso" onChange={(e) => setNome(e.target.value)} autoFocus />
        </Campo>
        <CampiQuantita numero={numero} unita={unita} onNumero={setNumero} onUnita={setUnita} />
        <Campo etichetta="Note (facoltative)" htmlFor="cosa-note">
          <Input id="cosa-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={prendo} onChange={(e) => setPrendo(e.target.checked)} /> Me ne occupo io
        </label>
      </div>
    </Finestra>
  )
}
