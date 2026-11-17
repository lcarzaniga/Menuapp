// Evento: intestazione, contesto della Famiglia e cinque schede (SPEC §5, §31).
import { CookingPot, House } from 'lucide-react'
import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router'
import { useEvento, useMenu } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { PulsanteIndietro, type Scheda, Schede, Segmenti } from '@/components/Navigazione'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErroreRichiesta } from '@/api/client'
import type { Evento } from '@/domain/tipi.ts'
import { dataLunga } from '@/domain/tempo.ts'
import { cn } from '@/lib/utils'
import { IllustrazioneEvento } from '@/components/Illustrazioni'
import { SolaLettura } from '@/connessione/stato'
import { useAccessoEvento } from '@/features/accesso/sessione'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'

/**
 * Permesso dell'utente sull'evento: in sola lettura tutti i comandi di scrittura dentro
 * `children` si disattivano (il server rifiuta comunque).
 */
export function ConPermessoEvento({ children }: { children: React.ReactNode }) {
  const { id = '' } = useParams()
  const accesso = useAccessoEvento(id)
  const motivo = accesso.data?.permesso === 'lettura' ? `Evento di ${accesso.data.proprietario.nome}, condiviso con te in sola lettura` : null
  return <SolaLettura motivo={motivo}>{children}</SolaLettura>
}

/** Ultima parte del percorso: '' (Riepilogo), 'menu', 'partecipanti'… */
const parte = (percorso: string) => percorso.split('/')[3] ?? ''

/**
 * Cinque schede: le vecchie sei pagine restano agli stessi indirizzi (notifiche, segnalibri),
 * raggruppate: Persone = Presenze + Chi porta, Prepara = Spesa + Piano.
 */
export function schedeEvento(id: string): Scheda[] {
  const base = `/eventi/${id}`
  return [
    { a: base, etichetta: 'Riepilogo', attiva: (p) => ['', 'confronto'].includes(parte(p)) },
    { a: `${base}/menu`, etichetta: 'Menù', attiva: (p) => parte(p) === 'menu' },
    { a: `${base}/partecipanti`, etichetta: 'Persone', attiva: (p) => ['partecipanti', 'chi-porta'].includes(parte(p)) },
    { a: `${base}/spesa`, etichetta: 'Prepara', attiva: (p) => ['spesa', 'piano'].includes(parte(p)) },
    { a: `${base}/bacheca`, etichetta: 'Bacheca', attiva: (p) => parte(p) === 'bacheca' },
  ]
}

function segmentiEvento(id: string, percorso: string): { etichetta: string; voci: Scheda[] } | null {
  const base = `/eventi/${id}`
  const p = parte(percorso)
  if (p === 'partecipanti' || p === 'chi-porta') {
    return {
      etichetta: 'Persone',
      voci: [
        { a: `${base}/partecipanti`, etichetta: 'Presenze', attiva: (x) => parte(x) === 'partecipanti' },
        { a: `${base}/chi-porta`, etichetta: 'Chi porta', attiva: (x) => parte(x) === 'chi-porta' },
      ],
    }
  }
  if (p === 'spesa' || p === 'piano') {
    return {
      etichetta: 'Prepara',
      voci: [
        { a: `${base}/spesa`, etichetta: 'Spesa', attiva: (x) => parte(x) === 'spesa' },
        { a: `${base}/piano`, etichetta: 'Piano', attiva: (x) => parte(x) === 'piano' },
      ],
    }
  }
  return null
}

/** Prepara: i piatti con una ricetta, ciascuno a un tocco dalla sua vista cucina. */
function CucinaRapida({ eventoId }: { eventoId: string }) {
  const menu = useMenu(eventoId)
  const voci = menu.data?.portate.flatMap((p) => p.voci).filter((v) => v.piattoId) ?? []
  if (!voci.length) return null
  return (
    <nav aria-label="Vista cucina dei piatti" className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:thin]">
      <CookingPot className="size-4 shrink-0 text-primario" aria-hidden />
      {voci.map((v) => (
        <Link key={v.id} to={`/eventi/${eventoId}/voci/${v.id}/cucina`} className="flex min-h-9 shrink-0 items-center rounded-full border border-bordo bg-carta px-3 hover:bg-tenue">
          {v.nome}
        </Link>
      ))}
    </nav>
  )
}

export function useEventoCorrente(): Evento {
  return useOutletContext<Evento>()
}

/**
 * Famiglia dell'evento diversa da quella attiva: lo si dice, con la possibilità di passare
 * a quella Famiglia (mai da soli: la Famiglia attiva la sceglie l'utente).
 */
function ContestoFamiglia({ eventoId }: { eventoId: string }) {
  const accesso = useAccessoEvento(eventoId)
  const { attiva, famiglie, multiple, scegli } = useFamigliaAttiva()
  const gruppo = accesso.data?.gruppo ?? null
  if (!multiple || !gruppo || gruppo.id === attiva?.id) return null
  const membro = famiglie.some((f) => f.id === gruppo.id)
  return (
    <div className="mx-auto max-w-3xl px-4 pt-3" data-testid="contesto-famiglia">
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-info-tenue px-3 py-2 text-sm text-info" role="note">
        <House className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          Evento della Famiglia «{gruppo.nome}»{attiva ? ` (la Famiglia attiva è «${attiva.nome}»)` : ''}.
        </span>
        {membro ? (
          <Button misura="piccolo" variante="contorno" onClick={() => scegli(gruppo.id)}>
            Passa a «{gruppo.nome}»
          </Button>
        ) : null}
      </p>
    </div>
  )
}

export function LayoutEvento() {
  const { id = '' } = useParams()
  const q = useEvento(id)
  const accesso = useAccessoEvento(id)
  const { multiple } = useFamigliaAttiva()
  const { pathname } = useLocation()
  if (q.isPending) return <Caricamento />
  if (q.isError || !q.data) {
    const assente = q.error instanceof ErroreRichiesta && q.error.stato === 404
    return (
      <Pagina titolo={assente ? 'Evento non disponibile' : 'Evento'} indietro="/">
        <Vuoto
          titolo={assente ? 'Questo evento non è disponibile' : 'Impossibile caricare l\'evento'}
          testo={assente ? 'Forse è stato eliminato, oppure non è più condiviso con te.' : 'Controlla la connessione al server.'}
        />
      </Pagina>
    )
  }
  const e = q.data
  const gruppo = accesso.data?.gruppo ?? null
  const segmenti = segmentiEvento(e.id, pathname)
  return (
    <div>
      <div className="non-stampare sticky top-0 z-20 border-b border-bordo/70 bg-sfondo/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <PulsanteIndietro a={e.stato === 'archiviato' ? '/?vista=archivio' : '/'} etichetta="Eventi" />
            {e.stato === 'archiviato' ? <Badge variante="info">Archiviato · sola lettura</Badge> : e.stato === 'concluso' ? <Badge>Concluso</Badge> : null}
            {accesso.data && accesso.data.permesso !== 'proprietario' ? (
              <Badge variante={accesso.data.permesso === 'lettura' ? 'info' : 'primario'} data-testid="permesso-evento">
                Di {accesso.data.proprietario.nome} · {accesso.data.permesso === 'lettura' ? 'sola lettura' : 'puoi modificare'}
              </Badge>
            ) : null}
            {multiple && gruppo ? (
              <Badge data-testid="famiglia-evento">
                <House className="mr-1 inline size-3" aria-hidden />
                {gruppo.nome}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="titolo mt-1 truncate text-[1.75rem] font-semibold leading-tight">{e.nome}</h1>
              <p className="text-sm text-testo-tenue first-letter:uppercase">
                {dataLunga(e.data)}
                {e.oraServizio ? ` · ore ${e.oraServizio}` : ''}
              </p>
            </div>
            <IllustrazioneEvento evento={e} className="h-14 w-auto shrink-0 sm:h-20" />
          </div>
          <Schede schede={schedeEvento(e.id)} etichetta="Schede dell'evento" className="-mx-2 mt-1" />
        </div>
      </div>
      <ContestoFamiglia eventoId={e.id} />
      {segmenti ? (
        <div className={cn('non-stampare mx-auto flex max-w-3xl flex-col gap-2 px-4 pt-3')}>
          <Segmenti voci={segmenti.voci} etichetta={segmenti.etichetta} />
          {segmenti.etichetta === 'Prepara' ? <CucinaRapida eventoId={e.id} /> : null}
        </div>
      ) : null}
      <SolaLettura motivo={accesso.data?.permesso === 'lettura' ? `Evento di ${accesso.data.proprietario.nome}, condiviso con te in sola lettura` : null}>
        <Outlet context={e} />
      </SolaLettura>
    </div>
  )
}

/** Contenitore delle schede: stessa larghezza dell'intestazione. */
export function CorpoScheda({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-12', className)}>{children}</div>
}
