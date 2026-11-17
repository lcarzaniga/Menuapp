// Evento — Partecipanti: elenco facoltativo, conferme, accompagnatori e coperti (SPEC §24).
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, CornerDownRight, Pencil, Plus, Users } from 'lucide-react'
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
import { type Anonimi, type CategoriaPersona, confermaParziale, type StatoPresenza, totaleAnonimi } from '@/domain/partecipanti.ts'
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
  // Elenco in sola consultazione (nome e risposta); risposte, accompagnatori e rimozioni solo
  // dopo «Modifica elenco».
  const [inModifica, setInModifica] = useState(false)
  if (q.isPending) return <Caricamento />
  if (!q.data) return null
  const d = q.data
  const c = d.conteggio
  const usati = formattaCoperti(copertiEquivalenti(e))
  const calcolati = formattaCoperti(copertiEquivalenti({ ...d.copertiCalcolati, coefficienteBambini: d.coefficienteBambini }))
  return (
    <CorpoScheda>
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="size-5 text-primario" />
              <p className="flex-1 font-semibold" data-testid="coperti-usati">
                {usati} coperti per porzioni e spesa
              </p>
              {d.puoGestire ? (
                <Button misura="piccolo" variante="contorno" onClick={() => setCoperti(true)}>
                  Cambia
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-testo-tenue">
              <Badge variante={d.copertiAutomatici ? 'primario' : 'neutro'}>{d.copertiAutomatici ? 'Automatici' : 'Manuali'}</Badge>{' '}
              {d.copertiAutomatici
                ? 'calcolati dai partecipanti confermati, accompagnatori compresi.'
                : `scritti a mano (${persone(d.copertiManuali.adulti, d.copertiManuali.bambini)}), indipendenti dall'elenco.`}
            </p>
            {d.puoGestire && !d.copertiAutomatici && d.inviti.length && calcolati !== usati ? (
              <p className="text-xs text-testo-tenue" data-testid="coperti-confermati">
                Con i confermati sarebbero {calcolati}: per usarli scegli «Calcolati dai partecipanti» in Cambia.
              </p>
            ) : null}
            {d.inviti.length ? (
              <ul className="mt-1 grid grid-cols-3 gap-2 text-center text-xs" aria-label="Riepilogo delle presenze" data-testid="conteggio-partecipanti">
                <Totale etichetta="Confermati" adulti={c.adulti.confermati} bambini={c.bambini.confermati} classe="bg-successo-tenue text-successo" />
                <Totale etichetta="In attesa" adulti={c.adulti.inAttesa} bambini={c.bambini.inAttesa} classe="bg-tenue text-testo" />
                <Totale etichetta="Non partecipano" adulti={c.adulti.assenti} bambini={c.bambini.assenti} classe="bg-pericolo-tenue text-pericolo" />
              </ul>
            ) : null}
            {!d.puoGestire && !d.solaLettura ? (
              <p className="text-xs text-testo-tenue" data-testid="chi-gestisce">
                Le presenze le aggiorna chi può modificare l&apos;evento{d.gestori.length ? `: ${d.gestori.join(', ')}` : ''}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {d.inviti.length === 0 ? (
          <>
            <Vuoto
              titolo="Nessun partecipante"
              testo={
                d.puoGestire
                  ? 'L\'elenco è facoltativo: puoi aggiungere chi è invitato (anche chi non usa l\'app) e segnare chi conferma. I coperti possono restare scritti a mano.'
                  : 'Chi organizza non ha ancora indicato i partecipanti.'
              }
            />
            {d.puoGestire ? (
              <Button variante="contorno" className="self-center" onClick={() => setAggiungi(true)}>
                <Plus /> Aggiungi partecipante
              </Button>
            ) : null}
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              {d.puoGestire ? (
                <div className="flex flex-wrap items-center gap-2">
                  {inModifica ? (
                    <Button misura="piccolo" variante="contorno" onClick={() => setAggiungi(true)}>
                      <Plus /> Aggiungi
                    </Button>
                  ) : null}
                  <Button misura="piccolo" variante={inModifica ? 'primario' : 'contorno'} className="ml-auto" aria-pressed={inModifica} onClick={() => setInModifica(!inModifica)}>
                    {inModifica ? <Check /> : <Pencil />} {inModifica ? 'Fine' : 'Modifica elenco'}
                  </Button>
                </div>
              ) : null}
              <TabellaPartecipanti d={d} eventoId={e.id} inModifica={d.puoGestire && inModifica} />
            </CardContent>
          </Card>
        )}
      </div>
      {aggiungi ? <FinestraPersona eventoId={e.id} d={d} onChiudi={() => setAggiungi(false)} /> : null}
      {coperti ? <FinestraCoperti evento={e} d={d} onChiudi={() => setCoperti(false)} /> : null}
    </CorpoScheda>
  )
}

/** Un riquadro del riepilogo: quante persone in uno stato, adulti e bambini. */
function Totale({ etichetta, adulti, bambini, classe }: { etichetta: string; adulti: number; bambini: number; classe: string }) {
  return (
    <li className={cn('rounded-xl px-1 py-2', classe)}>
      <span className="block text-lg font-semibold leading-tight">{adulti + bambini}</span>
      <span className="block font-medium">{etichetta}</span>
      {bambini ? <span className="block opacity-80">{plurale(bambini, 'bambino', 'bambini')}</span> : null}
    </li>
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

/** Avviso: chi non viene ma ha ancora un incarico (che resta finché qualcuno non lo cambia). */
function AvvisoIncarichi({ p }: { p: Partecipante }) {
  if (!p.incarichi.length || p.stato !== 'assente') return null
  return (
    <span className="flex items-center gap-1 text-xs text-avviso" role="note">
      <AlertTriangle className="size-3.5 shrink-0" /> Non partecipa ma ha un incarico: {p.incarichi.join(', ')}
    </span>
  )
}

/** Tabella compatta: una riga per persona, accompagnatori sotto il loro invito. */
function TabellaPartecipanti({ d, eventoId, inModifica }: { d: Partecipanti; eventoId: string; inModifica: boolean }) {
  return (
    <table className="w-full table-fixed border-collapse text-sm" aria-label="Partecipanti">
      <thead>
        <tr className="border-b border-bordo text-left text-xs text-testo-tenue">
          <th className="py-1.5 font-medium">Nome</th>
          <th className={cn('py-1.5 font-medium', inModifica ? 'w-36' : 'w-32')}>Risposta</th>
          {inModifica ? (
            <th className="w-11 py-1.5">
              <span className="sr-only">Azioni</span>
            </th>
          ) : null}
        </tr>
      </thead>
      {d.inviti.map((i) => (
        <RigheInvito key={i.id} invito={i} eventoId={eventoId} inModifica={inModifica} />
      ))}
    </table>
  )
}

function RigheInvito({ invito: i, eventoId, inModifica }: { invito: Invito; eventoId: string; inModifica: boolean }) {
  const [modifica, setModifica] = useState<Partecipante | null>(null)
  const [accompagnatori, setAccompagnatori] = useState(false)
  const connesso = useStatoConnessione() === 'connesso'
  const togli = useScrittura((p: Partecipante) => api.elimina(`/partecipanti/${p.id}`, p.versione), { successo: 'Tolto dall\'elenco' })
  const autonomo = useScrittura((p: Partecipante) => api.crea(`/partecipanti/${p.id}/autonomo`, { versione: p.versione }), { successo: 'Ora ha un invito suo' })
  const anonimi = totaleAnonimi(i.anonimi)
  return (
    <tbody data-testid="invito" className="border-b border-bordo/60 last:border-b-0">
      <RigaPersona
        p={i}
        inModifica={inModifica}
        parziale={confermaParziale(i)}
        azioni={[
          { etichetta: 'Accompagnatori', onSelect: () => setAccompagnatori(true), disabilitata: !connesso },
          { etichetta: 'Modifica', onSelect: () => setModifica(i), disabilitata: !connesso },
          { etichetta: 'Togli dall\'elenco', onSelect: () => void togli.esegui(i), pericolosa: true, disabilitata: !connesso },
        ]}
      />
      {i.accompagnatori.map((a) => (
        <RigaPersona
          key={a.id}
          p={a}
          accompagnatore
          inModifica={inModifica}
          azioni={[
            { etichetta: 'Modifica', onSelect: () => setModifica(a), disabilitata: !connesso },
            { etichetta: 'Invito a parte', onSelect: () => void autonomo.esegui(a), disabilitata: !connesso },
            { etichetta: 'Togli', onSelect: () => void togli.esegui(a), pericolosa: true, disabilitata: !connesso },
          ]}
        />
      ))}
      {anonimi ? (
        <tr>
          <td colSpan={inModifica ? 3 : 2} className="py-1 pl-5 text-xs text-testo-tenue">
            {descriviAnonimi(i.anonimi)}
          </td>
        </tr>
      ) : null}
      {modifica ? (
        <tr hidden>
          <td>
            <FinestraModifica p={modifica} gestisce onChiudi={() => setModifica(null)} />
          </td>
        </tr>
      ) : null}
      {accompagnatori ? (
        <tr hidden>
          <td>
            <FinestraAccompagnatori invito={i} eventoId={eventoId} onChiudi={() => setAccompagnatori(false)} />
          </td>
        </tr>
      ) : null}
    </tbody>
  )
}

function RigaPersona({
  p,
  inModifica,
  accompagnatore = false,
  parziale = false,
  azioni,
}: {
  p: Partecipante
  inModifica: boolean
  accompagnatore?: boolean
  parziale?: boolean
  azioni: { etichetta: string; onSelect: () => void; pericolosa?: boolean; disabilitata?: boolean }[]
}) {
  const connesso = useStatoConnessione() === 'connesso'
  const stato = useCambiaStato(p)
  return (
    <tr className="align-middle" data-testid={accompagnatore ? 'accompagnatore' : undefined}>
      <td className={cn('py-1.5 pr-2', accompagnatore && 'pl-5')}>
        <span className={cn('flex min-w-0 items-center gap-1.5 break-words', !accompagnatore && 'font-medium')}>
          {accompagnatore ? <CornerDownRight className="size-3.5 shrink-0 text-testo-tenue" aria-hidden /> : null}
          <span className="min-w-0">
            {p.nome}
            {p.categoria === 'bambino' ? <span className="text-xs font-normal text-testo-tenue"> · bambino</span> : null}
          </span>
        </span>
        {p.note ? <span className="block truncate text-xs text-testo-tenue">{p.note}</span> : null}
        <AvvisoIncarichi p={p} />
      </td>
      <td className="py-1.5">
        {inModifica ? (
          <Select
            aria-label={`Presenza di ${p.nome}`}
            className="h-9 w-full px-2 text-sm"
            value={p.stato}
            disabled={!connesso || stato.inCorso}
            onChange={(ev) => void stato.esegui(ev.target.value as StatoPresenza)}
          >
            {STATI.map((x) => (
              <option key={x.stato} value={x.stato}>
                {x.etichetta}
              </option>
            ))}
          </Select>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            <Badge variante={VARIANTE_STATO[p.stato]}>{NOME_STATO[p.stato]}</Badge>
            {parziale ? <span className="text-xs text-avviso">parziale</span> : null}
          </span>
        )}
      </td>
      {inModifica ? (
        <td className="py-1.5 text-right">
          <MenuAzioni etichetta={`Azioni per ${p.nome}`} voci={azioni} />
        </td>
      ) : null}
    </tr>
  )
}

function descriviAnonimi(a: Anonimi): string {
  const parti = [
    a.adultiConfermati + a.bambiniConfermati ? `${persone(a.adultiConfermati, a.bambiniConfermati)} (${a.adultiConfermati + a.bambiniConfermati === 1 ? 'confermato' : 'confermati'})` : '',
    a.adultiInAttesa + a.bambiniInAttesa ? `${persone(a.adultiInAttesa, a.bambiniInAttesa)} (in attesa)` : '',
  ].filter(Boolean)
  return `+ ${parti.join(', ')} senza nome`
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
function FinestraAccompagnatori({ invito: i, eventoId, onChiudi }: { invito: Invito; eventoId: string; onChiudi: () => void }) {
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
        // Limite degli accompagnatori: valeva per le risposte personali, che non ci sono più; resta com'è.
        maxAccompagnatori: d.maxAccompagnatori,
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
      </div>
    </Finestra>
  )
}
