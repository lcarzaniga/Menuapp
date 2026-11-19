// Memoria di famiglia (SPEC §40). La storia è della ricetta (la scrive il proprietario, si pubblica
// solo esplicitamente); ricordi ed esperienze sono dei familiari (ognuno i suoi, con autore e data).
// Le esperienze non cambiano ingredienti né procedimento. Le copie non portano con sé la memoria.
import { randomUUID } from 'node:crypto'
import type { Memoria, MemoriaRicetta } from '../../src/contratto/memoria.ts'
import { pulisci } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repo from '../db/repo/memoria.ts'
import type { CartellaFile } from './cartella.ts'
import { regolaViolata } from './errori.ts'
import { caricaFoto, eliminaFoto, fotoMemoria } from './foto.ts'
import { permessoEvento, richiediContributoMemoria, richiediEvento, richiediMemoria, richiediPiatto, type UtenteCorrente } from './permessi.ts'
import { aggiornaConVersione, eliminaConVersione } from './versioni.ts'

function verso(db: Db, u: UtenteCorrente, r: repo.RigaMemoria): Memoria {
  const autore = r.tipo === 'storia' ? repoAccesso.proprietarioPiatto(db, r.piatto_id!) === u.id : r.autore_id === u.id
  const amministra = r.gruppo_id !== null && repoAccesso.ruoloNelGruppo(db, r.gruppo_id, u.id) === 'amministratore'
  return {
    id: r.id,
    tipo: r.tipo,
    testo: r.testo,
    // L'evento si nomina solo a chi lo vede.
    evento: r.evento_id && r.evento_nome && permessoEvento(db, u, r.evento_id) ? { id: r.evento_id, nome: r.evento_nome } : null,
    pubblica: r.pubblica === 1,
    autore: { id: r.autore_id, nome: r.autore_nome },
    foto: fotoMemoria(db, r.id),
    puoModificare: autore,
    puoEliminare: autore || amministra,
    versione: r.versione,
    creatoIl: r.creato_il,
    aggiornatoIl: r.aggiornato_il,
  }
}

/** Famiglia del contributo: quella con cui la ricetta è condivisa, altrimenti la sua d'origine. */
const famigliaDi = (db: Db, piattoId: string) => repoAccesso.famigliePiatto(db, piattoId)[0]?.id ?? repoAccesso.famigliaOriginePiatto(db, piattoId) ?? null

export function memoriaRicetta(db: Db, u: UtenteCorrente, piattoId: string): MemoriaRicetta {
  return lettura(db, () => {
    richiediPiatto(db, u, piattoId, 'lettura')
    const membro = repo.memoriaLeggibile(db, piattoId, u.id)
    const righe = repo.memoriePiatto(db, piattoId)
    const storia = righe.find((r) => r.tipo === 'storia')
    return {
      storia: storia && (membro || storia.pubblica === 1) ? verso(db, u, storia) : null,
      ricordi: membro ? righe.filter((r) => r.tipo === 'ricordo').map((r) => verso(db, u, r)) : [],
      esperienze: membro ? righe.filter((r) => r.tipo === 'esperienza').map((r) => verso(db, u, r)) : [],
      puoContribuire: repo.memoriaScrivibile(db, piattoId, u.id),
      puoScrivereStoria: repoAccesso.proprietarioPiatto(db, piattoId) === u.id,
      soloPubblica: !membro,
    }
  })
}

/** La storia della ricetta: una sola, del proprietario. Pubblicarla ha senso solo se la ricetta è pubblica. */
export function scriviStoria(db: Db, u: UtenteCorrente, piattoId: string, d: { testo: string; pubblica: boolean; versione?: number }, adesso = Date.now()): MemoriaRicetta {
  transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'proprietario')
    const esistente = repo.storiaPiatto(db, piattoId)
    if (!esistente) {
      repo.inserisciMemoria(db, { id: randomUUID(), gruppoId: famigliaDi(db, piattoId), piattoId, tipo: 'storia', testo: d.testo.trim(), eventoId: null, pubblica: d.pubblica, autoreId: u.id, autoreNome: u.nome }, adesso)
    } else {
      aggiornaConVersione(db, 'memorie', esistente.id, d.versione ?? esistente.versione, { testo: d.testo.trim(), pubblica: d.pubblica }, () => memoriaRicetta(db, u, piattoId), adesso)
    }
    incrementaRevisione(db)
  })
  return memoriaRicetta(db, u, piattoId)
}

function controllaEvento(db: Db, u: UtenteCorrente, eventoId: string | null | undefined): string | null {
  if (!eventoId) return null
  richiediEvento(db, u, eventoId, 'lettura')
  return eventoId
}

export function aggiungiMemoria(db: Db, u: UtenteCorrente, piattoId: string, d: { id: string; tipo: 'ricordo' | 'esperienza'; testo: string; eventoId?: string | null }, adesso = Date.now()): Memoria {
  return transazione(db, () => {
    richiediContributoMemoria(db, u, piattoId)
    const esistente = repo.leggiMemoria(db, d.id)
    if (esistente) {
      if (esistente.autore_id === u.id && esistente.piatto_id === piattoId) return verso(db, u, esistente) // ripetizione
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    if (!d.testo.trim()) throw regolaViolata('testo_vuoto', 'Scrivi qualcosa')
    const eventoId = d.tipo === 'esperienza' ? controllaEvento(db, u, d.eventoId) : null
    repo.inserisciMemoria(db, { id: d.id, gruppoId: famigliaDi(db, piattoId), piattoId, tipo: d.tipo, testo: d.testo.trim(), eventoId, pubblica: false, autoreId: u.id, autoreNome: u.nome }, adesso)
    incrementaRevisione(db)
    return verso(db, u, repo.leggiMemoria(db, d.id)!)
  })
}

export function aggiornaMemoria(db: Db, u: UtenteCorrente, id: string, d: { testo: string; eventoId?: string | null; versione: number }, adesso = Date.now()): Memoria {
  return transazione(db, () => {
    const m = richiediMemoria(db, u, id, 'modifica')
    if (m.tipo === 'storia') throw regolaViolata('storia', 'La storia si modifica dalla ricetta')
    if (!d.testo.trim()) throw regolaViolata('testo_vuoto', 'Scrivi qualcosa')
    const eventoId = m.tipo === 'esperienza' ? (d.eventoId === undefined ? m.evento_id : controllaEvento(db, u, d.eventoId)) : null
    aggiornaConVersione(db, 'memorie', id, d.versione, { testo: d.testo.trim(), evento_id: eventoId }, () => verso(db, u, repo.leggiMemoria(db, id)!), adesso)
    incrementaRevisione(db)
    return verso(db, u, repo.leggiMemoria(db, id)!)
  })
}

export async function eliminaMemoria(db: Db, cartella: CartellaFile, u: UtenteCorrente, id: string, versione: number): Promise<void> {
  const foto = transazione(db, () => {
    richiediMemoria(db, u, id, 'elimina')
    return fotoMemoria(db, id)
  })
  // Prima le foto (con i loro file), poi il contributo.
  for (const f of foto) await eliminaFoto(db, cartella, f.id, f.versione)
  transazione(db, () => {
    eliminaConVersione(db, 'memorie', id, versione, () => verso(db, u, repo.leggiMemoria(db, id)!))
    incrementaRevisione(db)
  })
}

export async function aggiungiFotoMemoria(db: Db, cartella: CartellaFile, u: UtenteCorrente, id: string, f: { id: string; dati: Uint8Array; didascalia: string }) {
  const m = lettura(db, () => richiediMemoria(db, u, id, 'modifica'))
  return caricaFoto(db, cartella, m.piatto_id!, { id: f.id, dati: f.dati, didascalia: pulisci(f.didascalia), principale: false, memoriaId: id })
}
