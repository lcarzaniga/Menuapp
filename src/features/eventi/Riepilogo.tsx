// «A che punto siamo?» (SPEC §26, §29.3): tre gruppi sempre visibili (Da organizzare, Da acquistare,
// Da preparare); in ciascuno prima ciò che è da risolvere, poi ciò che è aperto, i suggerimenti, ciò
// che è a posto e le parti non usate, con il livello detto a parole. Ogni indicatore porta alla
// sezione che lo risolve. Niente in sospeso: «Tutto pronto»; dopo l'evento: «Evento passato».
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronRight, CircleDashed, CircleDot, Lightbulb, PartyPopper } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiepilogoOrganizzativo } from '@/contratto/edizioni.ts'
import { plurale } from '@/lib/formato'
import { dataBreve } from '@/domain/tempo.ts'
import { cn } from '@/lib/utils'

export const useRiepilogo = (eventoId: string) =>
  useQuery({ queryKey: ['riepilogo', eventoId], queryFn: () => api.leggi<RiepilogoOrganizzativo>(`/eventi/${eventoId}/riepilogo`) })

interface Indicatore {
  testo: string
  dettaglio?: string
  /**
   * attenzione: da risolvere, solo quando qualcosa è andato storto (responsabile che non viene,
   * attività in ritardo, quantità da verificare); da_fare: ancora aperto, normale mentre si
   * organizza (anche menù vuoto e coperti mancanti); nota: un suggerimento (mai conteggiato); facoltativo: una parte non usata;
   * ok: a posto (SPEC §26, D9). I primi due sono «in sospeso».
   */
  livello: 'attenzione' | 'da_fare' | 'facoltativo' | 'nota' | 'ok'
  /** Gruppo delle cose in sospeso: cosa organizzare, cosa comprare, cosa preparare. */
  gruppo: Gruppo
  a: string
}

export type Gruppo = 'organizzare' | 'acquistare' | 'preparare'
export const GRUPPI: { id: Gruppo; titolo: string }[] = [
  { id: 'organizzare', titolo: 'Da organizzare' },
  { id: 'acquistare', titolo: 'Da acquistare' },
  { id: 'preparare', titolo: 'Da preparare' },
]

const ORDINE = { attenzione: 0, da_fare: 1, nota: 2, ok: 3, facoltativo: 4 } as const
export const inSospeso = (x: Indicatore) => x.livello === 'attenzione' || x.livello === 'da_fare'

const quando = (p: { data: string; ora: string | null }) => `${dataBreve(p.data)}${p.ora ? ` alle ${p.ora}` : ''}`

/** Indicatori dal più urgente: da risolvere, aperti (prima le conferme mancanti), suggerimenti, cose a posto. */
export function indicatori(r: RiepilogoOrganizzativo): Indicatore[] {
  const lista: Indicatore[] = []
  const o = 'organizzare' as const
  // Menù (SPEC §26): vuoto è da risolvere; con portate senza piatti è in preparazione; completato
  // quando ogni portata ha almeno un piatto. Nessun minimo: le portate che non servono si tolgono.
  if (!r.archiviato) {
    const m = r.menu
    if (m.voci === 0) lista.push({ testo: 'Menù ancora vuoto', dettaglio: 'aggiungi i piatti per avere porzioni e spesa', livello: 'da_fare', gruppo: o, a: 'menu' })
    else if (m.portateVuote.length) {
      lista.push({ testo: 'Menù in preparazione', dettaglio: `ancora senza piatti: ${m.portateVuote.join(', ')} · se non servono, toglile dalle portate`, livello: 'da_fare', gruppo: o, a: 'menu' })
    } else lista.push({ testo: 'Menù completato', dettaglio: plurale(m.voci, 'piatto', 'piatti'), livello: 'ok', gruppo: o, a: 'menu' })
  }
  if (r.partecipanti) {
    const p = r.partecipanti
    const altri = [plurale(p.confermati, 'confermato', 'confermati'), p.assenti ? `${p.assenti} non ${p.assenti === 1 ? 'partecipa' : 'partecipano'}` : ''].filter(Boolean).join(', ')
    lista.push(
      p.inAttesa
        ? { testo: `${p.inAttesa} in attesa di conferma`, dettaglio: altri, livello: 'da_fare', gruppo: o, a: 'partecipanti' }
        : { testo: altri, dettaglio: 'tutti hanno risposto', livello: 'ok', gruppo: o, a: 'partecipanti' },
    )
  }
  // I coperti si leggono nelle informazioni dell'evento: qui solo se mancano (senza, niente porzioni).
  if (r.coperti.equivalenti <= 0) {
    lista.push({ testo: 'Coperti non indicati', dettaglio: r.coperti.automatici ? 'nessun partecipante confermato' : 'indica quanti siete', livello: 'da_fare', gruppo: o, a: 'partecipanti' })
  }
  if (!r.archiviato) {
    if (!r.partecipanti) lista.push({ testo: 'Elenco dei partecipanti', dettaglio: 'per segnare chi viene', livello: 'facoltativo', gruppo: o, a: 'partecipanti' })
    if (!r.incarichi && r.menu.voci > 0) lista.push({ testo: 'Chi porta cosa', dettaglio: 'per affidare piatti e cose da portare', livello: 'facoltativo', gruppo: o, a: 'chi-porta' })
    if (!r.attivita) lista.push({ testo: 'Piano delle attività', dettaglio: 'cosa preparare e quando', livello: 'facoltativo', gruppo: 'preparare', a: 'piano' })
    if (!r.spesa) lista.push({ testo: 'Lista della spesa', dettaglio: 'si compone dai piatti del menù con una ricetta', livello: 'facoltativo', gruppo: 'acquistare', a: 'spesa' })
  }
  if (r.incarichi) {
    const i = r.incarichi
    if (i.responsabiliAssenti) lista.push({ testo: `${plurale(i.responsabiliAssenti, 'incarico', 'incarichi')} di chi non partecipa`, livello: 'attenzione', gruppo: o, a: 'chi-porta' })
    if (i.coseSenzaResponsabile) lista.push({ testo: `${plurale(i.coseSenzaResponsabile, 'cosa', 'cose')} da portare senza nessuno`, livello: 'da_fare', gruppo: o, a: 'chi-porta' })
    if (i.daCompletare) lista.push({ testo: `${plurale(i.daCompletare, 'incarico', 'incarichi')} da completare`, dettaglio: 'affidati e non ancora segnati come fatti', livello: 'da_fare', gruppo: o, a: 'chi-porta' })
    if (i.piattiNonAffidati) lista.push({ testo: `${i.piattiNonAffidati} ${i.piattiNonAffidati === 1 ? 'piatto non affidato' : 'piatti non affidati'}`, dettaglio: 'se li preparate voi va bene così', livello: 'nota', gruppo: o, a: 'chi-porta' })
    if (!i.responsabiliAssenti && !i.coseSenzaResponsabile && !i.daCompletare) lista.push({ testo: 'Incarichi completati', livello: 'ok', gruppo: o, a: 'chi-porta' })
  }
  if (r.proposte) lista.push({ testo: `${plurale(r.proposte.inAttesa, 'proposta', 'proposte')} da decidere`, livello: 'da_fare', gruppo: o, a: 'bacheca' })
  if (r.sondaggi) lista.push({ testo: `${plurale(r.sondaggi.aperti, 'sondaggio aperto', 'sondaggi aperti')}`, livello: 'da_fare', gruppo: o, a: 'bacheca' })
  if (r.spesa) {
    const s = r.spesa
    const g = 'acquistare' as const
    if (s.daVerificare) lista.push({ testo: `${plurale(s.daVerificare, 'articolo', 'articoli')} da verificare`, dettaglio: 'quantità incerte: controllale prima di comprare', livello: 'attenzione', gruppo: g, a: 'spesa' })
    if (s.daComprare) lista.push({ testo: `${plurale(s.daComprare, 'articolo', 'articoli')} da comprare`, livello: 'da_fare', gruppo: g, a: 'spesa' })
    else if (s.articoli && !s.daVerificare) lista.push({ testo: 'Spesa fatta', livello: 'ok', gruppo: g, a: 'spesa' })
    // Solo un suggerimento: un piatto senza ricetta può essere una scelta (si compra già pronto).
    if (s.senzaRicetta.length) {
      lista.push({ testo: `${s.senzaRicetta.length === 1 ? 'Un piatto' : `${s.senzaRicetta.length} piatti`} senza ricetta: ${s.senzaRicetta.join(', ')}`, dettaglio: 'non entrano nella spesa: collega una ricetta, aggiungi gli articoli a mano o togli il piatto dalla spesa', livello: 'nota', gruppo: g, a: 'menu' })
    }
    if (s.senzaIngredienti.length) {
      lista.push({ testo: `${s.senzaIngredienti.length === 1 ? 'Una ricetta' : `${s.senzaIngredienti.length} ricette`} senza ingredienti: ${s.senzaIngredienti.join(', ')}`, dettaglio: 'la spesa non le conta: aggiungi gli ingredienti o togli il piatto dalla spesa', livello: 'nota', gruppo: g, a: 'menu' })
    }
  }
  if (r.attivita) {
    const a = r.attivita
    const p = 'preparare' as const
    if (a.inRitardo) lista.push({ testo: `${plurale(a.inRitardo, 'attività', 'attività')} in ritardo`, livello: 'attenzione', gruppo: p, a: 'piano' })
    const aperte = a.daFare - a.inRitardo
    if (aperte > 0) lista.push({ testo: `${plurale(aperte, 'attività', 'attività')} da fare`, dettaglio: a.prossima ? `prossima: ${a.prossima.titolo}, ${quando(a.prossima)}` : undefined, livello: 'da_fare', gruppo: p, a: 'piano' })
    if (!a.daFare) lista.push({ testo: 'Piano completato', livello: 'ok', gruppo: p, a: 'piano' })
  }
  // Ordinamento stabile: a parità di livello resta l'ordine sopra.
  return lista.map((x, i) => ({ x, i })).sort((p, q) => ORDINE[p.x.livello] - ORDINE[q.x.livello] || p.i - q.i).map((p) => p.x)
}

const ICONA = {
  attenzione: <AlertTriangle className="size-4 text-avviso" />,
  da_fare: <CircleDot className="size-4 text-primario" />,
  facoltativo: <CircleDashed className="size-4 text-testo-tenue" />,
  nota: <Lightbulb className="size-4 text-testo-tenue" />,
  ok: <CheckCircle2 className="size-4 text-successo" />,
}

/** Il livello detto a parole (D9): le cose aperte e quelle a posto bastano l'icona e il testo. */
const ETICHETTA: Record<Indicatore['livello'], string | null> = { attenzione: 'da risolvere', da_fare: null, nota: 'suggerimento', facoltativo: 'non usato', ok: null }

function Elenco({ eventoId, voci, nome }: { eventoId: string; voci: Indicatore[]; nome: string }) {
  return (
    <ul className="-mx-2 flex flex-col" aria-label={nome}>
      {voci.map((x) => (
        <li key={`${x.a}:${x.testo}`}>
          <Link
            to={`/eventi/${eventoId}/${x.a}`}
            className={cn('flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-tenue', x.livello === 'attenzione' && 'font-medium', !inSospeso(x) && 'text-sm')}
          >
            {ICONA[x.livello]}
            <span className="min-w-0 flex-1 break-words">
              {x.testo}
              {ETICHETTA[x.livello] ? (
                <Badge variante={x.livello === 'attenzione' ? 'avviso' : 'neutro'} className="ml-2 align-middle">
                  {ETICHETTA[x.livello]}
                </Badge>
              ) : null}
              {x.dettaglio ? <span className="block text-xs font-normal text-testo-tenue">{x.dettaglio}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-testo-tenue" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function RiepilogoEvento({ eventoId }: { eventoId: string }) {
  const q = useRiepilogo(eventoId)
  if (!q.data || q.data.archiviato) return null
  const passato = q.data.passato
  // Dopo l'evento restano solo le cose a posto: niente da fare, niente suggerimenti.
  const lista = indicatori(q.data).filter((x) => !passato || x.livello === 'ok')
  const sospese = lista.filter(inSospeso)
  return (
    <Card>
      <CardHeader>
        <CardTitle>A che punto siamo?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {passato ? (
          // L'invito a concludere l'evento è nella Panoramica.
          <p className="flex items-center gap-2 rounded-xl bg-tenue px-3 py-2 font-medium" data-testid="stato-preparazione">
            <CalendarCheck className="size-5 text-testo-tenue" /> Evento passato
          </p>
        ) : sospese.length ? (
          <p className="text-sm text-testo-tenue" data-testid="stato-preparazione">
            {sospese.length === 1 ? 'Manca ancora una cosa' : `Mancano ancora ${sospese.length} cose`}
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-successo-tenue px-3 py-2 font-medium text-successo" data-testid="stato-preparazione">
            <PartyPopper className="size-5" /> Tutto pronto
          </p>
        )}
        {/* I tre gruppi sempre, nello stesso ordine; dentro, prima ciò che manca (SPEC §26). */}
        {GRUPPI.map((g) => {
          const voci = lista.filter((x) => x.gruppo === g.id)
          return voci.length ? (
            <div key={g.id}>
              <Titoletto>{g.titolo}</Titoletto>
              <Elenco eventoId={eventoId} voci={voci} nome={g.titolo} />
            </div>
          ) : null
        })}
      </CardContent>
    </Card>
  )
}

const Titoletto = ({ children }: { children: string }) => <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-testo-tenue">{children}</p>
