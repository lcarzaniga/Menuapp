// Centro notifiche (SPEC §20.6, §29.1): categoria e icona per tipo, da leggere e già lette,
// aggiornamenti raggruppati apribili, apertura diretta del contenuto, preferenze.
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, Bell, BellOff, CheckCheck, CheckCircle2, ChefHat, ChevronDown, ChevronUp, FilePen, House, KeyRound, MessageCircle, MessageSquare, Package, Share2, Star, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Casella } from '@/components/ui/campi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NOMI_NOTIFICA, type Notifica, TIPI_NOTIFICA, type TipoNotifica } from '@/contratto/famiglia.ts'
import { cn } from '@/lib/utils'
import { chiaviFamiglia, quando, useNotifiche, usePreferenzeNotifiche } from './api'
import { useFamigliaAttiva } from './attiva'

/** Categoria breve e icona di ogni tipo di notifica. */
const CATEGORIA: Record<TipoNotifica, { nome: string; icona: LucideIcon }> = {
  bacheca_famiglia: { nome: 'Bacheca della Famiglia', icona: House },
  bacheca_evento: { nome: 'Bacheca dell\'evento', icona: MessageSquare },
  risposta: { nome: 'Commento', icona: MessageCircle },
  sondaggio: { nome: 'Sondaggio', icona: BarChart3 },
  proposta: { nome: 'Proposta di piatto', icona: ChefHat },
  esito_proposta: { nome: 'La tua proposta', icona: CheckCircle2 },
  incarico: { nome: 'Chi porta cosa', icona: Package },
  menu: { nome: 'Menù', icona: UtensilsCrossed },
  condivisione: { nome: 'Condivisione', icona: Share2 },
  valutazione: { nome: 'Valutazione', icona: Star },
  modifica_ricetta: { nome: 'Modifica a una ricetta', icona: FilePen },
  proprieta_ricetta: { nome: 'Proprietà di una ricetta', icona: KeyRound },
}

/** «Anna: testo»; negli incarichi e nelle ricette (proposte, proprietà) il nome è già nel testo. */
const SENZA_AUTORE: TipoNotifica[] = ['incarico', 'modifica_ricetta', 'proprieta_ricetta']
const conAutore = (tipo: TipoNotifica, attore: string | null, testo: string) => (attore && !SENZA_AUTORE.includes(tipo) ? `${attore}: ${testo}` : testo)

export function PaginaNotifiche() {
  const n = useNotifiche()
  const naviga = useNavigate()
  const client = useQueryClient()
  // Da Impostazioni → Notifiche (?preferenze=1) si aprono subito le preferenze.
  const [parametri] = useSearchParams()
  const [preferenze, setPreferenze] = useState(parametri.has('preferenze'))
  const tutte = useScrittura(() => api.crea('/notifiche/lette', {}), { successo: 'Tutte lette' })
  const apri = async (x: Notifica, collegamento = x.collegamento) => {
    if (!x.letta) {
      await api.crea(`/notifiche/${x.id}/letta`, {}).catch(() => undefined)
      void client.invalidateQueries({ queryKey: chiaviFamiglia.notifiche })
    }
    naviga(collegamento)
  }
  const daLeggere = n.data?.filter((x) => !x.letta) ?? []
  const lette = n.data?.filter((x) => x.letta) ?? []
  return (
    <Pagina
      titolo="Notifiche"
      azioni={
        <>
          <Button variante="contorno" misura="piccolo" disabled={!daLeggere.length || tutte.inCorso} onClick={() => void tutte.esegui(undefined)}>
            <CheckCheck /> Tutte lette
          </Button>
          <Button variante="fantasma" misura="iconaPiccola" aria-label="Preferenze delle notifiche" aria-pressed={preferenze} onClick={() => setPreferenze(!preferenze)}>
            <BellOff />
          </Button>
        </>
      }
    >
      {preferenze ? <Preferenze /> : null}
      {n.isPending ? (
        <Caricamento />
      ) : !n.data?.length ? (
        <Vuoto icona={<Bell />} titolo="Nessuna notifica" testo="Qui trovi messaggi, sondaggi, proposte e incarichi che ti riguardano." />
      ) : (
        <div className="flex flex-col gap-5">
          {daLeggere.length ? <Gruppo titolo="Da leggere" notifiche={daLeggere} onApri={apri} /> : null}
          {lette.length ? <Gruppo titolo="Già lette" notifiche={lette} onApri={apri} /> : null}
        </div>
      )}
    </Pagina>
  )
}

function Gruppo({ titolo, notifiche, onApri }: { titolo: string; notifiche: Notifica[]; onApri: (x: Notifica, collegamento?: string) => Promise<void> }) {
  return (
    <section aria-label={titolo}>
      <h2 className="mb-2 text-sm font-semibold text-testo-tenue">
        {titolo} <span className="font-normal">({notifiche.length})</span>
      </h2>
      <ul className="flex flex-col gap-2" aria-label={titolo === 'Da leggere' ? 'Elenco delle notifiche' : 'Notifiche già lette'}>
        {notifiche.map((x) => (
          <li key={x.id}>
            <SchedaNotifica x={x} onApri={onApri} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SchedaNotifica({ x, onApri }: { x: Notifica; onApri: (x: Notifica, collegamento?: string) => Promise<void> }) {
  const [aperta, setAperta] = useState(false)
  // Con più Famiglie ogni notifica dice da quale viene.
  const { multiple } = useFamigliaAttiva()
  const { nome, icona: Icona } = CATEGORIA[x.tipo]
  const dove = `${multiple && x.famiglia && x.famiglia !== x.titolo ? `${x.famiglia} · ` : ''}${x.titolo}`
  // Più aggiornamenti: chi ha scritto, senza ripetere i nomi.
  const autori = [...new Set(x.dettagli.map((d) => d.attore).filter((a): a is string => Boolean(a)))]
  return (
    <div data-testid="notifica" className={cn('rounded-2xl border shadow-carta', x.letta ? 'border-bordo/60 bg-carta/70' : 'border-primario/40 bg-carta')}>
      <button type="button" onClick={() => void onApri(x)} className="flex w-full items-start gap-3 rounded-2xl p-3 text-left hover:bg-tenue/60">
        <span className={cn('relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', x.letta ? 'bg-tenue text-testo-tenue' : 'bg-primario-tenue text-primario-forte')}>
          <Icona className="size-4" aria-hidden />
          {x.letta ? null : <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-carta bg-primario" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-testo-tenue">
            <span className="font-semibold uppercase tracking-wide">{nome}</span>
            <span className="break-words"> · {dove}</span>
          </span>
          <span className={cn('block break-words', !x.letta && 'font-semibold')}>
            {x.letta ? null : <span className="sr-only">Da leggere: </span>}
            {conAutore(x.tipo, x.attore, x.testo)}
          </span>
          <span className="block text-xs text-testo-tenue">
            {quando(x.aggiornatoIl)}
            {x.conteggio > 1 && autori.length > 1 ? ` · da ${autori.join(', ')}` : ''}
          </span>
        </span>
      </button>
      {x.conteggio > 1 ? (
        <div className="px-3 pb-2 pl-15">
          <Button variante="fantasma" misura="piccolo" className="-ml-2" aria-expanded={aperta} onClick={() => setAperta(!aperta)}>
            {aperta ? <ChevronUp /> : <ChevronDown />} {x.conteggio} aggiornamenti
          </Button>
          {aperta ? (
            x.dettagli.length ? (
              <ul className="flex flex-col border-l border-bordo pl-3" aria-label={`Aggiornamenti: ${dove}`}>
                {x.dettagli.map((d, i) => (
                  <li key={`${d.il}-${i}`}>
                    <button type="button" onClick={() => void onApri(x, d.collegamento)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-tenue/60">
                      <span className="block break-words">{conAutore(x.tipo, d.attore, d.testo)}</span>
                      <span className="text-xs text-testo-tenue">{quando(d.il)}</span>
                    </button>
                  </li>
                ))}
                {x.dettagli.length < x.conteggio ? <li className="px-2 py-1 text-xs text-testo-tenue">e {x.conteggio - x.dettagli.length} precedenti</li> : null}
              </ul>
            ) : (
              <p className="text-xs text-testo-tenue">Il dettaglio non è disponibile per le notifiche meno recenti: apri la notifica per vedere tutto.</p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Preferenze() {
  const p = usePreferenzeNotifiche()
  const salva = useScrittura((disattivate: TipoNotifica[]) => api.modifica('/notifiche/preferenze', { disattivate }), { successo: 'Preferenze salvate' })
  if (!p.data) return <Caricamento />
  const spente = new Set(p.data.disattivate)
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Cosa voglio ricevere</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {TIPI_NOTIFICA.map((t) => (
          <label key={t} className="flex min-h-11 items-center gap-3 text-sm">
            <Casella
              checked={!spente.has(t)}
              onChange={(e) => {
                const n = new Set(spente)
                if (e.target.checked) n.delete(t)
                else n.add(t)
                void salva.esegui([...n])
              }}
            />
            {NOMI_NOTIFICA[t]}
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
