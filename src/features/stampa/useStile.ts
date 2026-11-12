// Stile di stampa con salvataggio automatico sul server, versione per versione.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, ErroreRichiesta } from '@/api/client'
import { chiaviEventi } from '@/api/query'
import { messaggioErrore } from '@/api/scrittura'
import type { StileStampa } from '@/contratto/stampa.ts'
import type { OpzioniStampa } from '@/domain/stampa.ts'

export type StatoSalvataggio = 'salvato' | 'in_attesa' | 'salvataggio' | 'errore'

const ATTESA_MS = 600

/**
 * Le modifiche si vedono subito nell'anteprima e si salvano dopo una breve pausa, una
 * richiesta alla volta. Se un altro dispositivo ha salvato nel frattempo (409), si adotta
 * il suo stile e lo si dice.
 */
export function useStile(eventoId: string, stile: StileStampa | undefined, modificabile: boolean) {
  const client = useQueryClient()
  const [locali, setLocali] = useState<OpzioniStampa | null>(null)
  const [stato, setStato] = useState<StatoSalvataggio>('salvato')
  const rif = useRef({ versione: -1, pendenti: null as OpzioniStampa | null, inVolo: false, timer: 0 as ReturnType<typeof setTimeout> | 0 })

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
          const salvato = await api.modifica<StileStampa>(`/eventi/${eventoId}/stampa`, { opzioni, versione: Math.max(0, r.versione) })
          r.versione = salvato.versione
          client.setQueryData(chiaviEventi.stampa(eventoId), salvato)
        } catch (e) {
          if (e instanceof ErroreRichiesta && e.conflitto) {
            const attuale = e.attuale<StileStampa>()
            r.pendenti = null
            if (attuale) {
              r.versione = attuale.versione
              client.setQueryData(chiaviEventi.stampa(eventoId), attuale)
            } else void client.invalidateQueries({ queryKey: chiaviEventi.stampa(eventoId) })
            setLocali(null)
            setStato('salvato')
            toast.warning('Lo stile è stato cambiato da un altro dispositivo: ora vedi quello più recente')
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
  }, [client, eventoId])

  const cambia = useCallback(
    (nuove: OpzioniStampa) => {
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
