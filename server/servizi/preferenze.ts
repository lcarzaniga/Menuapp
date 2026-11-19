// Preferenze personali, uguali su tutti i dispositivi dell'utente (SPEC §36).
import type { Preferenze } from '../../src/contratto/ricettario.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repo from '../db/repo/preferenze.ts'
import { conflittoVersione } from './errori.ts'

export function leggiPreferenze(db: Db, utenteId: string): Preferenze {
  return lettura(db, () => {
    const r = repo.leggi(db, utenteId)
    return { includiPubbliche: r.includi_pubbliche === 1, versione: r.versione }
  })
}

export function impostaPreferenze(db: Db, utenteId: string, p: Preferenze, adesso = Date.now()): Preferenze {
  return transazione(db, () => {
    if (!repo.scrivi(db, utenteId, p.includiPubbliche, p.versione, adesso)) throw conflittoVersione(leggiPreferenze(db, utenteId))
    return leggiPreferenze(db, utenteId)
  })
}
