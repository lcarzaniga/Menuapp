// «A che punto siamo?» (SPEC §26, §29.3): prima ciò che manca, poi ciò che è a posto; ogni
// indicatore porta alla sezione che lo risolve. Niente in sospeso: «Tutto pronto».
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, CircleDashed, CircleDot, PartyPopper } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiepilogoOrganizzativo } from '@/contratto/edizioni.ts'
import { plurale } from '@/lib/formato'
import { cn } from '@/lib/utils'

export const useRiepilogo = (eventoId: string) =>
  useQuery({ queryKey: ['riepilogo', eventoId], queryFn: () => api.leggi<RiepilogoOrganizzativo>(`/eventi/${eventoId}/riepilogo`) })

interface Indicatore {
  testo: string
  dettaglio?: string
  /**
   * attenzione: un problema da risolvere; da_fare: qualcosa ancora in sospeso; facoltativo: una
   * parte non usata (non è un problema); nota: da sapere; ok: a posto. I primi due formano
   * «In sospeso», «facoltativo» va in «Non ancora usati», gli altri in «Già a posto».
   */
  livello: 'attenzione' | 'da_fare' | 'facoltativo' | 'nota' | 'ok'
  a: string
}

const ORDINE = { attenzione: 0, da_fare: 1, nota: 2, ok: 3, facoltativo: 4 } as const
export const inSospeso = (x: Indicatore) => x.livello === 'attenzione' || x.livello === 'da_fare'

/** Indicatori dal più urgente: problemi, cose in sospeso (prima le conferme mancanti), note, cose a posto. */
export function indicatori(r: RiepilogoOrganizzativo): Indicatore[] {
  const lista: Indicatore[] = []
  // Menù (SPEC §26): vuoto o con portate senza piatti è da completare; completato quando ogni
  // portata dell'evento ha almeno un piatto. Nessun minimo: le portate che non servono si tolgono.
  if (!r.archiviato) {
    const m = r.menu
    if (m.voci === 0) lista.push({ testo: 'Menù ancora vuoto', dettaglio: 'aggiungi i piatti per avere porzioni e spesa', livello: 'da_fare', a: 'menu' })
    else if (m.portateVuote.length) {
      lista.push({ testo: 'Menù in preparazione', dettaglio: `ancora senza piatti: ${m.portateVuote.join(', ')} · se non servono, toglile dalle portate`, livello: 'da_fare', a: 'menu' })
    } else lista.push({ testo: 'Menù completato', dettaglio: plurale(m.voci, 'piatto', 'piatti'), livello: 'ok', a: 'menu' })
  }
  if (r.partecipanti) {
    const p = r.partecipanti
    const altri = [plurale(p.confermati, 'confermato', 'confermati'), p.assenti ? `${p.assenti} non ${p.assenti === 1 ? 'partecipa' : 'partecipano'}` : ''].filter(Boolean).join(', ')
    lista.push(
      p.inAttesa
        ? { testo: `${p.inAttesa} in attesa di conferma`, dettaglio: altri, livello: 'da_fare', a: 'partecipanti' }
        : { testo: altri, dettaglio: 'tutti hanno risposto', livello: 'ok', a: 'partecipanti' },
    )
  }
  // I coperti si leggono nelle informazioni dell'evento: qui solo se mancano.
  if (r.coperti.equivalenti <= 0) {
    lista.push({ testo: 'Coperti non indicati', dettaglio: r.coperti.automatici ? 'nessun partecipante confermato' : 'indica quanti siete', livello: 'da_fare', a: 'partecipanti' })
  }
  if (!r.archiviato) {
    if (!r.partecipanti) lista.push({ testo: 'Elenco dei partecipanti', dettaglio: 'facoltativo: per segnare chi viene', livello: 'facoltativo', a: 'partecipanti' })
    if (!r.incarichi && r.menu.voci > 0) lista.push({ testo: 'Chi porta cosa', dettaglio: 'facoltativo: per affidare piatti e cose da portare', livello: 'facoltativo', a: 'chi-porta' })
    if (!r.attivita) lista.push({ testo: 'Piano delle attività', dettaglio: 'facoltativo: cosa preparare e quando', livello: 'facoltativo', a: 'piano' })
  }
  if (r.incarichi) {
    const i = r.incarichi
    if (i.responsabiliAssenti) lista.push({ testo: `${plurale(i.responsabiliAssenti, 'incarico', 'incarichi')} di chi non partecipa`, livello: 'attenzione', a: 'chi-porta' })
    if (i.coseSenzaResponsabile) lista.push({ testo: `${plurale(i.coseSenzaResponsabile, 'cosa', 'cose')} da portare senza nessuno`, livello: 'attenzione', a: 'chi-porta' })
    if (i.daCompletare) lista.push({ testo: `${plurale(i.daCompletare, 'incarico', 'incarichi')} da completare`, livello: 'da_fare', a: 'chi-porta' })
    if (i.piattiNonAffidati) lista.push({ testo: `${plurale(i.piattiNonAffidati, 'piatto', 'piatti')} non affidati`, dettaglio: 'se li preparate voi va bene così', livello: 'nota', a: 'chi-porta' })
    if (!i.responsabiliAssenti && !i.coseSenzaResponsabile && !i.daCompletare) lista.push({ testo: 'Incarichi completati', livello: 'ok', a: 'chi-porta' })
  }
  if (r.attivita) {
    const a = r.attivita
    lista.push(
      a.daFare
        ? { testo: `${plurale(a.daFare, 'attività', 'attività')} da fare`, dettaglio: a.inRitardo ? `${a.inRitardo} in ritardo` : undefined, livello: a.inRitardo ? 'attenzione' : 'da_fare', a: 'piano' }
        : { testo: 'Piano completato', livello: 'ok', a: 'piano' },
    )
  }
  if (r.proposte) lista.push({ testo: `${plurale(r.proposte.inAttesa, 'proposta', 'proposte')} da decidere`, livello: 'da_fare', a: 'bacheca' })
  if (r.sondaggi) lista.push({ testo: `${plurale(r.sondaggi.aperti, 'sondaggio aperto', 'sondaggi aperti')}`, livello: 'da_fare', a: 'bacheca' })
  if (r.spesa) {
    const s = r.spesa
    lista.push(
      s.daComprare || s.daVerificare
        ? { testo: `Spesa: ${s.daComprare} da comprare`, dettaglio: s.daVerificare ? `${s.daVerificare} da verificare` : undefined, livello: s.daVerificare ? 'attenzione' : 'da_fare', a: 'spesa' }
        : { testo: 'Spesa fatta', livello: 'ok', a: 'spesa' },
    )
  }
  // Ordinamento stabile: a parità di livello resta l'ordine sopra.
  return lista.map((x, i) => ({ x, i })).sort((p, q) => ORDINE[p.x.livello] - ORDINE[q.x.livello] || p.i - q.i).map((p) => p.x)
}

const ICONA = {
  attenzione: <AlertTriangle className="size-4 text-avviso" />,
  da_fare: <CircleDot className="size-4 text-primario" />,
  facoltativo: <CircleDashed className="size-4 text-testo-tenue" />,
  nota: <Circle className="size-4 text-testo-tenue" />,
  ok: <CheckCircle2 className="size-4 text-successo" />,
}

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
  const lista = indicatori(q.data)
  const sospese = lista.filter(inSospeso)
  const facoltativi = lista.filter((x) => x.livello === 'facoltativo')
  const resto = lista.filter((x) => !inSospeso(x) && x.livello !== 'facoltativo')
  return (
    <Card>
      <CardHeader>
        <CardTitle>A che punto siamo?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sospese.length ? (
          <>
            <p className="text-sm text-testo-tenue" data-testid="stato-preparazione">
              {sospese.length === 1 ? 'Manca ancora una cosa' : `Mancano ancora ${sospese.length} cose`}
            </p>
            <Elenco eventoId={eventoId} voci={sospese} nome="In sospeso" />
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-successo-tenue px-3 py-2 font-medium text-successo" data-testid="stato-preparazione">
            <PartyPopper className="size-5" /> Tutto pronto
          </p>
        )}
        {resto.length ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-testo-tenue">Già a posto</p>
            <Elenco eventoId={eventoId} voci={resto} nome="Già a posto" />
          </div>
        ) : null}
        {facoltativi.length ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-testo-tenue">Non ancora usati</p>
            <Elenco eventoId={eventoId} voci={facoltativi} nome="Non ancora usati" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
