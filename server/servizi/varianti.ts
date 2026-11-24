// Varianti delle ricette nelle voci del menù (SPEC §44): ingredienti adattati per un evento, copiati
// nella voce e indipendenti; «Usa una versione precedente» ne propone le ultime accessibili.
import type { ImpostaVariante, VariantePrecedente } from '../../src/contratto/eventi.ts'
import type { VarianteVoce } from '../../src/domain/tipi.ts'
import { type Db, transazione, tutti } from '../db/connessione.ts'
import * as repo from '../db/repo/eventi.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { snapshotValido } from './archivio.ts'
import { leggiEvento, leggiVoce, richiediModificabile, variantePer } from './eventi.ts'
import { regolaViolata } from './errori.ts'
import { permessoEvento, type UtenteCorrente } from './permessi.ts'
import { controllaVersione } from './versioni.ts'

/** Al più tante varianti in «Usa una versione precedente», dalla più recente. */
export const MASSIMO_VARIANTI = 20

/** Salva (o toglie, con `null`) gli ingredienti adattati di una voce. Permesso già verificato. */
export function impostaVariante(db: Db, voceId: string, d: ImpostaVariante, adesso = Date.now()) {
  return transazione(db, () => {
    const v = leggiVoce(db, voceId)
    richiediModificabile(leggiEvento(db, v.eventoId))
    controllaVersione(db, 'voci_menu', voceId, d.versione, () => leggiVoce(db, voceId))
    if (d.variante && (!v.piattoId || v.daDefinire)) throw regolaViolata('voce_senza_ricetta', 'Si adattano gli ingredienti solo di una voce con una ricetta')
    repo.scriviVariante(db, voceId, variantePer(db, v.piattoId, d.variante), adesso)
    incrementaRevisione(db)
    return leggiVoce(db, voceId)
  })
}

/**
 * Varianti della stessa ricetta d'origine (copie comprese) in altre voci, solo negli eventi che
 * l'utente vede. Per gli eventi archiviati vale la variante conservata nell'archivio, non la voce viva.
 * L'identità è la voce (mai il nome dell'evento, che serve solo a riconoscerla). Niente doppioni
 * tolti: le ultime `MASSIMO_VARIANTI`, dalla data dell'evento più recente.
 */
export function variantiPrecedenti(db: Db, u: UtenteCorrente, voceId: string): VariantePrecedente[] {
  const voce = leggiVoce(db, voceId)
  if (!voce.piattoId) return []
  const origine = repo.origineRicetta(db, voce.piattoId)
  const trovate: VariantePrecedente[] = []
  // Eventi non archiviati: la variante della voce viva (una ricetta eliminata la fa decadere).
  const vive = tutti<{ voce_id: string; voce_nome: string; variante: string; evento_id: string; evento_nome: string; data: string }>(
    db,
    `SELECT v.id AS voce_id, v.nome AS voce_nome, v.variante, e.id AS evento_id, e.nome AS evento_nome, e.data
     FROM voci_menu v JOIN eventi e ON e.id = v.evento_id
     WHERE v.variante IS NOT NULL AND v.piatto_id IS NOT NULL AND e.stato <> 'archiviato' AND v.id <> ?
       AND json_extract(v.variante, '$.ricettaOrigine') = ?`,
    voceId,
    origine,
  )
  for (const r of vive) {
    if (!permessoEvento(db, u, r.evento_id)) continue
    trovate.push({ voceId: r.voce_id, eventoId: r.evento_id, eventoNome: r.evento_nome, data: r.data, archiviato: false, voceNome: r.voce_nome, variante: JSON.parse(r.variante) as VarianteVoce })
  }
  // Eventi archiviati: dall'archivio valido (filtro grossolano sul testo, poi lettura vera).
  const archiviati = tutti<{ evento_id: string }>(
    db,
    `SELECT e.id AS evento_id FROM eventi e JOIN snapshot_eventi s ON s.evento_id = e.id AND s.stato = 'valido'
     WHERE e.stato = 'archiviato' AND instr(s.contenuto, ?) > 0`,
    origine,
  )
  for (const { evento_id } of archiviati) {
    if (!permessoEvento(db, u, evento_id)) continue
    const s = snapshotValido(db, evento_id)
    if (!s) continue
    for (const p of s.contenuto.menu) {
      for (const v of p.voci) {
        if (v.id === voceId || !v.variante || v.variante.ricettaOrigine !== origine) continue
        trovate.push({ voceId: v.id, eventoId: evento_id, eventoNome: s.contenuto.evento.nome, data: s.contenuto.evento.data, archiviato: true, voceNome: v.nome, variante: v.variante })
      }
    }
  }
  return trovate.sort((a, b) => b.data.localeCompare(a.data) || a.eventoNome.localeCompare(b.eventoNome, 'it')).slice(0, MASSIMO_VARIANTI)
}
