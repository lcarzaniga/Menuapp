// I piatti più apprezzati (SPEC §20.7). Si valuta il piatto servito in un evento (la voce),
// non la ricetta: nome, portata e ricetta d'origine sono fotografati al voto, così le
// valutazioni restano anche se ricetta o voce cambiano, e l'evento archiviato le conserva.
import type { ValutazioniEvento, VoceClassifica } from '../../src/contratto/famiglia.ts'
import { oggiISO } from '../../src/domain/tempo.ts'
import { norm } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import { regolaViolata } from './errori.ts'
import { leggiEvento } from './eventi.ts'
import { avvisa } from './notifiche.ts'
import { richiediEvento, richiediPiatto, richiediVoce, type UtenteCorrente } from './permessi.ts'

/** Si valuta a evento avvenuto: concluso, archiviato o con la data già arrivata. */
export function valutabile(e: { stato: string; data: string }, oggi = oggiISO()): boolean {
  return e.stato !== 'attivo' || e.data <= oggi
}

export function dellEvento(db: Db, u: UtenteCorrente, eventoId: string): ValutazioniEvento {
  return lettura(db, () => {
    richiediEvento(db, u, eventoId, 'lettura')
    const voti = repo.valutazioniEvento(db, eventoId)
    const perVoce = new Map<string, number[]>()
    for (const v of voti) perVoce.set(v.voce_id, [...(perVoce.get(v.voce_id) ?? []), v.stelle])
    return {
      valutabile: valutabile(leggiEvento(db, eventoId)),
      voci: [...perVoce.entries()].map(([voceId, stelle]) => ({
        voceId,
        media: Math.round((stelle.reduce((a, b) => a + b, 0) / stelle.length) * 10) / 10,
        numero: stelle.length,
        mie: voti.find((v) => v.voce_id === voceId && v.utente_id === u.id)?.stelle ?? null,
      })),
    }
  })
}

/** Un voto per utente e piatto servito: votare di nuovo lo sostituisce (da qualunque dispositivo). */
export function valuta(db: Db, u: UtenteCorrente, voceId: string, stelle: number, adesso = Date.now()): ValutazioniEvento {
  return transazione(db, () => {
    const eventoId = richiediVoce(db, u, voceId, 'partecipa')
    if (!valutabile(leggiEvento(db, eventoId))) throw regolaViolata('evento_non_avvenuto', 'I piatti si valutano dopo l\'evento')
    const v = repo.leggiVoceIncarico(db, voceId)!
    const piattoId = repoRic.voceConPiatto(db, voceId)
    const origine = piattoId ? (repoRic.proprietaPiatto(db, piattoId)?.originePiattoId ?? piattoId) : null
    const prima = repo.valutazioniEvento(db, eventoId).some((x) => x.voce_id === voceId && x.utente_id === u.id)
    repo.scriviValutazione(db, { eventoId, voceId, utenteId: u.id, stelle, nomePiatto: v.nome, portata: v.portata, ricettaOrigineId: origine }, adesso)
    // Chi ha preparato il piatto viene a sapere che è stato valutato (raggruppato per evento).
    if (!prima && v.incaricato_id) {
      avvisa(db, { tipo: 'valutazione', attoreId: u.id, destinatari: [v.incaricato_id], chiave: `valutazioni:${eventoId}`, eventoId, testo: `Nuove stelle per «${v.nome}»` }, adesso)
    }
    incrementaRevisione(db)
    return dellEvento(db, u, eventoId)
  })
}

export function togli(db: Db, u: UtenteCorrente, voceId: string): ValutazioniEvento {
  return transazione(db, () => {
    const eventoId = richiediVoce(db, u, voceId, 'partecipa')
    repo.togliValutazione(db, voceId, u.id)
    incrementaRevisione(db)
    return dellEvento(db, u, eventoId)
  })
}

/**
 * Media ponderata: si parte come se ogni piatto avesse già 3 voti da 3 stelle (il centro della
 * scala). Con pochi voti il punteggio resta prudente; con molti conta la media vera.
 */
const PESO_PRIORE = 3
const MEDIA_PRIORE = 3

/**
 * Classifica dei piatti negli eventi visibili all'utente. Le preparazioni della stessa ricetta
 * (copie comprese) si sommano tramite la ricetta d'origine; i piatti senza ricetta restano
 * separati per evento (nessuna fusione per nome). Ordine per media bayesiana:
 * (C × m + somma) / (C + n), con m = 3 stelle e C = 3: un solo 5 (3,5) non supera molti 4 (≈3,9).
 */
export function classifica(db: Db, u: UtenteCorrente, filtri: { portata?: string; anno?: string; gruppo?: string } = {}): VoceClassifica[] {
  return lettura(db, () => {
    // Classifica di una Famiglia: solo gli eventi di quella Famiglia (fra quelli visibili).
    let voti = repo.valutazioniVisibili(db, u.id).filter((v) => !filtri.gruppo || v.gruppo_id === filtri.gruppo)
    if (filtri.anno) voti = voti.filter((v) => v.data.startsWith(filtri.anno!))
    if (filtri.portata) {
      const p = norm(filtri.portata).replace(/[aeio]$/, '')
      voti = voti.filter((v) => norm(v.portata).startsWith(p))
    }
    if (voti.length === 0) return []
    const gruppi = new Map<string, typeof voti>()
    for (const v of voti) {
      const chiave = v.ricetta_origine_id ? `ricetta:${v.ricetta_origine_id}` : `voce:${v.voce_id}`
      gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), v])
    }
    const leggibile = (id: string) => {
      try {
        richiediPiatto(db, u, id, 'lettura')
        return true
      } catch {
        return false
      }
    }
    return [...gruppi.entries()]
      .map(([chiave, vs]) => {
        const recente = [...vs].sort((a, b) => b.aggiornato_il - a.aggiornato_il)[0]!
        const somma = vs.reduce((a, v) => a + v.stelle, 0)
        const origine = recente.ricetta_origine_id
        return {
          chiave,
          nome: recente.nome_piatto,
          portata: recente.portata,
          // Il collegamento alla ricetta solo se chi guarda può leggerla.
          ricettaId: origine && repoAccesso.proprietarioPiatto(db, origine) && leggibile(origine) ? origine : null,
          media: Math.round((somma / vs.length) * 10) / 10,
          punteggio: Math.round(((PESO_PRIORE * MEDIA_PRIORE + somma) / (PESO_PRIORE + vs.length)) * 100) / 100,
          numero: vs.length,
          eventi: new Set(vs.map((v) => v.evento_id)).size,
        }
      })
      .sort((a, b) => b.punteggio - a.punteggio || b.numero - a.numero || a.nome.localeCompare(b.nome, 'it'))
  })
}
