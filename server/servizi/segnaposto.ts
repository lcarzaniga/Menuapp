// Segnaposto nominativi (SPEC §42): stanno nella riga dello stile di stampa dell'evento, sotto la
// chiave `segnaposto`, con la stessa versione. Il menù e i segnaposto si salvano senza toccarsi.
import { type SalvaSegnaposto, type Segnaposto, segnapostoDaSalvati } from '../../src/contratto/segnaposto.ts'
import { nomiDaPartecipanti, segnapostoPredefiniti, type StileSegnaposto } from '../../src/domain/segnaposto.ts'
import type { OpzioniStampa } from '../../src/domain/stampa.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repo from '../db/repo/stampa.ts'
import { snapshotValido } from './archivio.ts'
import { conflittoVersione } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'
import * as partecipanti from './partecipanti.ts'
import type { UtenteCorrente } from './permessi.ts'
import { leggiStileStampa } from './stampa.ts'

const stileDi = (o: OpzioniStampa): StileSegnaposto => ({ modello: o.modello, palette: o.palette, caratteri: o.caratteri, decorazioni: o.decorazioni })

/** Il JSON salvato nella riga (menù e segnaposto), o un oggetto vuoto. */
function salvato(db: Db, eventoId: string): Record<string, unknown> {
  const r = repo.leggiStile(db, eventoId)
  return r ? (JSON.parse(r.opzioni) as Record<string, unknown>) : {}
}

function leggi(db: Db, u: UtenteCorrente, eventoId: string): Segnaposto {
  const stampa = leggiStileStampa(db, eventoId)
  const e = leggiEvento(db, eventoId)
  // Evento archiviato: i segnaposto com'erano all'archiviazione, se c'erano.
  const fotografati = e.stato === 'archiviato' ? (snapshotValido(db, eventoId)?.contenuto.stampa as Record<string, unknown> | null | undefined)?.segnaposto : undefined
  const salvati = segnapostoDaSalvati(fotografati ?? salvato(db, eventoId).segnaposto)
  const nomiPartecipanti = nomiDaPartecipanti(partecipanti.elenca(db, u, eventoId).inviti)
  const proposti = nomiPartecipanti.map((testo, i) => ({ id: `partecipante-${i + 1}`, testo, stampa: true, copie: 1 }))
  const r = repo.leggiStile(db, eventoId)
  return {
    eventoId,
    opzioni: salvati ?? segnapostoPredefiniti(proposti),
    salvati: salvati !== undefined,
    nomiPartecipanti,
    stileMenu: stileDi(stampa.opzioni),
    versione: r?.versione ?? 0,
    aggiornatoIl: r?.aggiornato_il ?? null,
  }
}

export function leggiSegnaposto(db: Db, u: UtenteCorrente, eventoId: string): Segnaposto {
  return lettura(db, () => leggi(db, u, eventoId))
}

export function salvaSegnaposto(db: Db, u: UtenteCorrente, eventoId: string, dati: SalvaSegnaposto, adesso = Date.now()): Segnaposto {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    const testoEvento = dati.opzioni.testoEvento?.trim() || null
    const nomi = dati.opzioni.nomi.map((n) => ({ ...n, testo: n.testo.trim() }))
    // Le opzioni del menù restano come sono: si cambia solo la chiave dei segnaposto.
    const testo = JSON.stringify({ ...salvato(db, eventoId), segnaposto: { ...dati.opzioni, nomi, testoEvento } })
    const esiste = repo.leggiStile(db, eventoId)
    if (dati.versione === 0 && !esiste) repo.inserisciStile(db, eventoId, testo, adesso)
    else if (repo.aggiornaStile(db, eventoId, dati.versione, testo, adesso) !== 1) throw conflittoVersione(leggi(db, u, eventoId))
    incrementaRevisione(db)
    return leggi(db, u, eventoId)
  })
}
