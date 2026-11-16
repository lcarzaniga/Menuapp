// Elementi comuni di account e amministrazione: link d'invito, richieste, dispositivi.
import { Check, Copy, MonitorSmartphone, Send, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Conferma } from '@/components/ui/dialog'
import type { InvitoCreato, Richiesta, Sessione } from '@/contratto/accesso.ts'
import { usePuoScrivere } from '@/connessione/stato'
import { dataOra } from './sessione'

/** Link d'invito appena creato: unico momento in cui è visibile. Copia o invio con WhatsApp. */
export function LinkInvito({ invito, onChiudi }: { invito: InvitoCreato; onChiudi: () => void }) {
  const [copiato, setCopiato] = useState(false)
  const testo = `Ciao ${invito.utenteNome}! Apri questo link per usare Ricette di famiglia & Co. su questo dispositivo (vale 24 ore, una sola volta):\n${invito.link}`
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(invito.link)
      setCopiato(true)
      toast.success('Link copiato')
    } catch {
      toast.error('Copia non riuscita: seleziona il link e copialo a mano')
    }
  }
  return (
    <div className="rounded-2xl border border-primario/40 bg-primario-tenue/40 p-4" data-testid="link-invito">
      <p className="text-sm font-medium">Invito per {invito.utenteNome}</p>
      <p className="mt-0.5 text-xs text-testo-tenue">Valido fino a {dataOra(invito.scadeIl)}, una sola volta. Dopo l&apos;apertura dovrai approvare il dispositivo.</p>
      <input readOnly value={invito.link} aria-label="Link d'invito" onFocus={(e) => e.currentTarget.select()} className="mt-3 w-full rounded-xl border border-bordo bg-carta px-3 py-2 font-mono text-xs" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button misura="piccolo" onClick={() => void copia()}>
          {copiato ? <Check /> : <Copy />} {copiato ? 'Copiato' : 'Copia il link'}
        </Button>
        <Button misura="piccolo" variante="contorno" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(testo)}`} target="_blank" rel="noreferrer noopener">
            <Send /> Invia con WhatsApp
          </a>
        </Button>
        <Button misura="piccolo" variante="fantasma" onClick={onChiudi}>
          Fatto
        </Button>
      </div>
    </div>
  )
}

/** Richieste di attivazione in attesa, con il codice da confrontare. */
export function RichiesteInAttesa({ richieste, mostraUtente = true }: { richieste: Richiesta[]; mostraUtente?: boolean }) {
  const puoScrivere = usePuoScrivere()
  const decidi = useScrittura((d: { id: string; azione: 'approva' | 'rifiuta' }) => api.crea<Richiesta>(`/richieste/${d.id}/${d.azione}`, {}), {
    successo: (r) => (r.stato === 'approvata' ? 'Dispositivo approvato' : 'Richiesta rifiutata'),
  })
  if (richieste.length === 0) return <p className="text-sm text-testo-tenue">Nessuna richiesta in attesa.</p>
  return (
    <ul className="flex flex-col gap-2">
      {richieste.map((r) => (
        <li key={r.id} className="rounded-2xl border border-oro/60 bg-carta p-3" data-testid="richiesta">
          <div className="flex flex-wrap items-center gap-2">
            <MonitorSmartphone className="size-5 text-oro" />
            <span className="font-medium">{mostraUtente ? `${r.utenteNome} · ` : ''}{r.dispositivo || 'Dispositivo senza nome'}</span>
            <span className="titolo ml-auto rounded-lg bg-tenue px-2 py-0.5 font-semibold tracking-widest" aria-label={`Codice ${r.codice}`}>
              {r.codice}
            </span>
          </div>
          <p className="mt-1 text-xs text-testo-tenue">
            Richiesta {dataOra(r.creatoIl)} · {r.agente.slice(0, 90)}
          </p>
          <p className="mt-1 text-xs text-testo-tenue">Approva solo se il codice coincide con quello mostrato sul dispositivo.</p>
          <div className="mt-2 flex gap-2">
            <Button misura="piccolo" disabled={!puoScrivere || decidi.inCorso} onClick={() => void decidi.esegui({ id: r.id, azione: 'approva' })}>
              <ShieldCheck /> Approva
            </Button>
            <Button misura="piccolo" variante="contorno" disabled={!puoScrivere || decidi.inCorso} onClick={() => void decidi.esegui({ id: r.id, azione: 'rifiuta' })}>
              <X /> Rifiuta
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Dispositivi autorizzati con revoca singola. */
export function ElencoDispositivi({ sessioni, percorsoRevoca, mostraUtente = false }: { sessioni: Sessione[]; percorsoRevoca: (id: string) => string; mostraUtente?: boolean }) {
  const puoScrivere = usePuoScrivere()
  const [daRevocare, setDaRevocare] = useState<Sessione | null>(null)
  const revoca = useScrittura((s: Sessione) => api.elimina(percorsoRevoca(s.id)), { successo: 'Dispositivo scollegato' })
  return (
    <>
      <ul className="flex flex-col divide-y divide-bordo/60">
        {sessioni.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5" data-testid="dispositivo">
            <MonitorSmartphone className="size-5 shrink-0 text-testo-tenue" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {mostraUtente ? `${s.utenteNome} · ` : ''}
                {s.dispositivo || 'Dispositivo senza nome'} {s.corrente ? <Badge variante="successo">questo dispositivo</Badge> : null}
              </p>
              <p className="text-xs text-testo-tenue">Autorizzato {dataOra(s.creatoIl)} · ultimo uso {dataOra(s.ultimoUso)}</p>
            </div>
            {!s.corrente ? (
              <Button misura="piccolo" variante="contorno" disabled={!puoScrivere} onClick={() => setDaRevocare(s)}>
                Scollega
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Conferma
        aperta={daRevocare !== null}
        onCambia={(a) => !a && setDaRevocare(null)}
        titolo="Scollegare il dispositivo?"
        descrizione={`«${daRevocare?.dispositivo || 'Dispositivo senza nome'}» non potrà più aprire Ricette di famiglia & Co. finché non viene autorizzato di nuovo con un invito.`}
        etichettaConferma="Scollega"
        pericolosa
        onConferma={() => {
          if (daRevocare) void revoca.esegui(daRevocare)
          setDaRevocare(null)
        }}
      />
    </>
  )
}
