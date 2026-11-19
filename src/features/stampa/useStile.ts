// Stile di stampa e segnaposto con salvataggio automatico sul server, versione per versione.
import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, ErroreRichiesta } from '@/api/client'
import { chiaviEventi } from '@/api/query'
import { messaggioErrore } from '@/api/scrittura'
import type { Segnaposto } from '@/contratto/segnaposto.ts'
import type { StileStampa } from '@/contratto/stampa.ts'
import type { OpzioniSegnaposto } from '@/domain/segnaposto.ts'
import type { OpzioniStampa } from '@/domain/stampa.ts'

export type StatoSalvataggio = 'salvato' | 'in_attesa' | 'salvataggio' | 'errore'

const ATTESA_MS = 600

interface Salvabile<T> {
  opzioni: T
  versione: number
}

interface Destinazione {
  url: string
  chiave: QueryKey
  /** Le altre letture della stessa riga (menù e segnaposto condividono la versione). */
  collegate: QueryKey[]
  avvisoConflitto: string
}

export function useStile(eventoId: string, stile: StileStampa | undefined, modificabile: boolean) {
  return useSalvataggio<OpzioniStampa, StileStampa>(
    { url: `/eventi/${eventoId}/stampa`, chiave: chiaviEventi.stampa(eventoId), collegate: [chiaviEventi.segnaposto(eventoId)], avvisoConflitto: 'Lo stile è stato cambiato da un altro dispositivo: ora vedi quello più recente' },
    stile,
    modificabile,
  )
}

export function useSalvaSegnaposto(eventoId: string, dati: Segnaposto | undefined, modificabile: boolean) {
  return useSalvataggio<OpzioniSegnaposto, Segnaposto>(
    { url: `/eventi/${eventoId}/segnaposto`, chiave: chiaviEventi.segnaposto(eventoId), collegate: [chiaviEventi.stampa(eventoId)], avvisoConflitto: 'I segnaposto o lo stile di stampa sono stati cambiati da un altro dispositivo: ora vedi la versione più recente' },
    dati,
    modificabile,
  )
}

/**
 * Le modifiche si vedono subito nell'anteprima e si salvano dopo una breve pausa, una
 * richiesta alla volta. Se un altro dispositivo ha salvato nel frattempo (409), si adotta
 * la sua versione e lo si dice.
 */
function useSalvataggio<T, R extends Salvabile<T>>(dest: Destinazione, stile: R | undefined, modificabile: boolean) {
  const client = useQueryClient()
  const [locali, setLocali] = useState<T | null>(null)
  const [stato, setStato] = useState<StatoSalvataggio>('salvato')
  const rif = useRef({ versione: -1, pendenti: null as T | null, inVolo: false, timer: 0 as ReturnType<typeof setTimeout> | 0 })
  const { url, chiave, collegate, avvisoConflitto } = dest

  // Versione nuova dal server (altro dispositivo) e nessuna modifica locale in sospeso: la si adotta.
  useEffect(() => {
    const r = rif.current
    if (!stile || stile.versione === r.versione || r.pendenti || r.inVolo) return
    r.versione = stile.versione
    setLocali(null)
  }, [stile])

  const invia = useCallback(async (): Promise<void> => {
    const r = rif.current
    if (r.inVolo) return
    r.inVolo = true
    try {
      // Una richiesta alla volta; se nel frattempo è cambiato qualcosa, si salva di nuovo.
      while (r.pendenti) {
        const opzioni = r.pendenti
        r.pendenti = null
        setStato('salvataggio')
        try {
          const salvato = await api.modifica<R>(url, { opzioni, versione: Math.max(0, r.versione) })
          r.versione = salvato.versione
          client.setQueryData(chiave, salvato)
          for (const k of collegate) void client.invalidateQueries({ queryKey: k })
        } catch (e) {
          if (e instanceof ErroreRichiesta && e.conflitto) {
            const attuale = e.attuale<R>()
            r.pendenti = null
            if (attuale) {
              r.versione = attuale.versione
              client.setQueryData(chiave, attuale)
            } else void client.invalidateQueries({ queryKey: chiave })
            for (const k of collegate) void client.invalidateQueries({ queryKey: k })
            setLocali(null)
            setStato('salvato')
            toast.warning(avvisoConflitto)
            return
          }
          r.pendenti ??= opzioni
          setStato('errore')
          toast.error(messaggioErrore(e))
          return
        }
      }
      setStato('salvato')
    } finally {
      r.inVolo = false
    }
    // Solo l'url: chiavi e messaggio ne dipendono; dipendenze nuove a ogni render rifarebbero il salvataggio all'uscita.
  }, [client, url])

  const cambia = useCallback(
    (nuove: T) => {
      if (!modificabile) return
      const r = rif.current
      setLocali(nuove)
      r.pendenti = nuove
      setStato('in_attesa')
      if (r.timer) clearTimeout(r.timer)
      r.timer = setTimeout(() => {
        r.timer = 0
        void invia()
      }, ATTESA_MS)
    },
    [invia, modificabile],
  )

  /** Salva subito quanto in sospeso (prima di stampare o uscire). */
  const salvaOra = useCallback(async () => {
    const r = rif.current
    if (r.timer) {
      clearTimeout(r.timer)
      r.timer = 0
    }
    await invia()
  }, [invia])

  useEffect(
    () => () => {
      void salvaOra()
    },
    [salvaOra],
  )

  return { opzioni: locali ?? stile?.opzioni, cambia, stato, salvaOra, riprova: invia }
}
