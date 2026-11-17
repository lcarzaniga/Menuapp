// Chi porta cosa (SPEC §20.5): piatti del menù e cose da portare, chi se ne occupa, stato.
// La responsabilità di un piatto è la stessa «A cura di» del menù.
import { AlertTriangle, CheckCircle2, Circle, HandHeart, Plus, ShoppingBasket, Undo2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'
import { Card, CardContent } from '@/components/ui/card'
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
      <ul className="flex flex-col gap-2">
        {incarichi.map((i) => (
          <li key={`${i.tipo}-${i.id}`} id={`incarico-${i.tipo}:${i.id}`}>
            <Riga i={i} d={d} evidenziato={evidenziato === `${i.tipo}:${i.id}`} />
          </li>
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
  const [togli, setTogli] = useState(true)
  const opzioni = { oggetto: `«${i.nome}»`, successo: null }
  const azione = useScrittura((a: { verbo: 'prendi' | 'rinuncia' | 'completa' | 'assegna'; corpo: Record<string, unknown> }) => api.crea<Incarico>(`${percorso(i)}/${a.verbo}`, { versione: i.versione, ...a.corpo }), opzioni)
  const elimina = useScrittura(() => api.elimina(percorso(i), i.versione), { successo: 'Eliminata' })
  const mio = i.incaricatoId !== null && i.incaricatoId === utente?.id
  return (
    <Card className={cn(i.stato === 'completato' && 'opacity-75', evidenziato && 'ring-2 ring-primario/50')} data-testid="incarico">
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
        {i.stato === 'completato' ? <CheckCircle2 className="size-5 shrink-0 text-successo" /> : <Circle className={cn('size-5 shrink-0', i.stato === 'assegnato' ? 'text-primario' : 'text-bordo')} />}
        {/* Su telefono i comandi vanno a capo sotto il testo, che resta leggibile. */}
        <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-auto">
          <p className="font-medium">
            {i.nome}
            {quantita(i) ? <span className="text-testo-tenue"> · {quantita(i)}</span> : null}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-testo-tenue">
            {i.portata ? <span>{i.portata}</span> : null}
            {i.incaricato ? (
              <Badge variante={mio ? 'primario' : 'neutro'} title={i.incaricatoId ? undefined : 'Non usa l\'app'}>
                <UserRound className="size-3" /> {mio ? 'tu' : i.incaricato}
                {!i.incaricatoId ? <span className="opacity-70"> · senza app</span> : null}
              </Badge>
            ) : (
              <Badge variante="avviso">da assegnare</Badge>
            )}
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
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto">
          {i.puoPrendere ? (
            <Button misura="piccolo" disabled={!connesso || azione.inCorso} onClick={() => (i.tipo === 'voce' && i.inSpesa ? setPrendi(true) : void azione.esegui({ verbo: 'prendi', corpo: {} }))}>
              <HandHeart /> Me ne occupo io
            </Button>
          ) : null}
          {i.puoCompletare && i.stato !== 'completato' ? (
            <Button misura="piccolo" variante="contorno" disabled={!connesso} onClick={() => void azione.esegui({ verbo: 'completa', corpo: { completato: true } })}>
              <CheckCircle2 /> Fatto
            </Button>
          ) : null}
          {d.puoAssegnare ? (
            <Button misura="piccolo" variante="contorno" disabled={!connesso} onClick={() => setAffida(true)}>
              <UserRound /> {i.incaricato ? 'Cambia' : 'Affida'}
            </Button>
          ) : null}
          <MenuAzioni
            etichetta={`Altre azioni su «${i.nome}»`}
            voci={[
              { etichetta: 'Rinuncio', icona: <Undo2 />, onSelect: () => void azione.esegui({ verbo: 'rinuncia', corpo: {} }), nascosta: !i.puoRinunciare || !mio },
              { etichetta: 'Libera l\'incarico', icona: <Undo2 />, onSelect: () => void azione.esegui({ verbo: 'rinuncia', corpo: {} }), nascosta: !i.puoRinunciare || mio },
              { etichetta: 'Non ancora fatto', onSelect: () => void azione.esegui({ verbo: 'completa', corpo: { completato: false } }), nascosta: !i.puoCompletare || i.stato !== 'completato' },
              { etichetta: 'Modifica', onSelect: () => setModifica(true), nascosta: i.tipo !== 'cosa' || !i.puoGestire },
              { etichetta: 'Elimina', onSelect: () => void elimina.esegui(undefined), pericolosa: true, nascosta: i.tipo !== 'cosa' || !i.puoGestire },
            ]}
          />
        </div>
      </CardContent>
      {affida ? <Affida i={i} d={d} onChiudi={() => setAffida(false)} /> : null}
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
    </Card>
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
