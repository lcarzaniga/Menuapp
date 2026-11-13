// Errori applicativi tradotti in risposte HTTP dal livello API (SPEC §12.4).
import type { CodiceErrore } from '../../src/contratto/comune.ts'

export class ErroreApi extends Error {
  readonly stato: number
  readonly codice: CodiceErrore
  readonly dettagli: unknown

  constructor(stato: number, codice: CodiceErrore, messaggio: string, dettagli?: unknown) {
    super(messaggio)
    this.stato = stato
    this.codice = codice
    this.dettagli = dettagli
  }
}

export const nonTrovato = (cosa = 'Elemento') => new ErroreApi(404, 'non_trovato', `${cosa} non trovato`)

export const conflittoVersione = (attuale: unknown) =>
  new ErroreApi(409, 'conflitto_versione', 'Modificato da un altro dispositivo', { attuale })

export const idEsistente = () =>
  new ErroreApi(409, 'id_esistente', 'Esiste già un elemento con questo identificativo e contenuto diverso')

export const regolaViolata = (regola: string, messaggio: string, extra?: Record<string, unknown>) =>
  new ErroreApi(422, 'regola_violata', messaggio, { regola, ...extra })

export const richiestaNonValida = (messaggio: string, dettagli?: unknown) =>
  new ErroreApi(400, 'richiesta_non_valida', messaggio, dettagli)

/** Nessuna sessione valida: il dispositivo deve essere autorizzato. */
export const nonAutenticato = (messaggio = 'Questo dispositivo non è autorizzato') => new ErroreApi(401, 'non_autenticato', messaggio)

/** Risorsa visibile ma azione non permessa (es. sola lettura, funzione da amministratore). */
export const accessoNegato = (messaggio: string) => new ErroreApi(403, 'accesso_negato', messaggio)

export const troppiTentativi = () => new ErroreApi(429, 'troppi_tentativi', 'Troppi tentativi: riprova fra qualche minuto')
