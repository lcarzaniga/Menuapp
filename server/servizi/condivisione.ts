// Condivisione di eventi e ricette, copie indipendenti, trasferimento di proprietà (SPEC §19.3–15.4).
import { randomUUID } from 'node:crypto'
import type { AccessoEvento, PermessoCondivisione, Persona } from '../../src/contratto/accesso.ts'
import { type Db, transazione } from '../db/connessione.ts'
import * as repo from '../db/repo/accesso.ts'
import * as repoEventi from '../db/repo/eventi.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import { accessoNegato, conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import type { CartellaFile } from './cartella.ts'
import { copiaFotoPiatto } from './foto.ts'
import { avvisa } from './notifiche.ts'
import { puoPartecipare, richiediEvento, richiediPiatto, type UtenteCorrente } from './permessi.ts'

/**
 * Destinatario di una nuova condivisione: attivo e della stessa Famiglia di chi condivide
 * (altrimenti «non trovato», come se non esistesse). Le condivisioni già esistenti restano
 * valide e modificabili anche se il destinatario non è (più) nella stessa Famiglia.
 */
function personaAttiva(db: Db, chi: UtenteCorrente, id: string, giaCondiviso = false): repo.RigaUtente {
  const u = repo.leggiUtente(db, id)
  if (!u || u.stato !== 'attivo') throw nonTrovato('Utente')
  if (!giaCondiviso && !repo.stessaFamiglia(db, chi.id, id)) throw nonTrovato('Utente')
  return u
}

/** Invitato a un evento: della Famiglia dell'evento (o di una Famiglia comune, se l'evento non ne ha). */
function invitabile(db: Db, chi: UtenteCorrente, eventoId: string, id: string, giaCondiviso = false): repo.RigaUtente {
  const gruppo = repo.gruppoEvento(db, eventoId)
  if (!gruppo || giaCondiviso) return personaAttiva(db, chi, id, giaCondiviso)
  const u = repo.leggiUtente(db, id)
  if (!u || u.stato !== 'attivo' || !repo.ruoloNelGruppo(db, gruppo, id)) throw nonTrovato('Utente')
  return u
}

// ── Eventi ───────────────────────────────────────────────────

export function accessoEvento(db: Db, u: UtenteCorrente, eventoId: string): AccessoEvento {
  const permesso = richiediEvento(db, u, eventoId, 'lettura')
  const proprietarioId = repo.proprietarioEvento(db, eventoId)!
  return {
    permesso,
    partecipa: puoPartecipare(db, u, eventoId),
    proprietario: { id: proprietarioId, nome: repo.leggiUtente(db, proprietarioId)?.nome ?? '' },
    gruppo: (() => {
      const g = repo.gruppoEvento(db, eventoId)
      return g ? { id: g, nome: repo.leggiGruppo(db, g)?.nome ?? '' } : null
    })(),
    condivisioni:
      permesso === 'proprietario'
        ? repo.condivisioniEvento(db, eventoId).map((c) => ({ utenteId: c.utente_id, utenteNome: c.nome, permesso: c.permesso, partecipa: c.partecipa === 1 }))
        : [],
  }
}

export function condividiEvento(
  db: Db,
  u: UtenteCorrente,
  eventoId: string,
  utenteId: string,
  permesso: PermessoCondivisione,
  adesso = Date.now(),
  partecipa = true,
): AccessoEvento {
  return transazione(db, () => {
    richiediEvento(db, u, eventoId, 'proprietario')
    if (utenteId === u.id) throw regolaViolata('condividi_con_te', 'L\'evento è già tuo')
    const nuova = !repo.condivisioniEvento(db, eventoId).some((c) => c.utente_id === utenteId)
    invitabile(db, u, eventoId, utenteId, !nuova)
    repo.impostaCondivisioneEvento(db, eventoId, utenteId, permesso, adesso, partecipa)
    if (nuova) {
      const evento = repoEventi.leggiEvento(db, eventoId)!
      avvisa(db, { tipo: 'condivisione', attoreId: u.id, destinatari: [utenteId], chiave: `condivisione-evento:${eventoId}`, eventoId, testo: `Condiviso con te: «${evento.nome}»` }, adesso)
    }
    incrementaRevisione(db)
    return accessoEvento(db, u, eventoId)
  })
}

/** Revoca: la decide il proprietario, oppure l'invitato che lascia l'evento. */
export function revocaCondivisioneEvento(db: Db, u: UtenteCorrente, eventoId: string, utenteId: string): void {
  transazione(db, () => {
    richiediEvento(db, u, eventoId, utenteId === u.id ? 'lettura' : 'proprietario')
    repo.togliCondivisioneEvento(db, eventoId, utenteId)
    incrementaRevisione(db)
  })
}

/**
 * Passa l'evento a un altro utente. I piatti collegati restano nel ricettario del vecchio
 * proprietario: il nuovo riceve copie indipendenti e le voci si collegano alle copie. Il
 * vecchio proprietario mantiene la modifica.
 */
export function trasferisciEvento(db: Db, cartellaFoto: CartellaFile, u: UtenteCorrente, eventoId: string, nuovoId: string, versione: number, adesso = Date.now()): AccessoEvento {
  return transazione(db, () => {
    richiediEvento(db, u, eventoId, 'proprietario')
    const evento = repoEventi.leggiEvento(db, eventoId)!
    if (evento.versione !== versione) throw conflittoVersione(evento)
    if (nuovoId === u.id) throw regolaViolata('gia_proprietario', 'L\'evento è già tuo')
    const nuovo = invitabile(db, u, eventoId, nuovoId)
    repoEventi.cambiaProprietario(db, eventoId, nuovoId, adesso)
    const copie = new Map<string, string>()
    for (const v of repoEventi.vociEvento(db, eventoId)) {
      if (!v.piattoId) continue
      let copia = copie.get(v.piattoId)
      if (!copia) {
        copia =
          repoRic.copiaEsistente(db, v.piattoId, nuovoId) ??
          copiaPiattoInterna(db, cartellaFoto, v.piattoId, randomUUID(), nuovoId, adesso, { famigliaOrigine: repo.famigliaEventoPer(db, eventoId, nuovoId) })
        copie.set(v.piattoId, copia)
      }
      repoEventi.collegaPiatto(db, v.id, copia, adesso)
    }
    repo.togliCondivisioneEvento(db, eventoId, nuovoId)
    repo.impostaCondivisioneEvento(db, eventoId, u.id, 'modifica', adesso)
    incrementaRevisione(db)
    return accessoEvento(db, { ...u, id: nuovo.id }, eventoId)
  })
}

/** Sposta l'evento in un'altra Famiglia del proprietario (o lo rende personale con null). */
export function spostaInFamiglia(db: Db, u: UtenteCorrente, eventoId: string, gruppoId: string | null, adesso = Date.now()): AccessoEvento {
  return transazione(db, () => {
    richiediEvento(db, u, eventoId, 'proprietario')
    if (gruppoId && !repo.ruoloNelGruppo(db, gruppoId, u.id)) throw nonTrovato('Famiglia')
    // Una ricorrenza della Famiglia resta alla Famiglia: cambiando Famiglia l'evento la perde.
    // Una standard vale in ogni Famiglia; un evento personale non ne ha (SPEC §30).
    if (repo.gruppoEvento(db, eventoId) !== gruppoId) {
      const e = repoEventi.leggiEvento(db, eventoId)!
      repoEventi.impostaRicorrenza(db, eventoId, { ricorrenzaId: null, standard: gruppoId ? e.ricorrenzaStandard : null, manuale: repoEventi.ricorrenzaManuale(db, eventoId) })
    }
    repo.impostaGruppoEvento(db, eventoId, gruppoId, adesso)
    incrementaRevisione(db)
    return accessoEvento(db, u, eventoId)
  })
}

// ── Ricette ──────────────────────────────────────────────────

/**
 * Famiglia in cui rendere visibile una nuova ricetta (al massimo una, SPEC §28): quella indicata
 * (verificando che l'autore ne faccia parte), altrimenti la sua unica Famiglia; con più Famiglie
 * e nessuna indicata la ricetta nasce privata.
 */
export function famiglieDiPartenza(db: Db, u: UtenteCorrente, famiglie: string[] | undefined, visibilita?: 'famiglia' | 'privata'): string[] {
  if (famiglie) {
    const uniche = [...new Set(famiglie)]
    if (uniche.length > 1) throw regolaViolata('una_famiglia', 'Una ricetta è visibile in una sola Famiglia: per un\'altra Famiglia copiala')
    for (const g of uniche) if (!repo.ruoloNelGruppo(db, g, u.id)) throw nonTrovato('Famiglia')
    return uniche
  }
  const mie = repo.gruppiDiUtente(db, u.id).map((g) => g.id)
  return visibilita === 'privata' || mie.length !== 1 ? [] : mie
}

/** Famiglia d'origine chiesta alla creazione: solo una Famiglia dell'autore. */
export function origineRichiesta(db: Db, u: UtenteCorrente, gruppoId: string | undefined): string | undefined {
  if (gruppoId !== undefined && !repo.ruoloNelGruppo(db, gruppoId, u.id)) throw nonTrovato('Famiglia')
  return gruppoId
}

/** «Privata» o «della mia Famiglia» (compatibilità con la versione a Famiglia unica). */
export function impostaVisibilita(db: Db, u: UtenteCorrente, piattoId: string, visibilita: 'famiglia' | 'privata', adesso = Date.now()): void {
  const mie = repo.gruppiDiUtente(db, u.id).map((g) => g.id)
  if (visibilita === 'famiglia' && mie.length > 1) throw regolaViolata('scegli_famiglia', 'Hai più Famiglie: scegli in quale rendere visibile la ricetta')
  impostaFamiglie(db, u, piattoId, visibilita === 'privata' ? [] : mie, adesso)
}

/** Famiglia in cui il proprietario rende visibile la ricetta (al massimo una; nessuna = privata). */
export function impostaFamiglie(db: Db, u: UtenteCorrente, piattoId: string, gruppi: string[], adesso = Date.now()): void {
  transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'proprietario')
    if (new Set(gruppi).size > 1) throw regolaViolata('una_famiglia', 'Una ricetta è visibile in una sola Famiglia: per un\'altra Famiglia copiala')
    for (const g of gruppi) if (!repo.ruoloNelGruppo(db, g, u.id)) throw nonTrovato('Famiglia')
    repo.impostaFamigliePiatto(db, piattoId, [...new Set(gruppi)], adesso)
    incrementaRevisione(db)
  })
}

export function condivisioniPiatto(db: Db, u: UtenteCorrente, piattoId: string): Persona[] {
  richiediPiatto(db, u, piattoId, 'proprietario')
  return repo.condivisioniPiatto(db, piattoId).map((c) => ({ id: c.utente_id, nome: c.nome }))
}

export function impostaCondivisioniPiatto(db: Db, u: UtenteCorrente, piattoId: string, utenti: string[], adesso = Date.now()): Persona[] {
  return transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'proprietario')
    const unici = [...new Set(utenti)].filter((id) => id !== u.id)
    const prima = new Set(repo.condivisioniPiatto(db, piattoId).map((c) => c.utente_id))
    for (const id of unici) personaAttiva(db, u, id, prima.has(id))
    repo.sostituisciCondivisioniPiatto(db, piattoId, unici, adesso)
    const nome = repoRic.leggiPiatto(db, piattoId)?.nome ?? 'una ricetta'
    avvisa(db, { tipo: 'condivisione', attoreId: u.id, destinatari: unici.filter((id) => !prima.has(id)), chiave: `condivisione-piatto:${piattoId}`, piattoId, testo: `Ricetta condivisa con te: «${nome}»` }, adesso)
    incrementaRevisione(db)
    return condivisioniPiatto(db, u, piattoId)
  })
}

/** Copia indipendente (ingredienti e foto) nel ricettario di `proprietarioId`. Restituisce il nuovo id. */
function copiaPiattoInterna(
  db: Db,
  cartellaFoto: CartellaFile,
  piattoId: string,
  nuovoId: string,
  proprietarioId: string,
  adesso: number,
  opzioni: { indipendente?: boolean; famigliaOrigine?: string } = {},
): string {
  const p = repoRic.leggiPiatto(db, piattoId)
  const prop = repoRic.proprietaPiatto(db, piattoId)
  if (!p || !prop) throw nonTrovato('Piatto')
  if (repoRic.leggiPiatto(db, nuovoId)) throw regolaViolata('id_esistente', 'Identificativo di piatto già usato')
  const { id: _id, versione: _v, creatoIl: _c, aggiornatoIl: _a, ingredienti, ...dati } = p
  repoRic.inserisciPiatto(db, nuovoId, dati, adesso, {
    proprietarioId,
    // La copia nasce privata: chi l'ha fatta decide se e con chi condividerla.
    // Una copia di una copia ricorda l'autore originale.
    // Fra Famiglie la copia non ha legami con l'originale (né classifica né riuso delle copie).
    originePiattoId: opzioni.indipendente ? null : (prop.originePiattoId ?? piattoId),
    // Fra Famiglie l'autore resta come informazione solo se è un altro (la provenienza dice il resto).
    origineAutore: opzioni.indipendente && proprietarioId === prop.proprietarioId && !prop.origineAutore ? '' : prop.origineAutore || prop.proprietarioNome,
    // La copia nasce nella Famiglia indicata; altrimenti in quella dell'originale se il nuovo
    // proprietario ne fa parte, altrimenti con le regole di sempre (la sua unica Famiglia).
    famigliaOrigine:
      opzioni.famigliaOrigine ??
      (prop.famigliaOrigine?.id && repo.ruoloNelGruppo(db, prop.famigliaOrigine.id, proprietarioId) ? prop.famigliaOrigine.id : undefined),
  })
  repoRic.scriviIngredienti(db, nuovoId, ingredienti.map((i) => ({ ...i, id: randomUUID() })))
  copiaFotoPiatto(db, cartellaFoto, piattoId, nuovoId, adesso)
  return nuovoId
}

/**
 * «Copia in un'altra Famiglia» (SPEC §28): una nuova ricetta dell'utente, visibile nella Famiglia
 * di destinazione, con ingredienti, procedimento e foto duplicate. Nessun legame con l'originale
 * (né per le modifiche, né per voti e commenti): resta solo una provenienza descrittiva.
 */
export function copiaInFamiglia(
  db: Db,
  cartellaFoto: CartellaFile,
  u: UtenteCorrente,
  piattoId: string,
  d: { id: string; gruppoId: string; indicaFamiglia: boolean },
  adesso = Date.now(),
): string {
  return transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'lettura')
    if (!repo.ruoloNelGruppo(db, d.gruppoId, u.id)) throw nonTrovato('Famiglia')
    const origine = repo.famigliePiatto(db, piattoId).find((g) => repo.ruoloNelGruppo(db, g.id, u.id))
    if (origine?.id === d.gruppoId) throw regolaViolata('stessa_famiglia', 'La ricetta è già visibile in questa Famiglia')
    const titolo = repoRic.leggiPiatto(db, piattoId)!.nome
    const id = copiaPiattoInterna(db, cartellaFoto, piattoId, d.id, u.id, adesso, { indipendente: true, famigliaOrigine: d.gruppoId })
    repo.impostaFamigliePiatto(db, id, [d.gruppoId], adesso)
    repoRic.impostaProvenienza(db, id, { titolo, copiataIl: adesso, copiataDa: u.nome, famiglia: d.indicaFamiglia && origine ? origine.nome : null })
    incrementaRevisione(db)
    return id
  })
}

/** «Copia nel mio ricettario» di una ricetta che l'utente può leggere. */
export function copiaPiatto(db: Db, cartellaFoto: CartellaFile, u: UtenteCorrente, piattoId: string, nuovoId: string, adesso = Date.now()): string {
  return transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'lettura')
    const id = copiaPiattoInterna(db, cartellaFoto, piattoId, nuovoId, u.id, adesso)
    incrementaRevisione(db)
    return id
  })
}

/**
 * Piatto da collegare a una voce dell'evento: deve essere del proprietario dell'evento. Se
 * l'utente collega una ricetta che può leggere ma di un altro, il proprietario dell'evento ne
 * riceve una copia indipendente (riusata se esiste già). Da chiamare in una transazione.
 */
export function piattoPerEvento(db: Db, cartellaFoto: CartellaFile, u: UtenteCorrente, eventoId: string, piattoId: string, adesso = Date.now()): string {
  richiediPiatto(db, u, piattoId, 'lettura')
  const proprietarioEvento = repo.proprietarioEvento(db, eventoId)
  if (!proprietarioEvento) throw nonTrovato('Evento')
  const proprietarioPiatto = repo.proprietarioPiatto(db, piattoId)!
  if (proprietarioPiatto === proprietarioEvento) return piattoId
  if (proprietarioPiatto !== u.id && !repo.piattoLeggibileDaAltri(db, piattoId, u.id)) throw accessoNegato('Ricetta non disponibile')
  return (
    repoRic.copiaEsistente(db, piattoId, proprietarioEvento) ??
    copiaPiattoInterna(db, cartellaFoto, piattoId, randomUUID(), proprietarioEvento, adesso, { famigliaOrigine: repo.famigliaEventoPer(db, eventoId, proprietarioEvento) })
  )
}
