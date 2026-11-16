// Evento — Partecipanti: elenco facoltativo, conferme, accompagnatori e coperti (SPEC §24).
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Plus, UserRound, Users } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Contatore } from '@/components/Contatore'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import { useStatoConnessione } from '@/connessione/stato'
import type { Invito, Partecipante, Partecipanti } from '@/contratto/partecipanti.ts'
import type { Evento } from '@/domain/tipi.ts'
import { type Anonimi, type CategoriaPersona, type StatoPresenza, totaleAnonimi } from '@/domain/partecipanti.ts'
import { copertiEquivalenti, formattaCoperti } from '@/domain/porzioni.ts'
import { plurale } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'

export const chiavePartecipanti = (eventoId: string) => ['partecipanti', eventoId] as const
export const usePartecipanti = (eventoId: string) =>
  useQuery({ queryKey: chiavePartecipanti(eventoId), queryFn: () => api.leggi<Partecipanti>(`/eventi/${eventoId}/partecipanti`) })

const STATI: { stato: StatoPresenza; etichetta: string }[] = [
  { stato: 'in_attesa', etichetta: 'In attesa' },
  { stato: 'confermato', etichetta: 'Confermato' },
  { stato: 'assente', etichetta: 'Non partecipa' },
]
const VARIANTE_STATO = { in_attesa: 'neutro', confermato: 'successo', assente: 'pericolo' } as const
const NOME_STATO = { in_attesa: 'in attesa', confermato: 'confermato', assente: 'non partecipa' } as const

/** «2 adulti, 1 bambino». */
const persone = (adulti: number, bambini: number) =>
  [adulti ? plurale(adulti, 'adulto', 'adulti') : '', bambini ? plurale(bambini, 'bambino', 'bambini') : ''].filter(Boolean).join(', ') || 'nessuno'

export function PaginaPartecipanti() {
  const e = useEventoCorrente()
  const q = usePartecipanti(e.id)
  const [aggiungi, setAggiungi] = useState(false)
  const [coperti, setCoperti] = useState(false)
  if (q.isPending) return <Caricamento />
  if (!q.data) return null
  const d = q.data
  const mio = d.inviti.find((i) => i.id === d.mioInvitoId)
  return (
    <CorpoScheda>
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="size-5 text-primario" />
              <p className="flex-1 font-semibold">
                {formattaCoperti(copertiEquivalenti(e))} coperti
                <span className="font-normal text-testo-tenue"> · {d.copertiAutomatici ? 'calcolati dai partecipanti' : 'manuali'}</span>
              </p>
              {d.puoGestire ? (
                <Button misura="piccolo" variante="contorno" onClick={() => setCoperti(true)}>
                  Cambia
                </Button>
              ) : null}
            </div>
            {d.inviti.length ? (
              <p className="text-sm text-testo-tenue" data-testid="conteggio-partecipanti">
                Confermati: {persone(d.conteggio.adulti.confermati, d.conteggio.bambini.confermati)}
                {d.conteggio.adulti.inAttesa + d.conteggio.bambini.inAttesa ? ` · in attesa: ${persone(d.conteggio.adulti.inAttesa, d.conteggio.bambini.inAttesa)}` : ''}
                {d.conteggio.adulti.assenti + d.conteggio.bambini.assenti ? ` · non partecipano: ${d.conteggio.adulti.assenti + d.conteggio.bambini.assenti}` : ''}
              </p>
            ) : null}
            {!d.copertiAutomatici && d.inviti.length ? (
              <p className="text-xs text-testo-tenue">Porzioni e spesa seguono i numeri scritti a mano ({persone(d.copertiManuali.adulti, d.copertiManuali.bambini)}).</p>
            ) : null}
          </CardContent>
        </Card>

        {mio && !d.solaLettura ? <MioInvito invito={mio} d={d} eventoId={e.id} /> : null}

        {d.puoGestire ? (
          <Button variante="contorno" className="self-start" onClick={() => setAggiungi(true)}>
            <Plus /> Aggiungi partecipante
          </Button>
        ) : null}

        {d.inviti.length === 0 ? (
          <Vuoto
            titolo="Nessun partecipante"
            testo={
              d.puoGestire
                ? 'L\'elenco è facoltativo: puoi aggiungere chi è invitato (anche chi non usa l\'app) e segnare chi conferma. I coperti possono restare scritti a mano.'
                : 'Chi organizza non ha ancora indicato i partecipanti.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Partecipanti">
            {d.inviti.map((i) => (
              <li key={i.id}>
                <RigaInvito invito={i} d={d} eventoId={e.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {aggiungi ? <FinestraPersona eventoId={e.id} d={d} onChiudi={() => setAggiungi(false)} /> : null}
      {coperti ? <FinestraCoperti evento={e} d={d} onChiudi={() => setCoperti(false)} /> : null}
    </CorpoScheda>
  )
}

/** Tre stati come pulsanti affiancati. */
function SceltaStato({ valore, onScegli, nome, disabilitata, etichette }: { valore: StatoPresenza; onScegli: (s: StatoPresenza) => void; nome: string; disabilitata?: boolean; etichette?: Partial<Record<StatoPresenza, string>> }) {
  return (
    <div role="group" aria-label={`Presenza di ${nome}`} className="inline-flex overflow-hidden rounded-full border border-bordo text-xs">
      {STATI.map((s) => (
        <button
          key={s.stato}
          type="button"
          aria-pressed={valore === s.stato}
          disabled={disabilitata}
          onClick={() => valore !== s.stato && onScegli(s.stato)}
          className={cn(
            'min-h-9 px-2.5 font-medium disabled:opacity-60',
            valore === s.stato && (s.stato === 'confermato' ? 'bg-successo text-white' : s.stato === 'assente' ? 'bg-pericolo text-white' : 'bg-tenue text-testo'),
          )}
        >
          {etichette?.[s.stato] ?? s.etichetta}
        </button>
      ))}
    </div>
  )
}

const corpoPersona = (p: Partecipante, extra: Partial<Pick<Partecipante, 'stato' | 'categoria' | 'nome' | 'note'>> = {}) => ({
  nome: p.nome,
  categoria: p.categoria,
  stato: p.stato,
  note: p.note,
  versione: p.versione,
  ...extra,
})

function useCambiaStato(p: Partecipante) {
  return useScrittura((stato: StatoPresenza) => api.modifica<Partecipante>(`/partecipanti/${p.id}`, corpoPersona(p, { stato })), { oggetto: p.nome, successo: null })
}

/** «porta: Vino» e, se non viene, l'avviso: l'incarico resta finché qualcuno non lo cambia. */
function Incarichi({ p }: { p: Partecipante }) {
  if (!p.incarichi.length) return null
  return p.stato === 'assente' ? (
    <p className="flex items-center gap-1 text-xs text-avviso" role="note">
      <AlertTriangle className="size-3.5" /> Non partecipa ma ha un incarico: {p.incarichi.join(', ')}
    </p>
  ) : (
    <p className="text-xs text-testo-tenue">Porta: {p.incarichi.join(', ')}</p>
  )
}

function RigaInvito({ invito: i, d, eventoId }: { invito: Invito; d: Partecipanti; eventoId: string }) {
  const connesso = useStatoConnessione() === 'connesso'
  const stato = useCambiaStato(i)
  const [modifica, setModifica] = useState<Partecipante | null>(null)
  const [accompagnatori, setAccompagnatori] = useState(false)
  const togli = useScrittura((p: Partecipante) => api.elimina(`/partecipanti/${p.id}`, p.versione), { successo: 'Tolto dall\'elenco' })
  const autonomo = useScrittura((p: Partecipante) => api.crea(`/partecipanti/${p.id}/autonomo`, { versione: p.versione }), { successo: 'Ora ha un invito suo' })
  const gestisce = d.puoGestire
  const anonimi = totaleAnonimi(i.anonimi)
  return (
    <Card data-testid="invito">
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <UserRound className="size-4 shrink-0 text-testo-tenue" />
          <p className="min-w-0 flex-1 font-medium">
            {i.nome}
            {i.categoria === 'bambino' ? <span className="text-sm font-normal text-testo-tenue"> · bambino</span> : null}
            {!i.utenteId ? <span className="text-xs font-normal text-testo-tenue"> · senza app</span> : null}
          </p>
          {gestisce ? null : <Badge variante={VARIANTE_STATO[i.stato]}>{NOME_STATO[i.stato]}</Badge>}
          <MenuAzioni
            etichetta={`Azioni per ${i.nome}`}
            voci={[
              { etichetta: 'Aggiungi accompagnatori', onSelect: () => setAccompagnatori(true), nascosta: !gestisce, disabilitata: !connesso },
              { etichetta: 'Modifica', onSelect: () => setModifica(i), nascosta: !gestisce, disabilitata: !connesso },
              { etichetta: 'Togli dall\'elenco', onSelect: () => void togli.esegui(i), pericolosa: true, nascosta: !gestisce, disabilitata: !connesso },
            ]}
          />
          {/* Su una riga a sé: sul telefono il nome resta leggibile. */}
          {gestisce ? (
            <div className="basis-full pl-6">
              <SceltaStato valore={i.stato} nome={i.nome} disabilitata={!connesso || stato.inCorso} onScegli={(s) => void stato.esegui(s)} />
            </div>
          ) : null}
        </div>
        {i.note ? <p className="text-sm text-testo-tenue">{i.note}</p> : null}
        <Incarichi p={i} />
        {i.accompagnatori.length || anonimi ? (
          <ul className="ml-6 flex flex-col gap-1.5 border-l border-bordo pl-3" aria-label={`Accompagnatori di ${i.nome}`}>
            {i.accompagnatori.map((a) => (
              <RigaAccompagnatore key={a.id} a={a} gestisce={gestisce} onModifica={() => setModifica(a)} onTogli={() => void togli.esegui(a)} onAutonomo={() => void autonomo.esegui(a)} />
            ))}
            {anonimi ? <li className="text-sm text-testo-tenue">{descriviAnonimi(i.anonimi)}</li> : null}
          </ul>
        ) : null}
      </CardContent>
      {modifica ? <FinestraModifica p={modifica} gestisce={gestisce} onChiudi={() => setModifica(null)} /> : null}
      {accompagnatori ? <FinestraAccompagnatori invito={i} eventoId={eventoId} d={d} onChiudi={() => setAccompagnatori(false)} /> : null}
    </Card>
  )
}

function descriviAnonimi(a: Anonimi): string {
  const parti = [
    a.adultiConfermati + a.bambiniConfermati ? `${persone(a.adultiConfermati, a.bambiniConfermati)} (${a.adultiConfermati + a.bambiniConfermati === 1 ? 'confermato' : 'confermati'})` : '',
    a.adultiInAttesa + a.bambiniInAttesa ? `${persone(a.adultiInAttesa, a.bambiniInAttesa)} (in attesa)` : '',
  ].filter(Boolean)
  return `+ ${parti.join(', ')} senza nome`
}

function RigaAccompagnatore({ a, gestisce, onModifica, onTogli, onAutonomo }: { a: Partecipante; gestisce: boolean; onModifica: () => void; onTogli: () => void; onAutonomo: () => void }) {
  const connesso = useStatoConnessione() === 'connesso'
  const stato = useCambiaStato(a)
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-0 flex-1">
        {a.nome}
        {a.categoria === 'bambino' ? <span className="text-testo-tenue"> · bambino</span> : null}
        <Incarichi p={a} />
      </span>
      {gestisce ? null : <Badge variante={VARIANTE_STATO[a.stato]}>{NOME_STATO[a.stato]}</Badge>}
      <MenuAzioni
        etichetta={`Azioni per ${a.nome}`}
        voci={[
          { etichetta: 'Modifica', onSelect: onModifica, nascosta: !gestisce, disabilitata: !connesso },
          { etichetta: 'Invito a parte', onSelect: onAutonomo, nascosta: !gestisce, disabilitata: !connesso },
          { etichetta: 'Togli', onSelect: onTogli, pericolosa: true, nascosta: !gestisce, disabilitata: !connesso },
        ]}
      />
      {gestisce ? (
        <div className="basis-full">
          <SceltaStato valore={a.stato} nome={a.nome} disabilitata={!connesso || stato.inCorso} onScegli={(s) => void stato.esegui(s)} />
        </div>
      ) : null}
    </li>
  )
}

/** Per chi usa l'app ed è fra gli invitati: «Conferma presenza» e i propri accompagnatori. */
function MioInvito({ invito: i, d, eventoId }: { invito: Invito; d: Partecipanti; eventoId: string }) {
  const connesso = useStatoConnessione() === 'connesso'
  const stato = useCambiaStato(i)
  const [accompagnatori, setAccompagnatori] = useState(false)
  const togli = useScrittura((p: Partecipante) => api.elimina(`/partecipanti/${p.id}`, p.versione), { successo: null })
  const cambiaAccompagnatore = useScrittura((x: { p: Partecipante; stato: StatoPresenza }) => api.modifica(`/partecipanti/${x.p.id}`, corpoPersona(x.p, { stato: x.stato })), { successo: null })
  return (
    <Card className="border-primario/40" data-testid="mio-invito">
      <CardContent className="flex flex-col gap-3 pt-4">
        <p className="font-semibold">Conferma presenza</p>
        <SceltaStato
          valore={i.stato}
          nome={i.nome}
          etichette={{ in_attesa: 'Non so ancora', confermato: 'Ci sono', assente: 'Non vengo' }}
          disabilitata={!connesso || stato.inCorso}
          onScegli={(s) => void stato.esegui(s)}
        />
        {i.accompagnatori.length || totaleAnonimi(i.anonimi) ? (
          <ul className="flex flex-col gap-1.5 text-sm" aria-label="I tuoi accompagnatori">
            {i.accompagnatori.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  {a.nome}
                  {a.categoria === 'bambino' ? <span className="text-testo-tenue"> · bambino</span> : null}
                </span>
                <Button misura="piccolo" variante="fantasma" disabled={!connesso} onClick={() => void togli.esegui(a)}>
                  Togli
                </Button>
                <div className="basis-full">
                  <SceltaStato valore={a.stato} nome={a.nome} etichette={{ in_attesa: 'Forse', confermato: 'Viene', assente: 'Non viene' }} disabilitata={!connesso} onScegli={(s) => void cambiaAccompagnatore.esegui({ p: a, stato: s })} />
                </div>
              </li>
            ))}
            {totaleAnonimi(i.anonimi) ? <li className="text-testo-tenue">{descriviAnonimi(i.anonimi)}</li> : null}
          </ul>
        ) : null}
        <Button misura="piccolo" variante="contorno" className="self-start" disabled={!connesso} onClick={() => setAccompagnatori(true)}>
          <Plus /> Aggiungi accompagnatori
        </Button>
        {d.maxAccompagnatori !== null ? <p className="text-xs text-testo-tenue">Puoi indicare fino a {plurale(d.maxAccompagnatori, 'accompagnatore', 'accompagnatori')}.</p> : null}
      </CardContent>
      {accompagnatori ? <FinestraAccompagnatori invito={i} eventoId={eventoId} d={d} onChiudi={() => setAccompagnatori(false)} /> : null}
    </Card>
  )
}

const ALTRO = '__altro__'

/** Nuovo partecipante (chi organizza): con l'app, dalla rubrica o un nome. */
function FinestraPersona({ eventoId, d, onChiudi }: { eventoId: string; d: Partecipanti; onChiudi: () => void }) {
  const [scelta, setScelta] = useState(ALTRO)
  const [nome, setNome] = useState('')
  const [salva, setSalva] = useState(d.scelte.rubrica.length > 0 || d.scelte.persone.length > 0)
  const [categoria, setCategoria] = useState<CategoriaPersona>('adulto')
  const [stato, setStato] = useState<StatoPresenza>('in_attesa')
  const [note, setNote] = useState('')
  const presenti = new Set(d.inviti.flatMap((i) => [i, ...i.accompagnatori]).flatMap((p) => [p.utenteId, p.esternoId]))
  const crea = useScrittura(
    () => {
      const chi = scelta === ALTRO ? { nome: nome.trim(), salvaInRubrica: salva } : scelta.startsWith('u:') ? { utenteId: scelta.slice(2) } : { esternoId: scelta.slice(2) }
      return api.crea<Partecipante>(`/eventi/${eventoId}/partecipanti`, { id: nuovoId(), ...chi, categoria, stato, note })
    },
    { successo: (p) => `${p.nome} aggiunto`, dopo: onChiudi },
  )
  const pronto = scelta === ALTRO ? nome.trim() !== '' : scelta !== ''
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Aggiungi partecipante"
      descrizione="Essere nell'elenco non dà accesso all'evento nell'app."
      piede={
        <Button disabled={!pronto || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
          Aggiungi
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Chi" htmlFor="part-chi">
          <Select id="part-chi" value={scelta} onChange={(ev) => setScelta(ev.target.value)}>
            <option value={ALTRO}>Scrivi un nome…</option>
            {d.scelte.persone.length ? (
              <optgroup label="Con l'app">
                {d.scelte.persone.filter((p) => !presenti.has(p.id)).map((p) => (
                  <option key={p.id} value={`u:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {d.scelte.rubrica.length ? (
              <optgroup label="Senza app (rubrica)">
                {d.scelte.rubrica.filter((p) => !presenti.has(p.id)).map((p) => (
                  <option key={p.id} value={`e:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Campo>
        {scelta === ALTRO ? (
          <>
            <Campo etichetta="Nome" htmlFor="part-nome">
              <Input id="part-nome" value={nome} maxLength={80} placeholder="Es. Zio Marco" onChange={(ev) => setNome(ev.target.value)} autoFocus />
            </Campo>
            {d.scelte.rubrica.length || d.scelte.persone.length ? (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Casella checked={salva} onChange={(ev) => setSalva(ev.target.checked)} /> Salva nella rubrica della Famiglia
              </label>
            ) : null}
          </>
        ) : null}
        <CampiPersona categoria={categoria} stato={stato} note={note} onCategoria={setCategoria} onStato={setStato} onNote={setNote} />
      </div>
    </Finestra>
  )
}

function CampiPersona({ categoria, stato, note, onCategoria, onStato, onNote, soloStato }: { categoria: CategoriaPersona; stato: StatoPresenza; note: string; onCategoria: (c: CategoriaPersona) => void; onStato: (s: StatoPresenza) => void; onNote: (n: string) => void; soloStato?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Campo etichetta="Adulto o bambino" htmlFor="part-categoria">
          <Select id="part-categoria" value={categoria} disabled={soloStato} onChange={(ev) => onCategoria(ev.target.value as CategoriaPersona)}>
            <option value="adulto">Adulto</option>
            <option value="bambino">Bambino</option>
          </Select>
        </Campo>
        <Campo etichetta="Presenza" htmlFor="part-stato">
          <Select id="part-stato" value={stato} onChange={(ev) => onStato(ev.target.value as StatoPresenza)}>
            {STATI.map((s) => (
              <option key={s.stato} value={s.stato}>
                {s.etichetta}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo etichetta="Note (facoltative)" htmlFor="part-note">
        <Input id="part-note" value={note} maxLength={200} placeholder="Es. vegetariano, arriva tardi" onChange={(ev) => onNote(ev.target.value)} />
      </Campo>
    </>
  )
}

function FinestraModifica({ p, gestisce, onChiudi }: { p: Partecipante; gestisce: boolean; onChiudi: () => void }) {
  const [nome, setNome] = useState(p.nome)
  const [categoria, setCategoria] = useState(p.categoria)
  const [stato, setStato] = useState(p.stato)
  const [note, setNote] = useState(p.note)
  const collegato = p.utenteId !== null || p.esternoId !== null
  const salva = useScrittura(() => api.modifica<Partecipante>(`/partecipanti/${p.id}`, corpoPersona(p, { nome: nome.trim(), categoria, stato, note })), {
    oggetto: p.nome,
    successo: 'Salvato',
    dopo: onChiudi,
  })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Modifica ${p.nome}`}
      piede={
        <Button disabled={!nome.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Nome" htmlFor="mod-part-nome" aiuto={collegato ? 'Il nome segue l\'app o la rubrica.' : undefined}>
          <Input id="mod-part-nome" value={nome} maxLength={80} disabled={collegato} onChange={(ev) => setNome(ev.target.value)} />
        </Campo>
        <CampiPersona categoria={categoria} stato={stato} note={note} onCategoria={setCategoria} onStato={setStato} onNote={setNote} soloStato={!gestisce} />
      </div>
    </Finestra>
  )
}

/** Accompagnatori di un invito: con nome (uno alla volta) e senza nome (quantità). */
function FinestraAccompagnatori({ invito: i, eventoId, d, onChiudi }: { invito: Invito; eventoId: string; d: Partecipanti; onChiudi: () => void }) {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<CategoriaPersona>('adulto')
  const [statoNuovo, setStatoNuovo] = useState<StatoPresenza>('confermato')
  const [anonimi, setAnonimi] = useState<Anonimi>(i.anonimi)
  const aggiungi = useScrittura(
    () => api.crea<Partecipante>(`/eventi/${eventoId}/partecipanti`, { id: nuovoId(), invitoId: i.id, nome: nome.trim(), categoria, stato: statoNuovo }),
    { successo: (p) => `${p.nome} aggiunto`, dopo: () => setNome('') },
  )
  const salvaAnonimi = useScrittura(() => api.modifica(`/partecipanti/${i.id}/accompagnatori`, { anonimi, versione: i.versione }), { oggetto: i.nome, successo: 'Salvato', dopo: onChiudi })
  const cambiati = JSON.stringify(anonimi) !== JSON.stringify(i.anonimi)
  const campo = (k: keyof Anonimi, etichetta: string) => (
    <Campo etichetta={etichetta} htmlFor={`anon-${k}`}>
      <Contatore id={`anon-${k}`} etichetta={etichetta.toLowerCase()} valore={anonimi[k]} max={99} onCambia={(n) => setAnonimi({ ...anonimi, [k]: n })} />
    </Campo>
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Accompagnatori di ${i.nome}`}
      descrizione={d.puoGestire || d.maxAccompagnatori === null ? undefined : `Fino a ${plurale(d.maxAccompagnatori, 'accompagnatore', 'accompagnatori')} in tutto.`}
      piede={
        <Button disabled={salvaAnonimi.inCorso} onClick={() => (cambiati ? void salvaAnonimi.esegui(undefined) : onChiudi())}>
          {cambiati ? 'Salva' : 'Fatto'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (nome.trim()) void aggiungi.esegui(undefined)
          }}
        >
          <p className="text-sm font-medium">Con nome</p>
          <Campo etichetta="Nome" htmlFor="acc-nome">
            <Input id="acc-nome" value={nome} maxLength={80} placeholder="Es. Giulia" onChange={(ev) => setNome(ev.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Adulto o bambino" value={categoria} onChange={(ev) => setCategoria(ev.target.value as CategoriaPersona)}>
              <option value="adulto">Adulto</option>
              <option value="bambino">Bambino</option>
            </Select>
            <Select aria-label="Presenza dell'accompagnatore" value={statoNuovo} onChange={(ev) => setStatoNuovo(ev.target.value as StatoPresenza)}>
              <option value="confermato">Confermato</option>
              <option value="in_attesa">In attesa</option>
            </Select>
          </div>
          <Button type="submit" variante="contorno" misura="piccolo" className="self-start" disabled={!nome.trim() || aggiungi.inCorso}>
            <Plus /> Aggiungi con nome
          </Button>
        </form>
        <div className="flex flex-col gap-2 border-t border-bordo pt-3">
          <p className="text-sm font-medium">Senza nome</p>
          <div className="grid grid-cols-2 gap-3">
            {campo('adultiConfermati', 'Adulti confermati')}
            {campo('adultiInAttesa', 'Adulti in attesa')}
            {campo('bambiniConfermati', 'Bambini confermati')}
            {campo('bambiniInAttesa', 'Bambini in attesa')}
          </div>
        </div>
      </div>
    </Finestra>
  )
}

/** Coperti manuali o calcolati dai partecipanti, con il confronto prima di cambiare. */
function FinestraCoperti({ evento: e, d, onChiudi }: { evento: Evento; d: Partecipanti; onChiudi: () => void }) {
  const [automatici, setAutomatici] = useState(d.copertiAutomatici)
  const [adulti, setAdulti] = useState(d.copertiAutomatici ? d.copertiCalcolati.adulti : d.copertiManuali.adulti)
  const [bambini, setBambini] = useState(d.copertiAutomatici ? d.copertiCalcolati.bambini : d.copertiManuali.bambini)
  const [limite, setLimite] = useState(d.maxAccompagnatori === null ? '' : String(d.maxAccompagnatori))
  const coeff = { coefficienteBambini: d.coefficienteBambini }
  const manuali = copertiEquivalenti({ ...d.copertiManuali, ...coeff })
  const calcolati = copertiEquivalenti({ ...d.copertiCalcolati, ...coeff })
  const salva = useScrittura(
    () =>
      api.modifica<Evento>(`/eventi/${e.id}/coperti`, {
        automatici,
        // Restando o passando in automatico i numeri manuali non cambiano.
        adulti: automatici ? d.copertiManuali.adulti : adulti,
        bambini: automatici ? d.copertiManuali.bambini : bambini,
        maxAccompagnatori: limite.trim() === '' ? null : Math.max(0, Math.min(99, Math.round(Number(limite)) || 0)),
        versione: e.versione,
      }),
    { oggetto: 'L\'evento', successo: 'Coperti aggiornati', dopo: onChiudi },
  )
  const passaAdAutomatici = automatici && !d.copertiAutomatici
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Coperti"
      piede={
        <Button disabled={salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          {passaAdAutomatici && manuali !== calcolati ? `Conferma: ${formattaCoperti(calcolati)} coperti` : 'Salva'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Come si contano i coperti" className="flex flex-col gap-2">
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-bordo p-3 text-sm">
            <input type="radio" name="modalita" className="mt-1" checked={!automatici} onChange={() => setAutomatici(false)} />
            <span>
              <strong>Coperti manuali</strong>
              <span className="block text-testo-tenue">Adulti e bambini scritti a mano: {persone(d.copertiManuali.adulti, d.copertiManuali.bambini)} ({formattaCoperti(manuali)} coperti).</span>
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-bordo p-3 text-sm">
            <input type="radio" name="modalita" className="mt-1" checked={automatici} onChange={() => setAutomatici(true)} />
            <span>
              <strong>Calcolati dai partecipanti</strong>
              <span className="block text-testo-tenue">Solo i confermati, accompagnatori compresi: {persone(d.copertiCalcolati.adulti, d.copertiCalcolati.bambini)} ({formattaCoperti(calcolati)} coperti).</span>
            </span>
          </label>
        </div>
        {passaAdAutomatici && manuali !== calcolati ? (
          <p className="rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso" role="note">
            I coperti passano da {formattaCoperti(manuali)} a {formattaCoperti(calcolati)}: porzioni e spesa si ricalcolano (quelle indicate a mano restano).
          </p>
        ) : null}
        {!automatici && d.copertiAutomatici ? (
          <div className="flex flex-col gap-2 rounded-xl bg-tenue/60 p-3">
            <p className="text-sm">Numeri manuali (proposti dai confermati, puoi cambiarli):</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo etichetta="Adulti" htmlFor="cop-adulti">
                <Contatore id="cop-adulti" etichetta="adulti" valore={adulti} onCambia={setAdulti} />
              </Campo>
              <Campo etichetta="Bambini" htmlFor="cop-bambini">
                <Contatore id="cop-bambini" etichetta="bambini" valore={bambini} onCambia={setBambini} />
              </Campo>
            </div>
          </div>
        ) : null}
        <Campo etichetta="Accompagnatori per invito" htmlFor="cop-limite" aiuto="Quanti ne può aggiungere da sé chi usa l'app. Vuoto: nessun limite.">
          <Input id="cop-limite" inputMode="numeric" value={limite} placeholder="Nessun limite" onChange={(ev) => setLimite(ev.target.value.replace(/\D/g, ''))} />
        </Campo>
      </div>
    </Finestra>
  )
}
