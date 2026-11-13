// Dispositivo non autorizzato: attivazione su invito e attesa dell'approvazione (SPEC §19.2).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, KeyRound, ShieldX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, ErroreRichiesta } from '@/api/client'
import { Caricamento } from '@/components/Pagina'
import { Tavola } from '@/components/Illustrazioni'
import { Button } from '@/components/ui/button'
import { Campo, Input } from '@/components/ui/campi'
import type { StatoAttivazione } from '@/contratto/accesso.ts'
import { chiaviAccesso, nomeDispositivoProposto, useSessione } from './sessione'

const chiaveRichiesta = ['richiesta-attivazione'] as const

/** Richiesta di attivazione di questo browser (dal cookie): null se non ce n'è. */
function useRichiestaAttivazione(attesa: boolean) {
  return useQuery({
    queryKey: chiaveRichiesta,
    queryFn: async (): Promise<StatoAttivazione | null> => {
      try {
        return await api.leggi<StatoAttivazione>('/accesso/richiesta')
      } catch (e) {
        if (e instanceof ErroreRichiesta && e.stato === 404) return null
        throw e
      }
    },
    refetchInterval: attesa ? 3000 : false,
    retry: false,
  })
}

function Cornice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <main className="w-full max-w-md rounded-3xl border border-bordo/70 bg-carta p-6 text-center shadow-carta sm:p-8">
        <Tavola className="mx-auto mb-2 h-16 w-auto" />
        <p className="titolo text-2xl font-semibold text-primario">Menù &amp; Co.</p>
        <span className="filetto mx-auto mb-5 mt-1 block w-24" />
        {children}
      </main>
    </div>
  )
}

/** Stato della richiesta: codice da confrontare, attesa, esito. */
function StatoRichiesta({ r }: { r: StatoAttivazione }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [errore, setErrore] = useState<string | null>(null)
  useEffect(() => {
    if (r.stato !== 'approvata') return
    let annullato = false
    void (async () => {
      try {
        await api.crea('/accesso/completa', {})
        if (annullato) return
        client.clear()
        await client.invalidateQueries({ queryKey: chiaviAccesso.sessione })
        navigate('/', { replace: true })
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Attivazione non riuscita')
      }
    })()
    return () => {
      annullato = true
    }
  }, [r.stato, client, navigate])

  if (r.stato === 'rifiutata' || r.stato === 'scaduta') {
    return (
      <div className="flex flex-col items-center gap-2">
        <ShieldX className="size-10 text-pericolo" />
        <h1 className="titolo text-xl font-semibold">{r.stato === 'rifiutata' ? 'Richiesta non approvata' : 'Richiesta scaduta'}</h1>
        <p className="text-sm text-testo-tenue">Chiedi un nuovo invito a chi gestisce Menù &amp; Co.</p>
      </div>
    )
  }
  if (r.stato === 'approvata' || r.stato === 'completata') {
    return (
      <div className="flex flex-col items-center gap-2">
        <CheckCircle2 className="size-10 text-successo" />
        <h1 className="titolo text-xl font-semibold">Dispositivo autorizzato</h1>
        <p className="text-sm text-testo-tenue">{errore ?? 'Apertura dell\'app…'}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3" aria-live="polite">
      <Clock className="size-10 text-oro" />
      <h1 className="titolo text-xl font-semibold">In attesa di approvazione</h1>
      <p className="text-sm text-testo-tenue">
        Richiesta di accesso come <strong className="text-testo">{r.utenteNome}</strong>. Chi ti ha invitato vedrà questo codice: controllate che sia lo stesso.
      </p>
      <p className="titolo rounded-2xl bg-tenue px-5 py-3 text-3xl font-semibold tracking-[0.18em]" data-testid="codice-attivazione">
        {r.codice}
      </p>
      <p className="text-xs text-testo-tenue">Lascia aperta questa pagina: si aggiorna da sola.</p>
    </div>
  )
}

/** Pagina del link d'invito: #/attiva/<token>. */
export function PaginaAttivazione() {
  const { token = '' } = useParams()
  const sessione = useSessione()
  const richiesta = useRichiestaAttivazione(false)
  const client = useQueryClient()
  const [dispositivo, setDispositivo] = useState(nomeDispositivoProposto)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  if (sessione.isPending || richiesta.isPending) return <Caricamento />
  if (sessione.data) {
    return (
      <Cornice>
        <CheckCircle2 className="mx-auto size-10 text-successo" />
        <h1 className="titolo mt-2 text-xl font-semibold">Questo dispositivo è già autorizzato</h1>
        <p className="mt-1 text-sm text-testo-tenue">Sei collegato come {sessione.data.utente.nome}. L&apos;invito non è stato usato.</p>
        <Button asChild className="mt-5">
          <a href="#/">Apri Menù &amp; Co.</a>
        </Button>
      </Cornice>
    )
  }
  if (richiesta.data && richiesta.data.stato !== 'rifiutata' && richiesta.data.stato !== 'scaduta') return <PaginaAccesso />

  const invia = async () => {
    setInCorso(true)
    setErrore(null)
    try {
      const r = await api.crea<StatoAttivazione>('/accesso/richiesta', { invito: token, dispositivo: dispositivo.trim() })
      // Il token non resta nella cronologia del browser.
      window.history.replaceState(null, '', '#/accesso')
      client.setQueryData(chiaveRichiesta, r)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Richiesta non riuscita')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Cornice>
      <KeyRound className="mx-auto size-10 text-primario" />
      <h1 className="titolo mt-2 text-xl font-semibold">Autorizza questo dispositivo</h1>
      <p className="mt-1 text-sm text-testo-tenue">Hai ricevuto un invito. Dai un nome a questo dispositivo e chiedi l&apos;accesso: chi ti ha invitato lo approverà.</p>
      <div className="mt-5 text-left">
        <Campo etichetta="Nome del dispositivo" htmlFor="dispositivo" aiuto="Ti aiuterà a riconoscerlo nell'elenco dei dispositivi." errore={errore ?? undefined}>
          <Input id="dispositivo" value={dispositivo} maxLength={80} onChange={(e) => setDispositivo(e.target.value)} />
        </Campo>
      </div>
      <Button className="mt-5 w-full" misura="grande" onClick={() => void invia()} disabled={inCorso || !token}>
        {inCorso ? 'Invio…' : 'Richiedi l\'accesso'}
      </Button>
    </Cornice>
  )
}

/** Schermata per un dispositivo senza sessione: attesa di una richiesta oppure spiegazione. */
export function PaginaAccesso({ revocata = false }: { revocata?: boolean }) {
  const richiesta = useRichiestaAttivazione(true)
  if (richiesta.isPending) return <Caricamento />
  const r = richiesta.data
  return (
    <Cornice>
      {r && r.stato !== 'completata' ? (
        <StatoRichiesta r={r} />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <KeyRound className="size-10 text-primario" />
          <h1 className="titolo text-xl font-semibold">{revocata ? 'Accesso non più valido' : 'Dispositivo non autorizzato'}</h1>
          <p className="text-sm text-testo-tenue">
            {revocata
              ? 'L\'autorizzazione di questo dispositivo è stata revocata o è scaduta.'
              : 'Menù & Co. si usa su invito.'}{' '}
            Per entrare apri il link d&apos;invito che hai ricevuto, oppure chiedine uno nuovo a chi gestisce l&apos;app.
          </p>
        </div>
      )}
    </Cornice>
  )
}
