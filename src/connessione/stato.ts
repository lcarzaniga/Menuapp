// Stato della connessione al server e modalità sola lettura (SPEC §13).
import { createContext, createElement, type ReactNode, useContext, useSyncExternalStore } from 'react'

export type StatoConnessione = 'connesso' | 'non_raggiungibile' | 'in_manutenzione'

let stato: StatoConnessione = 'connesso'
let fallimenti = 0
const ascoltatori = new Set<() => void>()

function imposta(nuovo: StatoConnessione) {
  if (nuovo === stato) return
  const eraOffline = stato !== 'connesso'
  stato = nuovo
  ascoltatori.forEach((f) => f())
  if (eraOffline && nuovo === 'connesso') alRitorno.forEach((f) => f())
}

const alRitorno = new Set<() => void>()
/** Funzioni da eseguire quando la connessione torna (es. ricaricare i dati). */
export function quandoTorna(f: () => void): () => void {
  alRitorno.add(f)
  return () => alRitorno.delete(f)
}

/** Esito di ogni chiamata: due fallimenti di rete consecutivi → non raggiungibile. */
export function segnalaEsito(esito: 'ok' | 'rete' | 'manutenzione'): void {
  if (esito === 'ok') {
    fallimenti = 0
    imposta('connesso')
  } else if (esito === 'manutenzione') {
    imposta('in_manutenzione')
  } else {
    fallimenti += 1
    if (fallimenti >= 2 || (typeof navigator !== 'undefined' && navigator.onLine === false)) imposta('non_raggiungibile')
  }
}

export function statoConnessione(): StatoConnessione {
  return stato
}

/** Solo per i test. */
export function reimpostaConnessione(s: StatoConnessione = 'connesso'): void {
  fallimenti = 0
  stato = s
  ascoltatori.forEach((f) => f())
}

function iscrivi(f: () => void) {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}

export function useStatoConnessione(): StatoConnessione {
  return useSyncExternalStore(iscrivi, statoConnessione, statoConnessione)
}

/** Unico punto che decide se i comandi di scrittura sono attivi. */
export function usePuoScrivere(): boolean {
  const connesso = useStatoConnessione() === 'connesso'
  const solaLettura = useContext(ContestoSolaLettura) !== null
  return connesso && !solaLettura
}

/**
 * Sola lettura per permesso (evento condiviso in lettura, ricetta di un altro utente): tutti
 * i comandi sotto questo contenitore che usano usePuoScrivere() si disattivano. Il server
 * rifiuta comunque le scritture non permesse.
 */
const ContestoSolaLettura = createContext<string | null>(null)

export function SolaLettura({ motivo, children }: { motivo: string | null; children: ReactNode }) {
  // Un contenitore interno non può riattivare ciò che uno esterno ha messo in sola lettura.
  const esterno = useContext(ContestoSolaLettura)
  return createElement(ContestoSolaLettura.Provider, { value: esterno ?? motivo }, children)
}

/** Motivo della sola lettura per permesso (null se si può modificare). */
export function useMotivoSolaLettura(): string | null {
  return useContext(ContestoSolaLettura)
}

// ── Sessione ─────────────────────────────────────────────────

const ascoltatoriSessione = new Set<() => void>()
/** Il server ha risposto 401: questo dispositivo non è (più) autorizzato. */
export function segnalaSessionePersa(): void {
  ascoltatoriSessione.forEach((f) => f())
}
export function quandoSessionePersa(f: () => void): () => void {
  ascoltatoriSessione.add(f)
  return () => ascoltatoriSessione.delete(f)
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => imposta('non_raggiungibile'))
}
