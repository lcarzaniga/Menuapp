// Aiutanti per i test del server: SQLite reale in una cartella temporanea.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apriDatabase, chiudiDatabase, type Db } from './db/connessione.ts'
import { applicaMigrazioni } from './db/migrazioni/esegui.ts'
import { eseguiSeed } from './db/seed/seed.ts'

export interface DbDiProva {
  db: Db
  cartella: string
  percorso: string
  cartellaBackup: string
  chiudi: () => void
}

export function cartellaTemporanea(prefisso = 'menuapp-test-'): { cartella: string; elimina: () => void } {
  const cartella = mkdtempSync(join(tmpdir(), prefisso))
  return { cartella, elimina: () => rmSync(cartella, { recursive: true, force: true }) }
}

export async function dbDiProva(opzioni: { seed?: boolean } = {}): Promise<DbDiProva> {
  const { cartella, elimina } = cartellaTemporanea()
  const percorso = join(cartella, 'menuapp.db')
  const cartellaBackup = join(cartella, 'backup')
  const db = apriDatabase(percorso)
  await applicaMigrazioni(db, { cartellaBackup })
  if (opzioni.seed !== false) eseguiSeed(db)
  return {
    db,
    cartella,
    percorso,
    cartellaBackup,
    chiudi: () => {
      chiudiDatabase(db)
      elimina()
    },
  }
}

import type { FastifyInstance, InjectOptions } from 'fastify'
import { costruisciApp, type TipoIngresso } from './app.ts'
import * as identita from './servizi/identita.ts'
import type { Contesto } from './api/aiuti.ts'
import { leggiConfig } from './config.ts'
import { RegistroRipristini } from './backup/ripristino.ts'

type Risposta = Awaited<ReturnType<FastifyInstance['inject']>>

export const ORIGINE_PROVA = 'http://localhost:5173'

/** Client HTTP di prova legato a una sessione (o anonimo). */
export interface ClientDiProva {
  /** Richiesta di scrittura come la farebbe il browser (Origin + JSON + cookie di sessione). */
  scrivi: (metodo: 'POST' | 'PUT' | 'DELETE', url: string, corpo?: unknown) => Promise<Risposta>
  leggi: (url: string) => Promise<Risposta>
  cookie: string | null
}

export interface AppDiProva extends DbDiProva, ClientDiProva {
  app: FastifyInstance
  ctx: Contesto
  inietta: (o: InjectOptions) => Promise<Risposta>
  /** Client senza sessione. */
  anonimo: ClientDiProva
  /** Nuovo utente con un dispositivo autorizzato (o client di un utente esistente). */
  utente: (nome: string, ruolo?: 'utente' | 'amministratore', famiglia?: boolean) => ClientDiProva & { id: string }
  /** Client con una nuova sessione per un utente esistente. */
  sessione: (utenteId: string) => ClientDiProva
}

export const ID_AMMINISTRATORE = 'utente-amministratore'
const NOME_COOKIE = '__Host-menuapp-sessione'

/** Sessione creata come nel flusso reale: invito → richiesta → approvazione → completamento. */
export function nuovaSessione(db: Db, utenteId: string): string {
  const invito = identita.creaInvito(db, null, utenteId, 'https://prova.invalid')
  const token = invito.link.split('/#/attiva/')[1]!
  const { segreto } = identita.richiediAttivazione(db, { invito: token, dispositivo: 'Prova', agente: 'vitest' })
  const richiesta = identita.richiesteInAttesa(db, null).find((r) => r.utenteId === utenteId)!
  identita.decidiRichiesta(db, null, richiesta.id, 'approva')
  return identita.completaAttivazione(db, segreto)!.token
}

export async function appDiProva(opzioni: { statici?: string; lan?: boolean; ingresso?: TipoIngresso; config?: Record<string, string> } = {}): Promise<AppDiProva> {
  const p = await dbDiProva()
  const config = {
    ...leggiConfig({ MENUAPP_DATI: p.cartella, MENUAPP_ORIGINI: ORIGINE_PROVA, ...opzioni.config }),
    cartellaStatici: opzioni.statici ?? null,
  }
  const ctx: Contesto = {
    db: p.db,
    config,
    stato: { manutenzione: false },
    versioneApp: '0.0.0-test',
    ripristini: new RegistroRipristini(join(p.cartella, 'ripristino-temp')),
  }
  const app = await costruisciApp(ctx, { lan: opzioni.lan, ingresso: opzioni.ingresso })
  const client = (token: string | null): ClientDiProva => {
    const cookie = token ? `${NOME_COOKIE}=${token}` : null
    const base = cookie ? { cookie } : {}
    return {
      cookie,
      scrivi: async (metodo, url, corpo) =>
        app.inject({
          method: metodo,
          url,
          headers: corpo === undefined ? { origin: ORIGINE_PROVA, ...base } : { origin: ORIGINE_PROVA, 'content-type': 'application/json', ...base },
          ...(corpo === undefined ? {} : { payload: JSON.stringify(corpo) }),
        }),
      leggi: async (url) => app.inject({ method: 'GET', url, headers: base }),
    }
  }
  const amministratore = client(nuovaSessione(p.db, ID_AMMINISTRATORE))
  return {
    ...p,
    ...amministratore,
    app,
    ctx,
    anonimo: client(null),
    // Richiesta libera: con la sessione dell'amministratore, salvo cookie indicato.
    inietta: async (o) => app.inject({ ...o, headers: { cookie: amministratore.cookie!, ...(o.headers as Record<string, string> | undefined) } }),
    utente: (nome, ruolo = 'utente', famiglia = true) => {
      const esistente = identita.elencaUtenti(p.db).find((u) => u.nome === nome)
      const id = esistente?.id ?? identita.creaUtente(p.db, { id: `utente-${nome.toLowerCase()}`, nome, ruolo, famiglia }).id
      return { ...client(nuovaSessione(p.db, id)), id }
    },
    sessione: (utenteId) => client(nuovaSessione(p.db, utenteId)),
    chiudi: () => {
      void app.close()
      p.chiudi()
    },
  }
}
