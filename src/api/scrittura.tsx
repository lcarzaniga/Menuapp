// Scritture verso il server: sola lettura senza connessione, conflitti di versione
// con scelta esplicita, messaggi di esito (SPEC §12.5, §13).
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { statoConnessione } from '@/connessione/stato'
import { ErroreRichiesta } from './client'

export interface Conflitto {
  titolo: string
  attuale: unknown
  descriviAttuale?: (attuale: unknown) => string
  onRicarica: () => void
  onSovrascrivi?: () => void
}

let conflitto: Conflitto | null = null
const ascoltatori = new Set<() => void>()
const avvisa = () => ascoltatori.forEach((f) => f())

export function mostraConflitto(c: Conflitto | null): void {
  conflitto = c
  avvisa()
}

export function useConflitto(): Conflitto | null {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f)
      return () => ascoltatori.delete(f)
    },
    () => conflitto,
    () => conflitto,
  )
}

export interface OpzioniScrittura<I, O> {
  /** Messaggio breve dopo il salvataggio (null = nessun messaggio). */
  successo?: string | null | ((risultato: O) => string | null)
  /** Cosa si stava modificando, per la finestra di conflitto. */
  oggetto?: string
  /** Ricostruisce l'ingresso con la versione attuale per «Sovrascrivi». Senza: solo «Ricarica». */
  sovrascrivi?: (ingresso: I, attuale: unknown) => I
  /** Se il record attuale coincide già con quanto si voleva salvare (risposta persa), nessun conflitto. */
  coincide?: (ingresso: I, attuale: unknown) => boolean
  dopo?: (risultato: O) => void
  dopoErrore?: (e: ErroreRichiesta) => void
}

export function messaggioErrore(e: unknown): string {
  if (e instanceof ErroreRichiesta) return e.message
  return 'Errore inatteso: la modifica potrebbe non essere stata salvata'
}

/**
 * Esegue una scrittura. Restituisce il risultato o undefined se non è andata a buon fine
 * (l'utente è già stato avvisato).
 */
export function useScrittura<I, O>(fn: (ingresso: I) => Promise<O>, opzioni: OpzioniScrittura<I, O> = {}) {
  const client = useQueryClient()
  const [inCorso, setInCorso] = useState(false)
  const opz = useRef(opzioni)
  useEffect(() => {
    opz.current = opzioni
  })
  const ripeti = useRef<(ingresso: I) => Promise<O | undefined>>(async () => undefined)

  const esegui = useCallback(
    async (ingresso: I): Promise<O | undefined> => {
      const o = opz.current
      if (statoConnessione() !== 'connesso') {
        toast.error('Server non raggiungibile: le modifiche sono disattivate')
        return undefined
      }
      setInCorso(true)
      try {
        const risultato = await fn(ingresso)
        const msg = typeof o.successo === 'function' ? o.successo(risultato) : o.successo === undefined ? 'Salvato' : o.successo
        if (msg) toast.success(msg, { duration: 1800 })
        await client.invalidateQueries()
        o.dopo?.(risultato)
        return risultato
      } catch (e) {
        if (e instanceof ErroreRichiesta && e.conflitto) {
          const attuale = e.attuale()
          if (o.coincide?.(ingresso, attuale)) {
            await client.invalidateQueries()
            return undefined
          }
          mostraConflitto({
            titolo: o.oggetto ?? 'Questo elemento',
            attuale,
            onRicarica: () => {
              mostraConflitto(null)
              void client.invalidateQueries()
            },
            onSovrascrivi: o.sovrascrivi
              ? () => {
                  mostraConflitto(null)
                  void ripeti.current(o.sovrascrivi!(ingresso, attuale))
                }
              : undefined,
          })
        } else {
          toast.error(messaggioErrore(e))
          if (e instanceof ErroreRichiesta) o.dopoErrore?.(e)
          if (e instanceof ErroreRichiesta && e.codice === 'non_trovato') void client.invalidateQueries()
        }
        return undefined
      } finally {
        setInCorso(false)
      }
    },
    [client, fn],
  )

  useEffect(() => {
    ripeti.current = esegui
  }, [esegui])

  return { esegui, inCorso }
}
