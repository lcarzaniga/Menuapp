// Client HTTP tipizzato sul contratto (SPEC §12.4).
import type { z } from 'zod'
import { type CodiceErrore, PREFISSO_API, SchemaErrore } from '@/contratto/comune.ts'
import { segnalaEsito, segnalaSessionePersa } from '@/connessione/stato'

export class ErroreRichiesta extends Error {
  readonly stato: number
  readonly codice: CodiceErrore | 'rete'
  readonly dettagli: unknown
  constructor(stato: number, codice: CodiceErrore | 'rete', messaggio: string, dettagli?: unknown) {
    super(messaggio)
    this.stato = stato
    this.codice = codice
    this.dettagli = dettagli
  }
  get conflitto(): boolean {
    return this.codice === 'conflitto_versione'
  }
  /** Record attuale restituito dal server con un 409. */
  attuale<T>(): T | undefined {
    return (this.dettagli as { attuale?: T } | undefined)?.attuale
  }
  /** Messaggio per campo, se il server ha indicato quale. */
  get campi(): { campo: string; messaggio: string }[] {
    return (this.dettagli as { campi?: { campo: string; messaggio: string }[] } | undefined)?.campi ?? []
  }
}

let revisioneNota = -1
const ascoltatoriRevisione = new Set<(r: number) => void>()

export function revisioneCorrente(): number {
  return revisioneNota
}
export function aggiornaRevisione(r: number): void {
  revisioneNota = r
  ascoltatoriRevisione.forEach((f) => f(r))
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function richiesta<T>(metodo: Metodo, percorso: string, corpo?: unknown, schema?: z.ZodType<T>): Promise<T> {
  let risposta: Response
  const binario = corpo instanceof Blob
  try {
    risposta = await fetch(`${PREFISSO_API}${percorso}`, {
      method: metodo,
      headers:
        corpo === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': binario ? (corpo as Blob).type : 'application/json' },
      body: corpo === undefined ? undefined : binario ? (corpo as Blob) : JSON.stringify(corpo),
      cache: 'no-store',
    })
  } catch {
    segnalaEsito('rete')
    throw new ErroreRichiesta(0, 'rete', 'Server non raggiungibile: la modifica non è stata salvata')
  }
  if (risposta.status === 503) segnalaEsito('manutenzione')
  else segnalaEsito('ok')
  if (risposta.status === 401 && !percorso.startsWith('/sessione') && !percorso.startsWith('/accesso/')) segnalaSessionePersa()

  const intestazione = risposta.headers.get('x-revisione')
  if (intestazione !== null) revisioneNota = Number(intestazione)

  const testo = await risposta.text()
  let dati: unknown = undefined
  if (testo) {
    try {
      dati = JSON.parse(testo)
    } catch {
      dati = undefined
    }
  }
  if (!risposta.ok) {
    const e = SchemaErrore.safeParse(dati)
    if (e.success) throw new ErroreRichiesta(risposta.status, e.data.errore.codice, e.data.errore.messaggio, e.data.errore.dettagli)
    throw new ErroreRichiesta(risposta.status, 'errore_interno', `Errore del server (${risposta.status})`)
  }
  if (schema) {
    const r = schema.safeParse(dati)
    if (!r.success) throw new ErroreRichiesta(500, 'errore_interno', 'Risposta del server inattesa')
    return r.data
  }
  return dati as T
}

export const api = {
  leggi: <T>(percorso: string, schema?: z.ZodType<T>) => richiesta<T>('GET', percorso, undefined, schema),
  crea: <T>(percorso: string, corpo: unknown) => richiesta<T>('POST', percorso, corpo),
  modifica: <T>(percorso: string, corpo: unknown) => richiesta<T>('PUT', percorso, corpo),
  /** Carica un file (foto): il corpo è il file stesso, con il suo tipo. */
  file: <T>(metodo: 'POST' | 'PUT', percorso: string, dati: Blob) => richiesta<T>(metodo, percorso, dati),
  elimina: <T>(percorso: string, versione?: number) =>
    richiesta<T>('DELETE', versione === undefined ? percorso : `${percorso}${percorso.includes('?') ? '&' : '?'}versione=${versione}`),
}

/** Nuovo id per le creazioni (SPEC §6.1): generato dal client, rende idempotenti i tentativi ripetuti. */
export function nuovoId(): string {
  // randomUUID esiste solo in HTTPS/localhost; in rete locale (HTTP) si costruisce un UUID v4.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
