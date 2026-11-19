// Stile del menù stampato: lettura con predefiniti, salvataggio con versione (SPEC F8).
import { opzioniDaSalvate, type SalvaStileStampa, type StileStampa } from '../../src/contratto/stampa.ts'
import { opzioniPredefinite } from '../../src/domain/stampa.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repo from '../db/repo/stampa.ts'
import { snapshotValido } from './archivio.ts'
import { conflittoVersione } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'

function stileVivo(db: Db, eventoId: string): StileStampa {
  const e = leggiEvento(db, eventoId)
  const r = repo.leggiStile(db, eventoId)
  const predefinite = opzioniPredefinite(e)
  return {
    eventoId,
    opzioni: r ? opzioniDaSalvate(JSON.parse(r.opzioni), predefinite) : predefinite,
    versione: r?.versione ?? 0,
    aggiornatoIl: r?.aggiornato_il ?? null,
  }
}

/** Evento archiviato: lo stile è quello fotografato nello snapshot (se c'era). */
export function leggiStileStampa(db: Db, eventoId: string): StileStampa {
  return lettura(db, () => {
    const vivo = stileVivo(db, eventoId)
    if (leggiEvento(db, eventoId).stato !== 'archiviato') return vivo
    const s = snapshotValido(db, eventoId)
    const fotografate = s?.contenuto.stampa
    if (!s || !fotografate) return vivo
    return { ...vivo, opzioni: opzioniDaSalvate(fotografate, opzioniPredefinite(s.contenuto.evento)) }
  })
}

export function salvaStileStampa(db: Db, eventoId: string, dati: SalvaStileStampa, adesso = Date.now()): StileStampa {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    // Titolo vuoto = nome dell'evento.
    const titolo = dati.opzioni.titolo?.trim() || null
    const esiste = repo.leggiStile(db, eventoId)
    // I segnaposto (SPEC §42) stanno nella stessa riga: il menù non li tocca.
    const segnaposto = esiste ? (JSON.parse(esiste.opzioni) as { segnaposto?: unknown }).segnaposto : undefined
    const testo = JSON.stringify({ ...dati.opzioni, titolo, ...(segnaposto === undefined ? {} : { segnaposto }) })
    if (dati.versione === 0 && !esiste) repo.inserisciStile(db, eventoId, testo, adesso)
    else if (repo.aggiornaStile(db, eventoId, dati.versione, testo, adesso) !== 1) throw conflittoVersione(stileVivo(db, eventoId))
    incrementaRevisione(db)
    return stileVivo(db, eventoId)
  })
}
