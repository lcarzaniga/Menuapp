// Chi porta cosa (SPEC §20.5, §22). La responsabilità di un piatto resta sulla voce del menù
// («A cura di»): qui si aggiungono chi (utente con l'app o persona senza account della
// rubrica), note, se è fatto, e le cose da portare che non sono piatti. Ogni presa in carico
// è condizionata alla versione: due persone non prendono la stessa cosa.
//
// Regole esplicite sulla spesa:
// - chi si prende (o a chi viene affidato) un piatto «porto tutto io»: la voce esce dalla spesa
//   e lo si ricorda;
// - alla rinuncia o a un cambio di responsabile la voce torna nella spesa solo se ne era uscita
//   per quella presa in carico; altrimenti la spesa non cambia.
// Le persone senza account sono solo nomi: nessuna identità, sessione o permesso.
import { randomUUID } from 'node:crypto'
import type { Assegnazione, Incarichi, Incarico } from '../../src/contratto/famiglia.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { accessoNegato, conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'
import { avvisa, personeEvento } from './notifiche.ts'
import { permessoEvento, puoPartecipare, richiediEvento, type UtenteCorrente } from './permessi.ts'

export type TipoIncarico = 'voce' | 'cosa'

function stato(r: { incaricato: string; completato: boolean }): Incarico['stato'] {
  if (!r.incaricato) return 'da_assegnare'
  return r.completato ? 'completato' : 'assegnato'
}

function persone(db: Db, eventoId: string) {
  return personeEvento(db, eventoId)
    .map((id) => repoAccesso.leggiUtente(db, id))
    .filter((x) => x !== undefined && x.stato === 'attivo')
    .map((x) => ({ id: x!.id, nome: x!.nome }))
}

export function elenca(db: Db, u: UtenteCorrente, eventoId: string): Incarichi {
  return lettura(db, () => {
    const permesso = richiediEvento(db, u, eventoId, 'lettura')
    const archiviato = leggiEvento(db, eventoId).stato === 'archiviato'
    const partecipa = puoPartecipare(db, u, eventoId) && !archiviato
    const gestisce = (permesso === 'proprietario' || permesso === 'modifica') && !archiviato
    const famigliaId = repoAccesso.gruppoEvento(db, eventoId)
    const flags = (incaricato: string, incaricatoId: string | null, creatoDa: string | null) => ({
      puoPrendere: partecipa && !incaricato,
      puoRinunciare: Boolean(incaricato) && ((partecipa && incaricatoId === u.id) || gestisce),
      puoCompletare: Boolean(incaricato) && ((partecipa && incaricatoId === u.id) || gestisce),
      puoGestire: gestisce || (partecipa && creatoDa === u.id),
    })
    const voci: Incarico[] = repo.vociIncarichi(db, eventoId).map((v) => ({
      tipo: 'voce',
      id: v.id,
      nome: v.nome,
      portata: v.portata,
      quantita: '',
      quantitaNumero: null,
      unita: '',
      porzioni: v.porzioni,
      note: v.note_incarico,
      incaricato: v.incaricato,
      incaricatoId: v.incaricato_id,
      incaricatoEsternoId: v.incaricato_esterno_id,
      stato: stato({ incaricato: v.incaricato, completato: v.incarico_completato === 1 }),
      inSpesa: v.in_spesa === 1,
      spesaToltaDaIncarico: v.spesa_tolta_da_incarico === 1,
      versione: v.versione,
      ...flags(v.incaricato, v.incaricato_id, null),
      puoGestire: gestisce,
    }))
    const cose: Incarico[] = repo.coseEvento(db, eventoId).map((c) => ({
      tipo: 'cosa',
      id: c.id,
      nome: c.nome,
      portata: null,
      quantita: c.quantita,
      quantitaNumero: c.quantita_numero,
      unita: c.unita,
      porzioni: null,
      note: c.note,
      incaricato: c.incaricato,
      incaricatoId: c.incaricato_id,
      incaricatoEsternoId: c.incaricato_esterno_id,
      stato: stato({ incaricato: c.incaricato, completato: c.completato === 1 }),
      inSpesa: null,
      spesaToltaDaIncarico: false,
      versione: c.versione,
      ...flags(c.incaricato, c.incaricato_id, c.creato_da),
    }))
    return {
      incarichi: [...voci, ...cose],
      puoPartecipare: partecipa,
      puoAssegnare: gestisce,
      persone: persone(db, eventoId),
      // La rubrica della Famiglia la vede chi organizza e ne fa parte.
      rubrica: gestisce && famigliaId && repoAccesso.ruoloNelGruppo(db, famigliaId, u.id) ? repo.rubrica(db, famigliaId).map((e) => ({ id: e.id, nome: e.nome })) : [],
      famigliaId,
    }
  })
}

/** Evento dell'incarico, verificando che chi chiede lo veda (prima di validare il corpo). */
export function richiediIncarico(db: Db, u: UtenteCorrente, tipo: TipoIncarico, id: string): string {
  const eventoId = tipo === 'voce' ? repo.leggiVoceIncarico(db, id)?.evento_id : repo.leggiCosa(db, id)?.evento_id
  if (!eventoId) throw nonTrovato(tipo === 'voce' ? 'Voce' : 'Elemento')
  richiediEvento(db, u, eventoId, 'lettura', tipo === 'voce' ? 'Voce' : 'Elemento')
  return eventoId
}

interface Riga {
  tipo: TipoIncarico
  id: string
  eventoId: string
  nome: string
  incaricato: string
  incaricatoId: string | null
  esternoId: string | null
  note: string
  completato: boolean
  versione: number
  inSpesa: boolean
  spesaTolta: boolean
  creatoDa: string | null
}

function leggi(db: Db, tipo: TipoIncarico, id: string): Riga {
  if (tipo === 'voce') {
    const v = repo.leggiVoceIncarico(db, id)
    if (!v) throw nonTrovato('Voce')
    return {
      tipo, id, eventoId: v.evento_id, nome: v.nome, incaricato: v.incaricato, incaricatoId: v.incaricato_id, esternoId: v.incaricato_esterno_id,
      note: v.note_incarico, completato: v.incarico_completato === 1, versione: v.versione, inSpesa: v.in_spesa === 1, spesaTolta: v.spesa_tolta_da_incarico === 1, creatoDa: null,
    }
  }
  const c = repo.leggiCosa(db, id)
  if (!c) throw nonTrovato('Elemento')
  return {
    tipo, id, eventoId: c.evento_id, nome: c.nome, incaricato: c.incaricato, incaricatoId: c.incaricato_id, esternoId: c.incaricato_esterno_id,
    note: c.note, completato: c.completato === 1, versione: c.versione, inSpesa: false, spesaTolta: false, creatoDa: c.creato_da,
  }
}

function incaricoAttuale(db: Db, u: UtenteCorrente, r: Riga): Incarico {
  return elenca(db, u, r.eventoId).incarichi.find((x) => x.tipo === r.tipo && x.id === r.id)!
}

interface Responsabile {
  incaricato: string
  incaricatoId: string | null
  esternoId: string | null
}
const NESSUNO: Responsabile = { incaricato: '', incaricatoId: null, esternoId: null }

/** Scrive l'incarico solo se la versione è quella letta; altrimenti 409 con lo stato attuale. */
function scrivi(
  db: Db,
  u: UtenteCorrente,
  r: Riga,
  versione: number,
  c: Responsabile & { completato: boolean; inSpesa: boolean; spesaTolta: boolean; note?: string },
  adesso: number,
): void {
  const n =
    r.tipo === 'voce'
      ? repo.scriviIncaricoVoce(db, r.id, versione, { ...c, note: c.note ?? r.note }, adesso)
      : repo.scriviIncaricoCosa(db, r.id, versione, { incaricato: c.incaricato, incaricatoId: c.incaricatoId, esternoId: c.esternoId, completato: c.completato }, adesso)
  if (n !== 1) throw conflittoVersione(incaricoAttuale(db, u, r))
}

function preparaScrittura(db: Db, u: UtenteCorrente, tipo: TipoIncarico, id: string, versione: number) {
  const r = leggi(db, tipo, id)
  richiediEvento(db, u, r.eventoId, 'partecipa')
  richiediModificabile(leggiEvento(db, r.eventoId))
  if (r.versione !== versione) throw conflittoVersione(incaricoAttuale(db, u, r))
  const permesso = permessoEvento(db, u, r.eventoId)
  return { r, gestisce: permesso === 'proprietario' || permesso === 'modifica' }
}

/** Mi offro: solo se nessuno se n'è già preso carico. */
export function prendi(db: Db, u: UtenteCorrente, tipo: TipoIncarico, id: string, versione: number, togliDallaSpesa: boolean, adesso = Date.now()): Incarico {
  return transazione(db, () => {
    const { r } = preparaScrittura(db, u, tipo, id, versione)
    if (r.incaricato) throw conflittoVersione(incaricoAttuale(db, u, r))
    const toglie = tipo === 'voce' && togliDallaSpesa && r.inSpesa
    scrivi(db, u, r, versione, { incaricato: u.nome, incaricatoId: u.id, esternoId: null, completato: false, inSpesa: toglie ? false : r.inSpesa, spesaTolta: toglie }, adesso)
    avvisa(db, { tipo: 'incarico', attoreId: u.id, destinatari: personeEvento(db, r.eventoId), chiave: `incarichi:${r.eventoId}`, eventoId: r.eventoId, testo: `${u.nome} porta «${r.nome}»` }, adesso)
    incrementaRevisione(db)
    return incaricoAttuale(db, u, r)
  })
}

/** Rinuncia (chi l'aveva preso) o liberazione (chi organizza). La spesa torna com'era; le note restano. */
export function rinuncia(db: Db, u: UtenteCorrente, tipo: TipoIncarico, id: string, versione: number, adesso = Date.now()): Incarico {
  return transazione(db, () => {
    const { r, gestisce } = preparaScrittura(db, u, tipo, id, versione)
    if (!r.incaricato) return incaricoAttuale(db, u, r)
    if (r.incaricatoId !== u.id && !gestisce) throw accessoNegato('Solo chi se n\'è preso carico (o chi organizza) può rinunciare')
    scrivi(db, u, r, versione, { ...NESSUNO, completato: false, inSpesa: r.spesaTolta ? true : r.inSpesa, spesaTolta: false }, adesso)
    avvisa(
      db,
      { tipo: 'incarico', attoreId: u.id, destinatari: personeEvento(db, r.eventoId), chiave: `incarichi:${r.eventoId}`, eventoId: r.eventoId, testo: `«${r.nome}» è di nuovo da assegnare` },
      adesso,
    )
    incrementaRevisione(db)
    return incaricoAttuale(db, u, r)
  })
}

/**
 * Chi è il responsabile scelto. Un nome scritto che coincide con un membro della Famiglia
 * o con una persona della rubrica diventa quella persona (niente doppioni); altrimenti resta
 * un nome libero, salvato in rubrica se richiesto (e se l'evento ha una Famiglia).
 */
function risolviResponsabile(db: Db, u: UtenteCorrente, eventoId: string, a: Assegnazione, adesso: number): Responsabile & { utente: boolean } {
  const famiglia = repoAccesso.gruppoEvento(db, eventoId)
  if (a.utenteId) {
    if (!personeEvento(db, eventoId).includes(a.utenteId)) throw nonTrovato('Persona')
    const p = repoAccesso.leggiUtente(db, a.utenteId)!
    return { incaricato: p.nome, incaricatoId: p.id, esternoId: null, utente: true }
  }
  if (a.esternoId) {
    const e = repo.leggiEsterno(db, a.esternoId)
    // Solo persone della rubrica della Famiglia dell'evento, e solo per chi ne fa parte.
    if (!e || e.gruppo_id !== famiglia || !repoAccesso.ruoloNelGruppo(db, famiglia, u.id)) throw nonTrovato('Persona')
    return { incaricato: e.nome, incaricatoId: null, esternoId: e.id, utente: false }
  }
  const nome = pulisci(a.nome!)
  const chiave = norm(nome)
  const invitato = persone(db, eventoId).find((p) => norm(p.nome) === chiave)
  if (invitato) return { incaricato: invitato.nome, incaricatoId: invitato.id, esternoId: null, utente: true }
  if (famiglia && repoAccesso.ruoloNelGruppo(db, famiglia, u.id)) {
    const membro = repoAccesso.membriGruppo(db, famiglia).find((m) => norm(m.nome) === chiave)
    if (membro) throw regolaViolata('membro_non_invitato', `${membro.nome} usa l'app: invitala all'evento per affidarle l'incarico`)
    const esistente = repo.esternoPerNome(db, famiglia, chiave)
    if (esistente) return { incaricato: esistente.nome, incaricatoId: null, esternoId: esistente.id, utente: false }
    if (a.salvaInRubrica) {
      const id = randomUUID()
      repo.inserisciEsterno(db, { id, gruppoId: famiglia, nome, nomeNorm: chiave, note: '', creatoDa: u.id }, adesso)
      return { incaricato: nome, incaricatoId: null, esternoId: id, utente: false }
    }
  }
  return { incaricato: nome, incaricatoId: null, esternoId: null, utente: false }
}

/**
 * Chi organizza affida (o libera, con `utenteId: null`) un incarico: a una persona con l'app
 * invitata all'evento, a una persona della rubrica o a un nome. Può aggiungere una nota e, per
 * un piatto, toglierlo dalla spesa («lo porta già pronto»).
 */
export function assegna(db: Db, u: UtenteCorrente, tipo: TipoIncarico, id: string, a: Assegnazione, adesso = Date.now()): Incarico {
  return transazione(db, () => {
    const { r, gestisce } = preparaScrittura(db, u, tipo, id, a.versione)
    if (!gestisce) throw accessoNegato('Solo chi organizza assegna gli incarichi')
    if (a.utenteId === null) return rinuncia(db, u, tipo, id, a.versione, adesso)
    const resp = risolviResponsabile(db, u, r.eventoId, a, adesso)
    // Cambio di responsabile: un'eventuale uscita dalla spesa legata al precedente si annulla.
    const inSpesaBase = r.spesaTolta ? true : r.inSpesa
    const toglie = tipo === 'voce' && a.togliDallaSpesa && inSpesaBase
    scrivi(
      db,
      u,
      r,
      a.versione,
      { incaricato: resp.incaricato, incaricatoId: resp.incaricatoId, esternoId: resp.esternoId, completato: false, inSpesa: toglie ? false : inSpesaBase, spesaTolta: toglie, note: a.note !== undefined ? pulisci(a.note) : undefined },
      adesso,
    )
    if (resp.incaricatoId && resp.incaricatoId !== u.id) {
      avvisa(db, { tipo: 'incarico', attoreId: u.id, destinatari: [resp.incaricatoId], chiave: `assegnato:${r.eventoId}`, eventoId: r.eventoId, testo: `Ti è stato affidato «${r.nome}»` }, adesso)
    } else if (!resp.utente) {
      avvisa(db, { tipo: 'incarico', attoreId: u.id, destinatari: personeEvento(db, r.eventoId), chiave: `incarichi:${r.eventoId}`, eventoId: r.eventoId, testo: `${resp.incaricato} porta «${r.nome}»` }, adesso)
    }
    incrementaRevisione(db)
    return incaricoAttuale(db, u, r)
  })
}

/** Fatto / non ancora: chi se n'è preso carico, oppure chi organizza (anche per le persone senza account). */
export function completa(db: Db, u: UtenteCorrente, tipo: TipoIncarico, id: string, versione: number, completato: boolean, adesso = Date.now()): Incarico {
  return transazione(db, () => {
    const { r, gestisce } = preparaScrittura(db, u, tipo, id, versione)
    if (!r.incaricato) throw regolaViolata('incarico_libero', 'Prima qualcuno deve prendersene carico')
    if (r.incaricatoId !== u.id && !gestisce) throw accessoNegato('Lo segna come fatto chi se n\'è preso carico (o chi organizza)')
    scrivi(db, u, r, versione, { incaricato: r.incaricato, incaricatoId: r.incaricatoId, esternoId: r.esternoId, completato, inSpesa: r.inSpesa, spesaTolta: r.spesaTolta }, adesso)
    incrementaRevisione(db)
    return incaricoAttuale(db, u, r)
  })
}

// ── Cose da portare che non sono piatti ─────────────────────

interface NuovaCosa {
  id: string
  nome: string
  quantita: string
  quantitaNumero: number | null
  unita: string
  note: string
  prendo: boolean
}

const datiCosa = (d: { nome: string; quantita: string; quantitaNumero: number | null; unita: string; note: string }) => ({
  nome: pulisci(d.nome),
  quantita: pulisci(d.quantita),
  quantitaNumero: d.quantitaNumero,
  unita: pulisci(d.unita),
  note: pulisci(d.note),
})

export function creaCosa(db: Db, u: UtenteCorrente, eventoId: string, d: NuovaCosa, adesso = Date.now()): Incarico {
  return transazione(db, () => {
    richiediEvento(db, u, eventoId, 'partecipa')
    richiediModificabile(leggiEvento(db, eventoId))
    const esistente = repo.leggiCosa(db, d.id)
    if (esistente) {
      if (esistente.evento_id === eventoId && esistente.creato_da === u.id) return incaricoAttuale(db, u, leggi(db, 'cosa', d.id))
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    const dati = datiCosa(d)
    repo.inserisciCosa(db, { id: d.id, eventoId, ...dati, creatoDa: u.id }, adesso)
    if (d.prendo) repo.scriviIncaricoCosa(db, d.id, 1, { incaricato: u.nome, incaricatoId: u.id, esternoId: null, completato: false }, adesso)
    const testo = d.prendo ? `${u.nome} porta «${dati.nome}»` : `Da portare: «${dati.nome}»`
    avvisa(db, { tipo: 'incarico', attoreId: u.id, destinatari: personeEvento(db, eventoId), chiave: `incarichi:${eventoId}`, eventoId, testo }, adesso)
    incrementaRevisione(db)
    return incaricoAttuale(db, u, leggi(db, 'cosa', d.id))
  })
}

function richiediGestioneCosa(db: Db, u: UtenteCorrente, id: string) {
  const r = leggi(db, 'cosa', id)
  richiediEvento(db, u, r.eventoId, 'partecipa')
  richiediModificabile(leggiEvento(db, r.eventoId))
  const permesso = permessoEvento(db, u, r.eventoId)
  if (permesso !== 'proprietario' && permesso !== 'modifica' && r.creatoDa !== u.id) throw accessoNegato('La modifica chi l\'ha aggiunta o chi organizza')
  return r
}

export function aggiornaCosa(
  db: Db,
  u: UtenteCorrente,
  id: string,
  d: { nome: string; quantita: string; quantitaNumero: number | null; unita: string; note: string; versione: number },
  adesso = Date.now(),
): Incarico {
  return transazione(db, () => {
    const r = richiediGestioneCosa(db, u, id)
    if (repo.aggiornaCosa(db, id, d.versione, datiCosa(d), adesso) !== 1) throw conflittoVersione(incaricoAttuale(db, u, r))
    incrementaRevisione(db)
    return incaricoAttuale(db, u, r)
  })
}

export function eliminaCosa(db: Db, u: UtenteCorrente, id: string, versione: number): void {
  transazione(db, () => {
    const r = richiediGestioneCosa(db, u, id)
    if (repo.eliminaCosa(db, id, versione) !== 1) throw conflittoVersione(incaricoAttuale(db, u, r))
    incrementaRevisione(db)
  })
}
