// Ricorrenze di una Famiglia (SPEC §28) e ricorrenza degli eventi, anche standard (§30): «Natale», «Compleanno Carlo»… per raggruppare eventi
// da ritrovare, duplicare e confrontare. Nessuna data né frequenza. I membri le creano e le
// rinominano; eliminarle (gli eventi restano) spetta a chi amministra la Famiglia.
import type { Ricorrenza } from '../../src/contratto/edizioni.ts'
import type { SceltaRicorrenza } from '../../src/contratto/eventi.ts'
import { standardPerOccasione } from '../../src/domain/ricorrenze.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import type * as repoEventi from '../db/repo/eventi.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repo from '../db/repo/ricorrenze.ts'
import { conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import { richiediGruppo, type UtenteCorrente } from './permessi.ts'

const verso = (r: repo.RigaRicorrenza): Ricorrenza => ({ id: r.id, nome: r.nome, descrizione: r.descrizione, eventi: r.eventi, versione: r.versione })

export function elenca(db: Db, u: UtenteCorrente, gruppoId: string): Ricorrenza[] {
  return lettura(db, () => {
    richiediGruppo(db, u, gruppoId)
    return repo.ricorrenzeFamiglia(db, gruppoId).map(verso)
  })
}

/** Ricorrenza visibile a chi fa parte della sua Famiglia (404 per gli altri). */
export function richiedi(db: Db, u: UtenteCorrente, id: string): repo.RigaRicorrenza {
  const r = repo.leggiRicorrenza(db, id)
  if (!r) throw nonTrovato('Ricorrenza')
  try {
    richiediGruppo(db, u, r.gruppo_id)
  } catch {
    throw nonTrovato('Ricorrenza')
  }
  return r
}

function controllaNome(db: Db, gruppoId: string, nome: string, escludi?: string): void {
  const chiave = norm(nome)
  const altra = repo.ricorrenzeFamiglia(db, gruppoId).find((r) => r.id !== escludi && norm(r.nome) === chiave)
  if (altra) throw regolaViolata('nome_ricorrenza', `Esiste già la ricorrenza «${altra.nome}»`)
}

export function crea(db: Db, u: UtenteCorrente, gruppoId: string, d: { id: string; nome: string; descrizione: string }, adesso = Date.now()): Ricorrenza {
  return transazione(db, () => {
    richiediGruppo(db, u, gruppoId)
    const esistente = repo.leggiRicorrenza(db, d.id)
    if (esistente) {
      if (esistente.gruppo_id === gruppoId) return verso(esistente)
      throw nonTrovato('Ricorrenza')
    }
    const nome = pulisci(d.nome)
    controllaNome(db, gruppoId, nome)
    repo.inserisciRicorrenza(db, { id: d.id, gruppoId, nome, nomeNorm: norm(nome), descrizione: pulisci(d.descrizione), creatoDa: u.id }, adesso)
    incrementaRevisione(db)
    return verso(repo.leggiRicorrenza(db, d.id)!)
  })
}

export function aggiorna(db: Db, u: UtenteCorrente, id: string, d: { nome: string; descrizione: string; versione: number }, adesso = Date.now()): Ricorrenza {
  return transazione(db, () => {
    const r = richiedi(db, u, id)
    const nome = pulisci(d.nome)
    controllaNome(db, r.gruppo_id, nome, id)
    if (repo.aggiornaRicorrenza(db, id, d.versione, { nome, nomeNorm: norm(nome), descrizione: pulisci(d.descrizione) }, adesso) !== 1) throw conflittoVersione(verso(r))
    incrementaRevisione(db)
    return verso(repo.leggiRicorrenza(db, id)!)
  })
}

export function elimina(db: Db, u: UtenteCorrente, id: string): void {
  transazione(db, () => {
    const r = richiedi(db, u, id)
    richiediGruppo(db, u, r.gruppo_id, 'amministratore')
    repo.eliminaRicorrenza(db, id)
    incrementaRevisione(db)
  })
}

// ── Ricorrenza di un evento: della Famiglia o standard (SPEC §28, §30) ─────────

/** Una ricorrenza della Famiglia indicata (che l'utente ha già dimostrato di frequentare). */
export function ricorrenzaDellaFamiglia(db: Db, ricorrenzaId: string, gruppoId: string | null): string {
  const r = repo.leggiRicorrenza(db, ricorrenzaId)
  if (!r) throw nonTrovato('Ricorrenza')
  if (r.gruppo_id !== gruppoId) throw regolaViolata('ricorrenza_altra_famiglia', 'La ricorrenza è di un\'altra Famiglia')
  return r.id
}

/** Scelta esplicita → colonne dell'evento. Le ricorrenze (anche standard) valgono solo nelle Famiglie. */
export function risolviScelta(db: Db, scelta: SceltaRicorrenza | null, gruppoId: string | null): { ricorrenzaId: string | null; standard: string | null } {
  if (!scelta) return { ricorrenzaId: null, standard: null }
  if (!gruppoId) throw regolaViolata('evento_personale', 'Un evento personale non ha ricorrenze: spostalo prima in una Famiglia')
  if (scelta.tipo === 'famiglia') return { ricorrenzaId: ricorrenzaDellaFamiglia(db, scelta.id, gruppoId), standard: null }
  return { ricorrenzaId: null, standard: scelta.id }
}

/** Associazione automatica: la ricorrenza standard indicata dall'occasione, per gli eventi di una Famiglia. */
export function automatica(occasione: string, gruppoId: string | null): repoEventi.AssociazioneRicorrenza {
  return { ricorrenzaId: null, standard: gruppoId ? (standardPerOccasione(occasione)?.id ?? null) : null, manuale: false }
}
