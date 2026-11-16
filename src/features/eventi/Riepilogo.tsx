// «A che punto siamo?» (SPEC §26): pochi indicatori, ognuno porta alla sua sezione.
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiepilogoOrganizzativo } from '@/contratto/edizioni.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { plurale } from '@/lib/formato'
import { cn } from '@/lib/utils'

export const useRiepilogo = (eventoId: string) =>
  useQuery({ queryKey: ['riepilogo', eventoId], queryFn: () => api.leggi<RiepilogoOrganizzativo>(`/eventi/${eventoId}/riepilogo`) })

interface Indicatore {
  testo: string
  dettaglio?: string
  /** attenzione: c'è qualcosa da fare; info: da sapere; ok: a posto. */
  livello: 'attenzione' | 'info' | 'ok'
  a: string
}

export function indicatori(r: RiepilogoOrganizzativo): Indicatore[] {
  const lista: Indicatore[] = []
  if (r.mioInvito === 'in_attesa') lista.push({ testo: 'Conferma la tua presenza', livello: 'attenzione', a: 'partecipanti' })
  if (r.partecipanti) {
    const p = r.partecipanti
    lista.push({
      testo: `${plurale(p.confermati, 'confermato', 'confermati')}${p.inAttesa ? `, ${p.inAttesa} in attesa` : ''}`,
      dettaglio: p.assenti ? `${p.assenti} non ${p.assenti === 1 ? 'partecipa' : 'partecipano'}` : undefined,
      livello: p.inAttesa ? 'info' : 'ok',
      a: 'partecipanti',
    })
  }
  lista.push({
    testo: `${formattaCoperti(r.coperti.equivalenti)} coperti`,
    dettaglio: r.coperti.automatici ? 'calcolati dai partecipanti confermati' : 'manuali',
    livello: 'ok',
    a: 'partecipanti',
  })
  if (r.incarichi) {
    const i = r.incarichi
    if (i.responsabiliAssenti) lista.push({ testo: `${plurale(i.responsabiliAssenti, 'incarico', 'incarichi')} di chi non partecipa`, livello: 'attenzione', a: 'chi-porta' })
    if (i.coseSenzaResponsabile) lista.push({ testo: `${plurale(i.coseSenzaResponsabile, 'cosa', 'cose')} da portare senza nessuno`, livello: 'attenzione', a: 'chi-porta' })
    if (i.daCompletare) lista.push({ testo: `${plurale(i.daCompletare, 'incarico', 'incarichi')} da completare`, livello: 'info', a: 'chi-porta' })
    if (i.piattiNonAffidati) lista.push({ testo: `${plurale(i.piattiNonAffidati, 'piatto', 'piatti')} non affidati`, dettaglio: 'se li preparate voi va bene così', livello: 'info', a: 'chi-porta' })
    if (!i.responsabiliAssenti && !i.coseSenzaResponsabile && !i.daCompletare) lista.push({ testo: 'Incarichi completati', livello: 'ok', a: 'chi-porta' })
  }
  if (r.attivita) {
    const a = r.attivita
    lista.push(
      a.daFare
        ? { testo: `${plurale(a.daFare, 'attività', 'attività')} da fare`, dettaglio: a.inRitardo ? `${a.inRitardo} in ritardo` : undefined, livello: a.inRitardo ? 'attenzione' : 'info', a: 'piano' }
        : { testo: 'Piano completato', livello: 'ok', a: 'piano' },
    )
  }
  if (r.proposte) lista.push({ testo: `${plurale(r.proposte.inAttesa, 'proposta', 'proposte')} da decidere`, livello: 'info', a: 'bacheca' })
  if (r.sondaggi) lista.push({ testo: `${plurale(r.sondaggi.aperti, 'sondaggio aperto', 'sondaggi aperti')}`, livello: 'info', a: 'bacheca' })
  if (r.spesa) {
    const s = r.spesa
    lista.push(
      s.daComprare || s.daVerificare
        ? { testo: `Spesa: ${s.daComprare} da comprare`, dettaglio: s.daVerificare ? `${s.daVerificare} da verificare` : undefined, livello: s.daVerificare ? 'attenzione' : 'info', a: 'spesa' }
        : { testo: 'Spesa fatta', livello: 'ok', a: 'spesa' },
    )
  }
  return lista
}

const ICONA = {
  attenzione: <AlertTriangle className="size-4 text-avviso" />,
  info: <Circle className="size-4 text-testo-tenue" />,
  ok: <CheckCircle2 className="size-4 text-successo" />,
}

export function RiepilogoEvento({ eventoId }: { eventoId: string }) {
  const q = useRiepilogo(eventoId)
  if (!q.data || q.data.archiviato) return null
  const lista = indicatori(q.data)
  return (
    <Card>
      <CardHeader>
        <CardTitle>A che punto siamo?</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="-mx-2 flex flex-col" aria-label="A che punto siamo">
          {lista.map((x) => (
            <li key={`${x.a}:${x.testo}`}>
              <Link to={`/eventi/${eventoId}/${x.a}`} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-tenue', x.livello === 'attenzione' && 'font-medium')}>
                {ICONA[x.livello]}
                <span className="min-w-0 flex-1">
                  {x.testo}
                  {x.dettaglio ? <span className="block text-xs font-normal text-testo-tenue">{x.dettaglio}</span> : null}
                </span>
                <ChevronRight className="size-4 text-testo-tenue" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
